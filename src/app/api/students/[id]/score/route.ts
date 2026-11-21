import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clampScores, assignRanks, autoScoresFor, suggestAcademicScore, applyAutoPlatformScores } from "@/lib/score";
import { toDto, parseScoreAudit } from "@/lib/dto";
import { requireScorer, getSessionUser, canWriteScoreField, hasScope } from "@/lib/auth";
import { scopesAreFull, docCategoryScope, linkCategoryScope } from "@/lib/scopes";
import { SCORE_CAPS, type ScoreAuditEntry } from "@/lib/types";
import { normalizeGithubUrl, normalizeLeetcodeUrl } from "@/lib/utils";
import { enqueueScrapes } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const scoreSchema = z.object({
  scores: z
    .object({
      academic: z.coerce.number().optional(),
      github: z.coerce.number().optional(),
      coding: z.coerce.number().optional(),
      internship: z.coerce.number().optional(),
      certifications: z.coerce.number().optional(),
      projects: z.coerce.number().optional(),
      fullstack: z.coerce.number().optional(),
      hackathons: z.coerce.number().optional(),
      inhouse: z.coerce.number().optional(),
      membership: z.coerce.number().optional(),
      shl: z.coerce.number().optional(),
    })
    .optional(),
  academicMarks: z
    .object({
      tenthPercent: z.coerce.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100").optional(),
      twelfthPercent: z.coerce.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100").optional(),
      sgpaSem1: z.coerce.number().min(0, "Must be ≥ 0").max(10, "Must be ≤ 10").optional(),
      sgpaSem2: z.coerce.number().min(0, "Must be ≥ 0").max(10, "Must be ≤ 10").optional(),
    })
    .optional(),
  profileLinks: z
    .object({
      githubUrl: z.string().trim().optional().or(z.literal("")),
      leetcodeUrl: z.string().trim().optional().or(z.literal("")),
    })
    .optional(),
  verify: z.boolean().optional(),
  coordinatorNote: z.string().trim().max(500).optional(),
  /** Super admin only: clear manual overrides on these auto components and
   *  return them to the calculated values (from marks bands / live scrapes). */
  autoReset: z.array(z.enum(["academic", "github", "coding"])).max(3).optional(),
});

/**
 * PATCH /api/students/:id/score — coordinator score entry + verification.
 * Recomputes total, persists, and refreshes ranks for everyone.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireScorer();
  if (error) return error;

  const student = await prisma.student.findUnique({ where: { id: params.id } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 422 });
  }  const incoming = parsed.data.scores ?? {};

  // Academic, GitHub and Coding are calculated automatically by default, but
  // assigned section coordinators (or super admins) may review and manually award/override marks.
  const AUTO_FIELDS = ["academic", "github", "coding"] as const;
  for (const key of AUTO_FIELDS) {
    if (incoming[key] !== undefined && !user.isSuperAdmin && !canWriteScoreField(user, key)) {
      return NextResponse.json(
        { error: `You do not have permission to score ${key} marks` },
        { status: 403 }
      );
    }
  }

  // Scoped coordinators may only write their assigned rubric sections (1:1
  // with the submission sections). Super admins and coordinators with no
  // scope restrictions pass every check.
  for (const key of Object.keys(incoming)) {
    if (!user.isSuperAdmin && !canWriteScoreField(user, key)) {
      return NextResponse.json(
        { error: "You do not have permission to score this section" },
        { status: 403 }
      );
    }
  }

  const requestedReset = parsed.data.autoReset ?? [];
  const autoReset = user.isSuperAdmin
    ? requestedReset
    : requestedReset.filter((f) => canWriteScoreField(user, f));

  // Academic marks editing by authorized coordinators or super admin
  const academicMarksInput = parsed.data.academicMarks;
  if (academicMarksInput && !user.isSuperAdmin && !canWriteScoreField(user, "academic")) {
    return NextResponse.json(
      { error: "You do not have permission to edit student academic marks" },
      { status: 403 }
    );
  }

  const newTenth = academicMarksInput?.tenthPercent !== undefined ? academicMarksInput.tenthPercent : student.tenthPercent;
  const newTwelfth = academicMarksInput?.twelfthPercent !== undefined ? academicMarksInput.twelfthPercent : student.twelfthPercent;
  const newSgpa1 = academicMarksInput?.sgpaSem1 !== undefined ? academicMarksInput.sgpaSem1 : student.sgpaSem1;
  const newSgpa2 = academicMarksInput?.sgpaSem2 !== undefined ? academicMarksInput.sgpaSem2 : student.sgpaSem2;
  const newCgpa =
    newSgpa1 > 0 && newSgpa2 > 0
      ? Math.round(((newSgpa1 + newSgpa2) / 2) * 100) / 100
      : newSgpa1 > 0
        ? newSgpa1
        : newSgpa2 > 0
          ? newSgpa2
          : student.cgpa > 0
            ? student.cgpa
            : 0;

  const academicMarksChanged =
    academicMarksInput !== undefined &&
    (newTenth !== student.tenthPercent ||
      newTwelfth !== student.twelfthPercent ||
      newSgpa1 !== student.sgpaSem1 ||
      newSgpa2 !== student.sgpaSem2 ||
      newCgpa !== student.cgpa);

  // Recompute the automatic components: overridden ones keep their stored
  // value; a component being reset right now takes its RAW calculated value
  // (marks bands / latest scrapes). Then merge coordinator-entered sections
  // with existing values (partial updates).
  const AUTO = await autoScoresFor(student.id);
  const RAW = autoReset.length ? await autoScoresFor(student.id, { respectOverrides: false }) : AUTO;
  const merged = {
    academic: autoReset.includes("academic")
      ? RAW.academic
      : academicMarksChanged && incoming.academic === undefined
        ? suggestAcademicScore(newTenth, newTwelfth, newCgpa)
        : AUTO.academic,
    github: autoReset.includes("github") ? RAW.github : AUTO.github,
    coding: autoReset.includes("coding") ? RAW.coding : AUTO.coding,
    internship: incoming.internship ?? student.scoreInternship,
    certifications: incoming.certifications ?? student.scoreCertifications,
    projects: incoming.projects ?? student.scoreProjects,
    fullstack: incoming.fullstack ?? student.scoreFullstack,
    hackathons: incoming.hackathons ?? student.scoreHackathons,
    inhouse: incoming.inhouse ?? student.scoreInhouse,
    membership: incoming.membership ?? student.scoreMembership,
    shl: incoming.shl ?? student.scoreShl,
  };
  // Evaluator explicitly entered an auto component → apply it and flag the
  // override so future rescrapes/recalculations keep this value until reset.
  if (incoming.academic !== undefined && (user.isSuperAdmin || canWriteScoreField(user, "academic"))) {
    merged.academic = incoming.academic;
  }
  if (incoming.github !== undefined && (user.isSuperAdmin || canWriteScoreField(user, "github"))) {
    merged.github = incoming.github;
  }
  if (incoming.coding !== undefined && (user.isSuperAdmin || canWriteScoreField(user, "coding"))) {
    merged.coding = incoming.coding;
  }
  const clamped = clampScores(merged);

  // ── Audit trail: who entered which marks, and who verified the record ──
  // Only actual CHANGES are recorded (re-saving an identical value adds no
  // entry), so the list stays readable. Newest first, capped for safety.
  const prevValues: Record<string, number> = {
    academic: student.scoreAcademic,
    github: student.scoreGithub,
    coding: student.scoreCoding,
    internship: student.scoreInternship,
    certifications: student.scoreCertifications,
    projects: student.scoreProjects,
    fullstack: student.scoreFullstack,
    hackathons: student.scoreHackathons,
    inhouse: student.scoreInhouse,
    membership: student.scoreMembership,
    shl: student.scoreShl,
  };
  const now = new Date();
  const AUTO_KEYS = ["academic", "github", "coding"] as const;
  // `clamped` keys are ScoreBreakdown & "total"; the filter below drops
  // "total", and this view keeps indexing `incoming` type-safe.
  const incomingRec = incoming as Record<string, number | undefined>;
  const newEntries: ScoreAuditEntry[] = (
    Object.keys(clamped) as (keyof typeof clamped)[]
  )
    .filter((f) => f !== "total" && clamped[f] !== prevValues[f])
    .map((f) => ({
      field: f,
      value: clamped[f],
      // Classification: an auto component is only an "override" when a
      // super admin actually typed it this request — otherwise its change is
      // a system recalculation ("auto") or an explicit "reset".
      action: !(AUTO_KEYS as readonly string[]).includes(f)
        ? ("entered" as const)
        : autoReset.includes(f as (typeof autoReset)[number])
          ? ("reset" as const)
          : incomingRec[f] !== undefined
            ? ("override" as const)
            : ("auto" as const),
      byName: user.fullName,
      at: now.toISOString(),
    }));

  // "Save & Verify Candidate" stamps WHO verified the whole submission;
  // "Save as Pending" clears it; omitting `verify` leaves it untouched.
  //
  // Final verification is reserved for ALL-SECTION (full access) reviewers:
  // a scoped coordinator verifies their own sections and enters their own
  // marks, but the submission only turns green once remaining coordinators
  // have verified all documents/links and a main coordinator or the super
  // admin signs it off.
  const verifyState = parsed.data.verify;
  if (verifyState !== undefined && !user.isSuperAdmin && !user.canScore) {
    return NextResponse.json(
      {
        error: "You do not have permission to verify candidate submissions.",
      },
      { status: 403 }
    );
  }

  if (verifyState === true) {
    // Only block verification if there are pending items within the coordinator's assigned scope.
    // Unrestricted reviewers / super admins verify against all sections.
    const isFullReviewer = user.isSuperAdmin || scopesAreFull(user.permissionScopes);

    const pendingDocs = await prisma.document.findMany({
      where: { studentId: student.id, status: "PENDING" },
      select: { category: true },
    });
    const scopedPendingDocs = isFullReviewer
      ? pendingDocs
      : pendingDocs.filter((d) => hasScope(user, docCategoryScope(d.category)));

    if (scopedPendingDocs.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot mark candidate as verified: ${scopedPendingDocs.length} document proof(s) in your assigned sections are still pending review. All evidence in your scope must be verified or rejected first.`,
        },
        { status: 422 }
      );
    }

    const pendingLinks = await prisma.projectLink.findMany({
      where: { studentId: student.id, status: "PENDING" },
      select: { category: true },
    });
    const scopedPendingLinks = isFullReviewer
      ? pendingLinks
      : pendingLinks.filter((l) => hasScope(user, linkCategoryScope(l.category)));

    if (scopedPendingLinks.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot mark candidate as verified: ${scopedPendingLinks.length} project link(s) in your assigned sections are still pending review. All evidence in your scope must be verified or rejected first.`,
        },
        { status: 422 }
      );
    }

    newEntries.push({
      field: "finalVerification",
      value: clamped.total,
      action: "verified",
      byName: user.fullName,
      at: now.toISOString(),
    });
  } else if (verifyState === false) {
    newEntries.push({
      field: "finalVerification",
      value: clamped.total,
      action: "reset",
      byName: user.fullName,
      at: now.toISOString(),
    });
  }

  if (academicMarksChanged) {
    newEntries.push({
      field: "academic",
      value: clamped.academic,
      action: "override",
      byName: user.fullName,
      at: now.toISOString(),
    });
  }

  // Profile link updates (GitHub URL & LeetCode URL)
  const incomingLinks = parsed.data.profileLinks;
  let newGithubUrl = student.githubUrl;
  let newLeetcodeUrl = student.leetcodeUrl;
  let profileLinksChanged = false;

  if (incomingLinks) {
    if (incomingLinks.githubUrl !== undefined) {
      const normalizedGh = normalizeGithubUrl(incomingLinks.githubUrl);
      if (normalizedGh !== student.githubUrl) {
        newGithubUrl = normalizedGh;
        profileLinksChanged = true;
        newEntries.push({
          field: "github",
          value: clamped.github,
          action: "override",
          byName: user.fullName,
          at: now.toISOString(),
        });
      }
    }

    if (incomingLinks.leetcodeUrl !== undefined) {
      const normalizedLc = normalizeLeetcodeUrl(incomingLinks.leetcodeUrl);
      if (normalizedLc !== student.leetcodeUrl) {
        newLeetcodeUrl = normalizedLc;
        profileLinksChanged = true;
        newEntries.push({
          field: "coding",
          value: clamped.coding,
          action: "override",
          byName: user.fullName,
          at: now.toISOString(),
        });
      }
    }
  }

  const scoreAudit = JSON.stringify(
    [...newEntries, ...parseScoreAudit(student.scoreAudit)].slice(0, 200)
  );

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: {
      githubUrl: newGithubUrl,
      leetcodeUrl: newLeetcodeUrl,
      tenthPercent: newTenth,
      twelfthPercent: newTwelfth,
      sgpaSem1: newSgpa1,
      sgpaSem2: newSgpa2,
      cgpa: newCgpa,
      scoreAcademic: clamped.academic,
      scoreGithub: clamped.github,
      scoreCoding: clamped.coding,
      academicOverridden: (incoming.academic !== undefined && (user.isSuperAdmin || canWriteScoreField(user, "academic"))) ? true
        : autoReset.includes("academic") ? false : student.academicOverridden,
      githubOverridden: (incoming.github !== undefined && (user.isSuperAdmin || canWriteScoreField(user, "github"))) ? true
        : autoReset.includes("github") ? false : student.githubOverridden,
      codingOverridden: (incoming.coding !== undefined && (user.isSuperAdmin || canWriteScoreField(user, "coding"))) ? true
        : autoReset.includes("coding") ? false : student.codingOverridden,
      scoreInternship: clamped.internship,
      scoreCertifications: clamped.certifications,
      scoreProjects: clamped.projects,
      scoreFullstack: clamped.fullstack,
      scoreHackathons: clamped.hackathons,
      scoreInhouse: clamped.inhouse,
      scoreMembership: clamped.membership,
      scoreShl: clamped.shl,
      totalScore: clamped.total,
      status: verifyState === undefined ? student.status : verifyState ? "VERIFIED" : "PENDING",
      verifiedById: verifyState === undefined ? student.verifiedById : verifyState ? user.id : null,
      verifiedByName:
        verifyState === undefined ? student.verifiedByName : verifyState ? user.fullName : null,
      verifiedAt: verifyState === undefined ? student.verifiedAt : verifyState ? now : null,
      scoreAudit,
      coordinatorNote: parsed.data.coordinatorNote ?? student.coordinatorNote,
    },
  });

  // If profile links changed, re-run scrape jobs and auto-scoring
  if (profileLinksChanged) {
    try {
      await enqueueScrapes(student.id, newGithubUrl, newLeetcodeUrl);
      await applyAutoPlatformScores(student.id);
    } catch (e) {
      console.warn("Failed to auto-rescrape after profile link update:", e);
    }
  }

  // Ranks depend on total score → refresh globally (cheap at batch scale).
  await assignRanks();

  const fresh = await prisma.student.findUniqueOrThrow({
    where: { id: student.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });

  return NextResponse.json({ student: toDto(fresh), caps: SCORE_CAPS });
}

/** GET /api/students/:id/score — current score breakdown */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Own scores are visible to the student; the batch view is evaluator-only.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const isEvaluator = user.canViewSubmissions;
  if (!isEvaluator && user.id !== params.id) {
    return NextResponse.json({ error: "You can only view your own scores" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { id: params.id } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json({
    scores: clampScores({
      academic: student.scoreAcademic,
      github: student.scoreGithub,
      coding: student.scoreCoding,
      internship: student.scoreInternship,
      certifications: student.scoreCertifications,
      projects: student.scoreProjects,
      fullstack: student.scoreFullstack,
      hackathons: student.scoreHackathons,
      inhouse: student.scoreInhouse,
      membership: student.scoreMembership,
      shl: student.scoreShl,
    }),
    caps: SCORE_CAPS,
  });
}
