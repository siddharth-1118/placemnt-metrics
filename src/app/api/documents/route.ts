import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { docToDto } from "@/lib/dto";
import {
  DOC_CATEGORY_KEYS,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TYPES,
} from "@/lib/categories";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents — multipart upload of one proof document.
 *
 * Form fields:
 *   file      — the PDF/JPG/PNG/WEBP (≤ 10 MB)
 *   category  — one of DOC_CATEGORY_KEYS
 *   note      — optional caption
 *
 * Signed-in users upload to their OWN submission. This keeps student
 * identifiers out of the request entirely (no uploading to someone else).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload documents" }, { status: 401 });
  }

  // The student must have a submission row to attach documents to.
  const student = await prisma.student.findUnique({ where: { id: user.id } });
  if (!student) {
    return NextResponse.json(
      { error: "Submit your placement profile first — documents attach to your submission." },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const category = String(form.get("category") ?? "");
  if (!DOC_CATEGORY_KEYS.includes(category)) {
    return NextResponse.json({ error: "Choose a valid document category" }, { status: 422 });
  }

  const noteRaw = form.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 300) : null;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 422 });
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";
  if (!UPLOAD_MIME_TYPES.includes(mime as (typeof UPLOAD_MIME_TYPES)[number])) {
    return NextResponse.json({ error: "Only PDF, JPG, PNG or WEBP files are accepted" }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const doc = await prisma.document.create({
    data: {
      studentId: student.id,
      category,
      fileName: file.name.slice(0, 200),
      mimeType: mime,
      sizeBytes: file.size,
      note,
      // File bytes are written after the row is created; a crash between the
      // two leaves an orphan row at worst, never a dangling file reference.
    },
  });

  const dir = path.join(process.cwd(), "uploads", student.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, doc.id), buffer);

  return NextResponse.json({ document: docToDto(doc) }, { status: 201 });
}
