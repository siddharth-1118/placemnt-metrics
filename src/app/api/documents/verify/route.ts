import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScorer, hasScope } from "@/lib/auth";
import { docCategoryScope, linkCategoryScope } from "@/lib/scopes";

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
 * Ultra-fast execution (<50ms) without heavy background snapshot overhead.
 */
export async function PATCH(req: Request) {
  const { user, error } = await requireScorer();
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

  // Scoped coordinators may only verify items in their assigned sections
  // (e.g. a hackathons-only reviewer verifies COMPETITION documents, not marksheets).
  // Super admin / unrestricted coordinators pass every check.
  const targetScope =
    kind === "document"
      ? docCategoryScope((await prisma.document.findUnique({ where: { id }, select: { category: true } }))?.category ?? "")
      : linkCategoryScope((await prisma.projectLink.findUnique({ where: { id }, select: { category: true } }))?.category ?? "");
  if (!hasScope(user, targetScope)) {
    return NextResponse.json(
      { error: "You do not have permission to review this section" },
      { status: 403 }
    );
  }

  const now = new Date();
  const data = {
    status,
    reviewedAt: status === "PENDING" ? null : now,
    reviewNote: reviewNote?.trim() || null,
    reviewedById: status === "PENDING" ? null : user.id,
    reviewedByName: status === "PENDING" ? null : user.fullName,
  };

  if (kind === "document") {
    await prisma.document.update({ where: { id }, data });
  } else {
    await prisma.projectLink.update({ where: { id }, data });
  }

  return NextResponse.json({
    ok: true,
    status,
    reviewedByName: data.reviewedByName,
    reviewedAt: data.reviewedAt?.toISOString() ?? null,
  });
}
