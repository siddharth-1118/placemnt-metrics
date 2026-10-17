/**
 * Categories of proof a student can attach to their placement submission.
 *
 * - DOC_CATEGORIES: uploaded files (PDF/JPG/PNG) — coordinator verifies each.
 * - LINK_CATEGORIES: plain URLs, unlimited (projects must have links).
 */

export type DocCategoryKey =
  | "TENTH_MARKSHEET"
  | "TWELFTH_MARKSHEET"
  | "CGPA_MARKSHEET"
  | "SEM1_MARKSHEET"
  | "SEM2_MARKSHEET"
  | "INTERNSHIP"
  | "SKILL_CERT"
  | "COMPETITION"
  | "INHOUSE_PROJECT"
  | "MEMBERSHIP"
  | "SHL";

export type LinkCategoryKey = "PROJECT" | "FULLSTACK_PROJECT" | "INHOUSE_PROJECT_LINK";

export interface CategoryDef {
  key: string;
  label: string;
  /** One-line guidance shown in the form. */
  hint: string;
}

export const DOC_CATEGORIES: CategoryDef[] = [
  { key: "TENTH_MARKSHEET", label: "10th Marksheet", hint: "Marksheet / pass certificate showing the 10th percentage" },
  { key: "TWELFTH_MARKSHEET", label: "12th Marksheet", hint: "Marksheet / pass certificate showing the 12th percentage" },
  { key: "CGPA_MARKSHEET", label: "CGPA / Consolidated Marksheet", hint: "Current consolidated grade report showing the overall CGPA" },
  { key: "SEM1_MARKSHEET", label: "Semester 1 Marksheet", hint: "Sem 1 grade report showing the Semester 1 SGPA" },
  { key: "SEM2_MARKSHEET", label: "Semester 2 Marksheet", hint: "Sem 2 grade report showing the Semester 2 SGPA" },
  { key: "INTERNSHIP", label: "Internship Proof", hint: "Offer letter, completion certificate or experience letter" },
  { key: "SKILL_CERT", label: "Skills & Global Certifications", hint: "Course certificates (AWS, Coursera, NPTEL, Udemy…) — upload one per certificate" },
  { key: "COMPETITION", label: "Competitions & Hackathons", hint: "Winner/participation certificates or event photos" },
  { key: "INHOUSE_PROJECT", label: "In-house Project (document)", hint: "Report, certificate or screenshots — if you have a deployed link, add it under links instead" },
  { key: "MEMBERSHIP", label: "Professional Membership", hint: "IEEE / ACM / CSI / GDSC membership card or receipt (deployed link allowed as alternative)" },
  { key: "SHL", label: "SHL Talent Discovery Program", hint: "SHL assessment result / participation document" },
];

export const LINK_CATEGORIES: CategoryDef[] = [
  { key: "PROJECT", label: "Project Link", hint: "GitHub repo, live demo or case study — add as many as you want" },
  { key: "FULLSTACK_PROJECT", label: "Full-stack Project Link", hint: "Deployed full-stack apps (frontend + backend + DB)" },
  { key: "INHOUSE_PROJECT_LINK", label: "In-house Project Link", hint: "Deployed in-house / campus project (alternative to uploading a document)" },
];

export const DOC_CATEGORY_KEYS = DOC_CATEGORIES.map((c) => c.key);
export const LINK_CATEGORY_KEYS = LINK_CATEGORIES.map((c) => c.key);

export function docCategoryLabel(key: string): string {
  return DOC_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function linkCategoryLabel(key: string): string {
  return LINK_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Upload constraints enforced by the API. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type UploadMime = (typeof UPLOAD_MIME_TYPES)[number];

/** Non-standard MIME strings browsers/OSes actually report for images. */
const MIME_ALIASES: Record<string, UploadMime> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-jpeg": "image/jpeg",
  "image/jpeg": "image/jpeg",
  "image/jfif": "image/jpeg",
  "image/pjp": "image/jpeg",
  "image/png": "image/png",
  "image/x-png": "image/png",
  "application/x-png": "image/png",
  "image/apng": "image/png",
  "image/webp": "image/webp",
  "application/pdf": "application/pdf",
};

/** File extension → MIME, for browsers that report an empty/unknown type. */
const EXT_MIME: Record<string, UploadMime> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jpe": "image/jpeg",
  ".jfif": "image/jpeg",
  ".jif": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Resolve the MIME type an upload should be stored/validated as.
 *
 * Files were being rejected (415) when the browser reported the
 * non-standard `image/jpg` or an empty type — both happen for real .jpg/.png
 * files depending on OS/browser. Resolution order:
 *   1. recognized standard type as-is
 *   2. alias for a non-standard type the browser sent
 *   3. inferred from the file name extension (case-insensitive)
 *   4. null → genuinely unsupported (server replies 415)
 */
export function resolveUploadMime(
  reported: string | null | undefined,
  fileName?: string | null
): UploadMime | null {
  const raw = (reported ?? "").trim().toLowerCase().split(";")[0].trim();
  if ((UPLOAD_MIME_TYPES as readonly string[]).includes(raw)) return raw as UploadMime;
  if (MIME_ALIASES[raw]) return MIME_ALIASES[raw];
  if (raw.includes("jpeg") || raw.includes("jpg")) return "image/jpeg";
  if (raw.includes("png")) return "image/png";
  if (raw.includes("webp")) return "image/webp";
  if (raw.includes("pdf")) return "application/pdf";

  const name = (fileName ?? "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot >= 0) {
    const ext = name.slice(dot);
    const byExt = EXT_MIME[ext];
    if (byExt) return byExt;
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".jpe" || ext === ".jfif") return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    if (ext === ".pdf") return "application/pdf";
  }
  return null;
}

/**
 * Sniff the real type from file content — used as the final fallback so an
 * extensionless / unknown-type image still uploads when its bytes prove what
 * it is. PDF: "%PDF" · PNG: 89 50 4E 47 · JPEG: FF D8 · WEBP: "RIFF".
 */
export function sniffUploadMime(bytes: Uint8Array): UploadMime | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return "application/pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  // Standard JPEG start-of-image marker: 0xFF 0xD8
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8)
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

/** Categories that ALSO accept a deployed link instead of a document. */
export const LINK_OK_FOR_DOC = new Set<string>(["INHOUSE_PROJECT", "MEMBERSHIP"]);
