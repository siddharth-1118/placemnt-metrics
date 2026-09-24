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

/**
 * DELETE /api/students/:id — assigned evaluator only.
 * Permanently removes the profile: DB row (scrapes, documents, links and
 * notifications cascade), every uploaded file in Supabase Storage, and any
 * still-pending password-reset requests filed with this email.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireEvaluator();
  if (error) return error;

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: { documents: { select: { id: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await prisma.student.delete({ where: { id: student.id } });

  // Remove any still-pending password-reset requests for this identity.
  await prisma.passwordResetRequest.updateMany({
    where: { email: student.email, status: "PENDING" },
    data: { status: "DENIED", note: "Account deleted by coordinator" },
  }).catch(() => undefined);

  // Best-effort file cleanup — the DB row is already gone either way.
  const { deleteDocument } = await import("@/lib/storage");
  await Promise.allSettled(
    student.documents.map((d) => deleteDocument(student.id, d.id))
  );

  await (await import("@/lib/score")).assignRanks();
  return NextResponse.json({ ok: true });
}
