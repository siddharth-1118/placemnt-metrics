import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hasScope } from "@/lib/auth";
import { docCategoryScope } from "@/lib/scopes";
import { getDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/file — stream the stored document.
 *
 * Access: the owner, or an evaluator whose ASSIGNED SECTIONS cover this
 * document's category (a hackathons-only coordinator cannot pull a
 * marksheet by guessing its id, even though section-filtered lists never
 * show it). A valid `?token=` matching the student's uploadToken is also
 * accepted so files open in new tabs/iframe viewers where the session
 * cookie may not be forwarded.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { student: { select: { uploadToken: true } } },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const token = new URL(req.url).searchParams.get("token");
  const isOwner = user?.id === doc.studentId;
  const tokenOk = token !== null && token === doc.student.uploadToken;
  const isAllowedEvaluator =
    !!user && user.canViewSubmissions && hasScope(user, docCategoryScope(doc.category));

  if (!isOwner && !tokenOk && !isAllowedEvaluator) {
    return NextResponse.json({ error: "Not authorized to view this document" }, { status: 403 });
  }

  const stored = await getDocument(doc.studentId, doc.id);
  if (!stored) {
    return NextResponse.json({ error: "Stored file is missing" }, { status: 410 });
  }
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(stored.bytes.length),
      // Render inline in browser tabs (viewers) rather than force-download.
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
