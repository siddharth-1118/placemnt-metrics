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
  { key: "CGPA_MARKSHEET", label: "CGPA / Semester Marksheet", hint: "Current semester grade report or consolidated marksheet" },
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

/** Categories that ALSO accept a deployed link instead of a document. */
export const LINK_OK_FOR_DOC = new Set<string>(["INHOUSE_PROJECT", "MEMBERSHIP"]);
