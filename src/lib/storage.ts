/**
 * Document storage abstraction.
 *
 * Two drivers, selected by STORAGE_DRIVER (default: auto):
 *  - "supabase" — files live in a Supabase Storage bucket (serverless-ready;
 *    requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). The bucket is
 *    created automatically on first upload when missing.
 *  - "disk"     — files live under uploads/<studentId>/ (local dev).
 *  - "auto"     — supabase when the env keys are present, else disk.
 *
 * Both drivers share the same object key layout:
 *   <studentId>/<documentId>
 * so files can migrate between drivers without renaming.
 */

export const DOCUMENT_BUCKET = "placement-documents";

let cachedClient: ReturnType<typeof import("@supabase/supabase-js").createClient> | null = null;

async function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cachedClient) {
    const { createClient } = await import("@supabase/supabase-js");
    // Service-role client: bypasses RLS by design — access control happens in
    // our API routes (owner or assigned evaluator only).
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

function driver(): "supabase" | "disk" {
  const d = (process.env.STORAGE_DRIVER ?? "auto").toLowerCase();
  if (d === "supabase" || d === "disk") return d;
  // auto: Supabase when fully configured, otherwise local disk.
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "supabase"
    : "disk";
}

export function isSupabaseStorage(): boolean {
  return driver() === "supabase";
}

/**
 * Create a short-lived signed upload URL so the BROWSER can push the file
 * bytes straight to Supabase Storage. Serverless platforms cap request
 * bodies (~4.5 MB on Vercel), so large uploads through our API die with a
 * network error before the route even runs — direct uploads bypass that
 * entirely. Returns null when the disk driver is active (local dev keeps
 * the multipart flow).
 */
export async function createSignedDocumentUpload(
  studentId: string,
  documentId: string
): Promise<{ signedUrl: string } | null> {
  if (driver() !== "supabase") return null;
  const client = await supabase();
  if (!client) return null;
  await ensureBucket();
  const key = `${studentId}/${documentId}`;
  const { data, error } = await client.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(key, { upsert: true });
  if (error || !data) {
    throw new Error(`Could not create an upload link: ${error?.message ?? "unknown error"}`);
  }
  return { signedUrl: data.signedUrl };
}

/** True when the object for this document actually exists in storage. */
export async function documentObjectExists(
  studentId: string,
  documentId: string
): Promise<boolean> {
  if (driver() !== "supabase") {
    try {
      const { promises: fs } = await import("node:fs");
      const path = await import("node:path");
      await fs.access(path.join(process.cwd(), "uploads", studentId, documentId));
      return true;
    } catch {
      return false;
    }
  }
  const client = await supabase();
  if (!client) return false;
  const { data } = await client.storage
    .from(DOCUMENT_BUCKET)
    .list(studentId, { search: documentId, limit: 1 });
  return (data ?? []).some((o) => o.name === documentId);
}

/** Ensure the bucket exists (idempotent, called before the first upload). */
async function ensureBucket(): Promise<void> {
  const client = await supabase();
  if (!client) throw new Error("Supabase storage not configured");
  const { data } = await client.storage.getBucket(DOCUMENT_BUCKET);
  if (data) return;
  const { error } = await client.storage.createBucket(DOCUMENT_BUCKET, {
    public: false, // downloads always go through our access-checked API route
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (error && !error.message.includes("already exists")) {
    throw new Error(`Bucket creation failed: ${error.message}`);
  }
}

/** Store one document. Returns the driver actually used. */
export async function putDocument(
  studentId: string,
  documentId: string,
  bytes: Buffer,
  mimeType: string
): Promise<"supabase" | "disk"> {
  const key = `${studentId}/${documentId}`;

  if (driver() === "supabase") {
    try {
      await ensureBucket();
      const client = (await supabase())!;
      const { error } = await client.storage
        .from(DOCUMENT_BUCKET)
        .upload(key, bytes, { contentType: mimeType, upsert: true });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
      return "supabase";
    } catch (err) {
      // Never lose a student's upload to a transient/storage config issue —
      // degrade to disk and surface the reason in the server logs.
      console.warn("[storage] supabase upload failed, using disk:", (err as Error).message);
    }
  }

  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "uploads", studentId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, documentId), bytes);
  return "disk";
}

/** Read one document back, or null when the file is missing. */
export async function getDocument(
  studentId: string,
  documentId: string
): Promise<{ bytes: Buffer; source: "supabase" | "disk" } | null> {
  const key = `${studentId}/${documentId}`;

  if (driver() === "supabase") {
    const client = (await supabase())!;
    const { data, error } = await client.storage.from(DOCUMENT_BUCKET).download(key);
    if (!error && data) {
      return { bytes: Buffer.from(await data.arrayBuffer()), source: "supabase" };
    }
    // Not in the bucket — maybe it was written to disk while storage was
    // misconfigured. Fall through to the disk driver before giving up.
  }

  try {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    return {
      bytes: await fs.readFile(path.join(process.cwd(), "uploads", studentId, documentId)),
      source: "disk",
    };
  } catch {
    return null;
  }
}

/** Remove one document (best-effort; missing files are fine). */
export async function deleteDocument(studentId: string, documentId: string): Promise<void> {
  const key = `${studentId}/${documentId}`;

  if (driver() === "supabase") {
    const client = (await supabase())!;
    await client.storage.from(DOCUMENT_BUCKET).remove([key]);
    return;
  }

  try {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    await fs.unlink(path.join(process.cwd(), "uploads", studentId, documentId));
  } catch {
    /* file may already be gone */
  }
}
