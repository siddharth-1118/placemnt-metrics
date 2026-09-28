import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clampScores, assignRanks, autoScoresFor } from "@/lib/score";
import { toDto } from "@/lib/dto";
import { requireScorer, getSessionUser, canWriteScoreField } from "@/lib/auth";
import { SCORE_CAPS } from "@/lib/types";

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
      status: parsed.data.verify === undefined ? student.status : parsed.data.verify ? "VERIFIED" : "PENDING",
      coordinatorNote: parsed.data.coordinatorNote ?? student.coordinatorNote,
    },
  });

  // Ranks depend on total score → refresh globally (cheap at batch scale).
  await assignRanks();

  const fresh = await prisma.student.findUniqueOrThrow({
    where: { id: student.id },
    include: { scrapes: true },
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
