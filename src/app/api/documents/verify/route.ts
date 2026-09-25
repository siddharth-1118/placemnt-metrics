import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScorer } from "@/lib/auth";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  kind: z.enum(["document", "link"]),
  id: z.string().min(1),
  status: z.enum(["VERIFIED", "REJECTED", "PENDING"]),
  reviewNote: z.string().trim().max(300).optional(),
});

/**
 * PATCH /api/documents/verify — assigned evaluator marks a document or link
 * VERIFIED / REJECTED (with an optional note). PENDING resets the review.
 */
export async function PATCH(req: Request) {
  const { error } = await requireScorer();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const { kind, id, status, reviewNote } = parsed.data;
  const now = new Date();
  const data = {
    status,
    reviewedAt: status === "PENDING" ? null : now,
    reviewNote: reviewNote?.trim() || null,
  };

  if (kind === "document") {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    await prisma.document.update({ where: { id }, data });
  } else {
    const link = await prisma.projectLink.findUnique({ where: { id } });
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
    await prisma.projectLink.update({ where: { id }, data });
  }

  return NextResponse.json({ ok: true });
}
