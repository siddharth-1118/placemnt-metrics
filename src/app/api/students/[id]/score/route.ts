import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clampScores, assignRanks, autoScoresFor } from "@/lib/score";
import { toDto, parseScoreAudit } from "@/lib/dto";
import { requireScorer, getSessionUser, canWriteScoreField } from "@/lib/auth";
import { scopesAreFull } from "@/lib/scopes";
import { SCORE_CAPS, type ScoreAuditEntry } from "@/lib/types";
import { capturePortalArchive } from "@/lib/auto-archive";

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

  // Academic, GitHub and Coding are system-calculated (band tables from
  // marks + the live scrapes). Coordinators can never write them; the super
  // admin MAY override them manually — the stored value then wins over
  // future rescrapes/recalculations until the super admin clears it.
  const AUTO_FIELDS = ["academic", "github", "coding"] as const;
  for (const key of AUTO_FIELDS) {
    if (incoming[key] !== undefined && !user.isSuperAdmin) {
      return NextResponse.json(
        { error: `${key} marks are calculated automatically and cannot be entered manually` },
        { status: 422 }
      );
    }
  }

  // Scoped coordinators may only write their assigned rubric sections (1:1
  // with the submission sections). Super admins and coordinators with no
  // scope restrictions pass every check. Auto fields are handled above
  // (super-admin override allowed), so they are skipped here.
  for (const key of Object.keys(incoming)) {
    if ((AUTO_FIELDS as readonly string[]).includes(key) && user.isSuperAdmin) continue;
    if (!canWriteScoreField(user, key)) {
      return NextResponse.json(
        { error: "You do not have permission to score this section" },
        { status: 403 }
      );
    }
  }

  const autoReset = user.isSuperAdmin ? (parsed.data.autoReset ?? []) : [];

  // Recompute the automatic components: overridden ones keep their stored
  // value; a component being reset right now takes its RAW calculated value
  // (marks bands / latest scrapes). Then merge coordinator-entered sections
  // with existing values (partial updates).
  const AUTO = await autoScoresFor(student.id);
  const RAW = autoReset.length ? await autoScoresFor(student.id, { respectOverrides: false }) : AUTO;
  const merged = {
    academic: autoReset.includes("academic") ? RAW.academic : AUTO.academic,
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
  // Super admin explicitly entered an auto component → apply it and flag the
  // override so future rescrapes/recalculations keep this value until the
  // super admin clears it (autoReset below).
  if (user.isSuperAdmin) {
    if (incoming.academic !== undefined) merged.academic = incoming.academic;
    if (incoming.github !== undefined) merged.github = incoming.github;
    if (incoming.coding !== undefined) merged.coding = incoming.coding;
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
  if (verifyState !== undefined && !user.isSuperAdmin && !scopesAreFull(user.permissionScopes)) {
    return NextResponse.json(
      {
        error:
          "Only all-sections (full access) main coordinators can change the final verification state — you can still save your section scores.",
      },
      { status: 403 }
    );
  }

  if (verifyState === true) {
    const pendingDocs = await prisma.document.count({
      where: { studentId: student.id, status: "PENDING" },
    });
    if (pendingDocs > 0) {
      return NextResponse.json(
        {
          error: `Cannot mark candidate as verified: ${pendingDocs} document proof(s) are still pending coordinator review. All documents must be verified or rejected before final approval.`,
        },
        { status: 422 }
      );
    }

    const pendingLinks = await prisma.projectLink.count({
      where: { studentId: student.id, status: "PENDING" },
    });
    if (pendingLinks > 0) {
      return NextResponse.json(
        {
          error: `Cannot mark candidate as verified: ${pendingLinks} project link(s) are still pending coordinator review. All links must be verified or rejected before final approval.`,
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
  }

  const scoreAudit = JSON.stringify(
    [...newEntries, ...parseScoreAudit(student.scoreAudit)].slice(0, 200)
  );

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: {
      scoreAcademic: clamped.academic,
      scoreGithub: clamped.github,
      scoreCoding: clamped.coding,
      academicOverridden: user.isSuperAdmin && incoming.academic !== undefined ? true
        : autoReset.includes("academic") ? false : student.academicOverridden,
      githubOverridden: user.isSuperAdmin && incoming.github !== undefined ? true
        : autoReset.includes("github") ? false : student.githubOverridden,
      codingOverridden: user.isSuperAdmin && incoming.coding !== undefined ? true
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

  // Ranks depend on total score → refresh globally (cheap at batch scale).
  await assignRanks();

  const fresh = await prisma.student.findUniqueOrThrow({
    where: { id: student.id },
    include: { scrapes: true },
  });

  capturePortalArchive(
    "COORDINATOR_UPDATE",
    `Score evaluation updated for ${fresh.fullName} (${fresh.registerNumber}) by ${user.fullName}`
  ).catch(console.error);

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
