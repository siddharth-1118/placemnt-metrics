import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isSubmissionsLocked } from "@/lib/settings";
import { docToDto, redactReviewer } from "@/lib/dto";
import { putDocument, deleteDocument, createSignedDocumentUpload } from "@/lib/storage";
import { notify } from "@/lib/notify";
import {
  DOC_CATEGORY_KEYS,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TYPES,
  resolveUploadMime,
  sniffUploadMime,
} from "@/lib/categories";

export const dynamic = "force-dynamic";

function validateCategory(category: string): NextResponse | null {
  if (!DOC_CATEGORY_KEYS.includes(category)) {
    return NextResponse.json({ error: "Choose a valid document category" }, { status: 422 });
  }
  return null;
}

function mimeError(): NextResponse {
  return NextResponse.json({ error: "Only PDF, JPG, PNG or WEBP files are accepted" }, { status: 415 });
}

/** `mime` must already be resolved via resolveUploadMime/sniffUploadMime. */
function validateMime(mime: string): NextResponse | null {
  if (!UPLOAD_MIME_TYPES.includes(mime as (typeof UPLOAD_MIME_TYPES)[number])) return mimeError();
  return null;
}

/**
 * A VERIFIED document freezes its section for the student: no new uploads in
 * that category until a coordinator deletes the verified proof (they are
 * notified to re-upload). Evaluators bypass this so they can still repair
 * data during review.
 */
async function verifiedSectionLock(
  studentId: string,
  category: string,
  requesterIsEvaluator: boolean
): Promise<NextResponse | null> {
  if (requesterIsEvaluator) return null;
  const verified = await prisma.document.findFirst({
    where: { studentId, category, status: "VERIFIED" },
    select: { id: true },
  });
  if (!verified) return null;
  return NextResponse.json(
    {
      error:
        "A coordinator already verified a document in this section — it is locked. Ask your coordinator if it must be replaced.",
    },
    { status: 423 }
  );
}

function validateSize(size: number): NextResponse | null {
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 422 });
  }
  if (size > UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 413 });
  }
  return null;
}

/**
 * POST /api/documents
 *
 * Two modes, chosen by the request's content-type:
 *
 * 1. JSON (preferred in production) — metadata handshake only. The server
 *    validates + creates the Document row and returns a short-lived SIGNED
 *    upload URL; the BROWSER then pushes the file bytes straight to Supabase
 *    Storage. Serverless platforms cap request bodies (~4.5 MB on Vercel),
 *    so pushing bytes through this function made any larger upload die with
 *    a raw network error ("Failed to fetch") before this route even ran.
 *    Response: { upload: "direct", documentId, signedUrl, document }.
 *
 * 2. multipart (local disk driver / fallback) — the original flow: the file
 *    arrives in the form body and is written server-side.
 *    Response: { document }.
 *
 * Both keep student identifiers out of the request (no uploading to someone
 * else) — signed-in users always write to their OWN submission.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload documents" }, { status: 401 });
  }

  // Submissions closed: students can no longer add documents (evaluators
  // bypass so they can still fix data during review).
  const isEvaluatorUser = user.canViewSubmissions;
  if (!isEvaluatorUser && (await isSubmissionsLocked())) {
    return NextResponse.json(
      { error: "Submissions are closed by the coordinator. Please contact your coordinator." },
      { status: 423 }
    );
  }

  // The student must have a submission row to attach documents to.
  const student = await prisma.student.findUnique({ where: { id: user.id } });
  if (!student) {
    return NextResponse.json(
      { error: "Submit your placement profile first — documents attach to your submission." },
      { status: 400 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return signedUploadHandshake(req, student.id, isEvaluatorUser);
  }
  return multipartUpload(req, student.id, isEvaluatorUser);
}

/** Mode 1: validate metadata, create the row, hand back a signed upload URL. */
async function signedUploadHandshake(req: Request, studentId: string, requesterIsEvaluator: boolean) {
  let body: { category?: unknown; note?: unknown; fileName?: unknown; fileSize?: unknown; fileType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const category = String(body.category ?? "");
  const invalid = validateCategory(category);
  if (invalid) return invalid;

  const lockedSection = await verifiedSectionLock(studentId, category, requesterIsEvaluator);
  if (lockedSection) return lockedSection;

  const fileName = String(body.fileName ?? "document").slice(0, 200);
  // Browsers report the non-standard "image/jpg" or an empty type for some
  // real .jpg/.png files — resolve it (type → alias → extension) instead of
  // rejecting the upload.
  const mime = resolveUploadMime(String(body.fileType ?? ""), fileName);
  if (!mime) return mimeError(); // also narrows `mime` to a supported type
  const invalidMime = validateMime(mime);
  if (invalidMime) return invalidMime;

  const size = Number(body.fileSize ?? 0);
  const invalidSize = validateSize(size);
  if (invalidSize) return invalidSize;

  const noteRaw = typeof body.note === "string" ? body.note : "";
  const note = noteRaw.trim() ? noteRaw.trim().slice(0, 300) : null;

  // Create the row first — its id is the storage key. Rolled back on failure
  // so no Document ever exists without a backing file.
  const docId = (
    await prisma.document.create({
      data: { studentId, category, fileName, mimeType: mime, sizeBytes: size, note },
    })
  ).id;

  try {
    const signed = await createSignedDocumentUpload(studentId, docId);
    if (!signed) {
      // Disk driver (local dev): no signed URLs — tell the client to fall
      // back to the multipart flow.
      await prisma.document.delete({ where: { id: docId } }).catch(() => undefined);
      return NextResponse.json({ upload: "multipart" });
    }
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    return NextResponse.json({
      upload: "direct",
      documentId: docId,
      signedUrl: signed.signedUrl,
      // Reviewer identity is evaluator-only (a fresh upload is always
      // PENDING, but keep the rule applied uniformly across responders).
      document: doc ? redactReviewer(docToDto(doc), requesterIsEvaluator) : null,
    });
  } catch (err) {
    await prisma.document.delete({ where: { id: docId } }).catch(() => undefined);
    return NextResponse.json(
      { error: `Could not create an upload link: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

/** Mode 2: classic multipart upload (file bytes through the server). */
async function multipartUpload(req: Request, studentId: string, requesterIsEvaluator: boolean) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const category = String(form.get("category") ?? "");
  const invalid = validateCategory(category);
  if (invalid) return invalid;

  const lockedSection = await verifiedSectionLock(studentId, category, requesterIsEvaluator);
  if (lockedSection) return lockedSection;

  const noteRaw = form.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 300) : null;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 422 });
  }
  const invalidSize = validateSize(file.size);
  if (invalidSize) return invalidSize;

  const buffer = Buffer.from(await file.arrayBuffer());
  // Resolve the MIME from what the browser reported, then the file name
  // extension, then the file's magic bytes — so images with an empty or
  // non-standard type still upload instead of dying with a 415.
  const mime = resolveUploadMime(file.type, file.name) ?? sniffUploadMime(buffer);
  if (!mime) return mimeError(); // also narrows `mime` to a supported type
  const invalidMime = validateMime(mime);
  if (invalidMime) return invalidMime;

  // Storage write FIRST (Supabase when configured, disk otherwise). If storage
  // is misconfigured and even the disk fallback fails, we fail the request —
  // no orphan Document rows without a backing file. The document id doubles
  // as the storage key, so the row is created first and rolled back on failure.
  const docId = (
    await prisma.document.create({
      data: { studentId, category, fileName: "pending", mimeType: mime, sizeBytes: file.size },
    })
  ).id;
  try {
    await putDocument(studentId, docId, buffer, mime);
    const doc = await prisma.document.update({
      where: { id: docId },
      data: { fileName: file.name.slice(0, 200), note },
    });
    return NextResponse.json(
      { document: redactReviewer(docToDto(doc), requesterIsEvaluator) },
      { status: 201 }
    );
  } catch (err) {
    await prisma.document.delete({ where: { id: docId } }).catch(() => undefined);
    return NextResponse.json(
      { error: `Could not store the file: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents?id=<documentId>
 *
 *  - Students: may remove their OWN documents only while still PENDING.
 *    Once a coordinator verifies (or rejects) a document it is locked —
 *    re-uploads must go through the coordinator.
 *  - Coordinators (assigned evaluators): may delete ANY document, verified or
 *    not — e.g. an illegible marksheet. The student receives an in-app
 *    notification so they know to re-upload.
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

  if (!isEvaluator) {
    if (doc.studentId !== user.id) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }
    if (doc.status !== "PENDING") {
      return NextResponse.json(
        { error: "This document was already reviewed and is locked — ask a coordinator if it must be replaced" },
        { status: 403 }
      );
    }
  }

  await prisma.document.delete({ where: { id } });
  await deleteDocument(doc.studentId, doc.id);

  if (isEvaluator && doc.studentId !== user.id) {
    await notify({
      studentId: doc.studentId,
      title: "Document removed by coordinator",
      body: `Your ${doc.category === "SHL" ? "SHL document" : doc.category.toLowerCase()} “${doc.note || doc.fileName}” was removed by a coordinator. Please upload it again.`,
      kind: "WARNING",
    });
  }

  return NextResponse.json({ ok: true });
}
