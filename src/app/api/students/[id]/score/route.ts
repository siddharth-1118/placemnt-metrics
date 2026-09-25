import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clampScores, assignRanks } from "@/lib/score";
import { toDto } from "@/lib/dto";
import { requireScorer, getSessionUser } from "@/lib/auth";
import { SCORE_CAPS } from "@/lib/types";

export const dynamic = "force-dynamic";

const scoreSchema = z.object({
  scores: z
    .object({
      academic: z.coerce.number().optional(),
      github: z.coerce.number().optional(),
      coding: z.coerce.number().optional(),
      projects: z.coerce.number().optional(),
      internship: z.coerce.number().optional(),
      extras: z.coerce.number().optional(),
    })
    .optional(),
  verify: z.boolean().optional(),
  coordinatorNote: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/students/:id/score — coordinator score entry + verification.
 * Recomputes total, persists, and refreshes ranks for everyone.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireScorer();
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
  }

  const incoming = parsed.data.scores ?? {};
  // Merge with existing scores so partial updates are supported.
  const merged = {
    academic: incoming.academic ?? student.scoreAcademic,
    github: incoming.github ?? student.scoreGithub,
    coding: incoming.coding ?? student.scoreCoding,
    projects: incoming.projects ?? student.scoreProjects,
    internship: incoming.internship ?? student.scoreInternship,
    extras: incoming.extras ?? student.scoreExtras,
  };
  const clamped = clampScores(merged);

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: {
      scoreAcademic: clamped.academic,
      scoreGithub: clamped.github,
      scoreCoding: clamped.coding,
      scoreProjects: clamped.projects,
      scoreInternship: clamped.internship,
      scoreExtras: clamped.extras,
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
      projects: student.scoreProjects,
      internship: student.scoreInternship,
      extras: student.scoreExtras,
    }),
    caps: SCORE_CAPS,
  });
}
