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
  /** Whether this document is mandatory for student placement verification. */
  required?: boolean;
}

export const DOC_CATEGORIES: CategoryDef[] = [
  { key: "TENTH_MARKSHEET", label: "10th Marksheet", hint: "Marksheet / pass certificate showing the 10th percentage", required: true },
  { key: "TWELFTH_MARKSHEET", label: "12th Marksheet", hint: "Marksheet / pass certificate showing the 12th percentage", required: true },
  { key: "CGPA_MARKSHEET", label: "CGPA / Semester Marksheet", hint: "Current semester grade report or consolidated marksheet", required: true },
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

/** Mandatory document categories required for verification (10th, 12th, and CGPA Marksheets). */
export const REQUIRED_DOC_CATEGORIES = DOC_CATEGORIES.filter((c) => c.required);
export const REQUIRED_DOC_KEYS = REQUIRED_DOC_CATEGORIES.map((c) => c.key);

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

export interface DocumentItemSummary {
  category: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  documentId?: string;
  fileName?: string;
  status?: string;
  isPendingVerification: boolean;
}

export interface StudentDocumentAudit {
  requiredTotal: number;
  uploadedCount: number;
  missingCount: number;
  missingDocKeys: string[];
  missingDocLabels: string[];
  isComplete: boolean;
  hasPendingVerification: boolean;
  summaryText: string;
  checklist: DocumentItemSummary[];
}

/**
 * Evaluates whether a student has uploaded all mandatory verification documents.
 * Uploaded documents awaiting review (PENDING) are treated as uploaded (not missing).
 */
export function auditStudentDocuments(
  documents: { category: string; id?: string; fileName?: string; status?: string }[] = []
): StudentDocumentAudit {
  const validUploaded = documents.filter((d) => d.status !== "REJECTED");
  const uploadedMap = new Map<string, { category: string; id?: string; fileName?: string; status?: string }>();
  for (const doc of validUploaded) {
    if (!uploadedMap.has(doc.category)) {
      uploadedMap.set(doc.category, doc);
    }
  }

  const checklist: DocumentItemSummary[] = REQUIRED_DOC_CATEGORIES.map((cat) => {
    const uploadedDoc = uploadedMap.get(cat.key);
    const uploaded = !!uploadedDoc;
    return {
      category: cat.key,
      label: cat.label,
      required: true,
      uploaded,
      documentId: uploadedDoc?.id,
      fileName: uploadedDoc?.fileName,
      status: uploaded ? (uploadedDoc?.status ?? "PENDING") : "MISSING",
      isPendingVerification: uploadedDoc?.status === "PENDING",
    };
  });

  const missingDocs = checklist.filter((item) => !item.uploaded);
  const requiredTotal = REQUIRED_DOC_CATEGORIES.length;
  const missingCount = missingDocs.length;
  const uploadedCount = requiredTotal - missingCount;
  const isComplete = missingCount === 0;
  const hasPendingVerification = documents.some((d) => d.status === "PENDING");

  let summaryText = "";
  if (missingCount === 0) {
    summaryText = "Complete";
  } else if (missingCount === requiredTotal) {
    summaryText = "All Missing";
  } else {
    summaryText = `${missingCount} Missing`;
  }

  return {
    requiredTotal,
    uploadedCount,
    missingCount,
    missingDocKeys: missingDocs.map((d) => d.category),
    missingDocLabels: missingDocs.map((d) => d.label),
    isComplete,
    hasPendingVerification,
    summaryText,
    checklist,
  };
}
