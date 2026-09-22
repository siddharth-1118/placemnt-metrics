import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import { getSessionUser, requireEvaluator } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/:id — full detail incl. scrape payloads.
 * Accessible to the assigned evaluator OR the student's own session
 * (students may view their own submission only — never other students').
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const isEvaluator = user.role === "COORDINATOR" && user.evaluatorAssigned;
  const isSelf = user.id === params.id;
  if (!isEvaluator && !isSelf) {
    return NextResponse.json(
      { error: "You can only view your own submission" },
      { status: 403 }
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json({ student: toDto(student) });
}

/** DELETE /api/students/:id — assigned evaluator only. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireEvaluator();
  if (error) return error;

  const student = await prisma.student.findUnique({ where: { id: params.id } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  await prisma.student.delete({ where: { id: student.id } });
  await (await import("@/lib/score")).assignRanks();
  return NextResponse.json({ ok: true });
}
