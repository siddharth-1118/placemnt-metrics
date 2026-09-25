import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireEvaluator } from "@/lib/auth";
import { docToDto, linkToDto } from "@/lib/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents?studentId=<id> — list one student's documents + links.
 * Self (own submission) or the assigned evaluator only.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") ?? user.id;

  const isEvaluator = user.canViewSubmissions;
  if (!isEvaluator && studentId !== user.id) {
    return NextResponse.json({ error: "You can only view your own documents" }, { status: 403 });
  }

  const [documents, projectLinks] = await Promise.all([
    prisma.document.findMany({ where: { studentId }, orderBy: { createdAt: "asc" } }),
    prisma.projectLink.findMany({ where: { studentId }, orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    documents: documents.map(docToDto),
    projectLinks: projectLinks.map(linkToDto),
  });
}

/**
 * DELETE /api/documents?id=<docId> — the owner may remove their own
 * not-yet-verified document (e.g. uploaded the wrong file).
 */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const isEvaluator = user.canViewSubmissions;
  if (doc.studentId !== user.id && !isEvaluator) {
    return NextResponse.json({ error: "Not your document" }, { status: 403 });
  }
  if (doc.status === "VERIFIED" && !isEvaluator) {
    return NextResponse.json(
      { error: "This document was already verified — ask a coordinator to remove it" },
      { status: 403 }
    );
  }

  // Best-effort file removal; the row is the source of truth.
  const { deleteDocument } = await import("@/lib/storage");
  await deleteDocument(doc.studentId, doc.id);

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
