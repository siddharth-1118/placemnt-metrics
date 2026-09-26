/**
 * Per-coordinator permission scopes.
 *
 * A coordinator's `permissionScopes` column stores a JSON array of scope keys
 * (see SCORE_SCOPE_KEYS). Each scope is a submission section the coordinator
 * may VIEW the evidence for and SCORE/verify:
 *
 *   ACADEMIC       — 10th/12th/CGPA marks + marksheet documents
 *   GITHUB         — GitHub profile evidence
 *   CODING         — LeetCode evidence
 *   PROJECTS       — project links (repos, demos, case studies)
 *   FULLSTACK      — full-stack development project links
 *   INTERNSHIP     — internship proof documents
 *   CERTIFICATIONS — skills & global certification uploads
 *   HACKATHONS     — coding competitions & hackathons (won / participated)
 *   MEMBERSHIP     — professional body memberships
 *   SHL            — SHL Talent Discovery assessment documents
 *   INHOUSE        — in-house project documents & deployed links
 *
 * An EMPTY array means ALL sections (full access) — that is what the super
 * admin and previously-created coordinators have, so existing accounts keep
 * working unchanged after this feature ships.
 *
 * "EXTRAS" is a legacy scope key from the previous rubric (certs + hackathons
 * + memberships + SHL bundled together). It is kept as an alias so old
 * coordinator rows still work: a coordinator holding EXTRAS effectively has
 * the four sections it used to cover. New assignments should use the explicit
 * keys above.
 */

export const SCORE_SCOPE_KEYS = [
  "ACADEMIC",
  "GITHUB",
  "CODING",
  "PROJECTS",
  "FULLSTACK",
  "INTERNSHIP",
  "CERTIFICATIONS",
  "HACKATHONS",
  "MEMBERSHIP",
  "SHL",
  "INHOUSE",
] as const;

export type ScoreScope = (typeof SCORE_SCOPE_KEYS)[number];

/** Legacy scope (previous rubric) accepted when reading stored permissions. */
export const LEGACY_SCOPE_KEYS = ["EXTRAS"] as const;
export type LegacyScope = (typeof LEGACY_SCOPE_KEYS)[number];

export const SCORE_SCOPE_LABELS: Record<ScoreScope, string> = {
  ACADEMIC: "Academic marks",
  GITHUB: "GitHub",
  CODING: "LeetCode / coding",
  PROJECTS: "Project links",
  FULLSTACK: "Full-stack development",
  INTERNSHIP: "Internships",
  CERTIFICATIONS: "Skills & global certifications",
  HACKATHONS: "Competitions & hackathons",
  MEMBERSHIP: "Professional memberships",
  SHL: "SHL assessment",
  INHOUSE: "In-house projects",
};

/** Sections covered by the legacy EXTRAS scope. */
export const LEGACY_EXTRAS_COVERS: ScoreScope[] = [
  "CERTIFICATIONS",
  "HACKATHONS",
  "MEMBERSHIP",
  "SHL",
];

/**
 * Expand a stored scope list: unknown/invalid keys are dropped and the legacy
 * EXTRAS alias is expanded into the four sections it covers (unless the list
 * already names them explicitly).
 */
export function parseScopes(raw: string | null | undefined): ScoreScope[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    const set = new Set<ScoreScope>();
    for (const v of parsed) {
      if (typeof v !== "string") continue;
      if (v === "EXTRAS") {
        for (const s of LEGACY_EXTRAS_COVERS) set.add(s);
        continue;
      }
      if ((SCORE_SCOPE_KEYS as readonly string[]).includes(v)) set.add(v as ScoreScope);
    }
    return SCORE_SCOPE_KEYS.filter((k) => set.has(k));
  } catch {
    return [];
  }
}

/** True when these scopes grant access to every section (empty = unrestricted). */
export function scopesAreFull(scopes: ScoreScope[] | null | undefined): boolean {
  return !scopes || scopes.length === 0;
}

/** Serialize a scope list back to the JSON column format (legacy keys expanded). */
export function serializeScopes(scopes: ScoreScope[]): string {
  return JSON.stringify(parseScopes(JSON.stringify(scopes)));
}

/**
 * Does this coordinator have a scope? Super admin always passes; coordinators
 * with no scope restrictions (empty list) pass for every key.
 */
export function hasScope(
  user: { isSuperAdmin: boolean; permissionScopes?: ScoreScope[] | null } | null | undefined,
  scope: ScoreScope
): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return scopesAreFull(user.permissionScopes) || (user.permissionScopes ?? []).includes(scope);
}

/** Client-side alias of hasScope for components gating UI by scope. */
export const hasScopeClient = hasScope;

/**
 * Coordinator-writable score fields, one per section — a section coordinator
 * verifies that section's evidence AND enters its marks.
 *
 * Academic, GitHub and Coding are NOT listed: they are calculated
 * automatically (band tables from marks, and the live GitHub/LeetCode
 * scrapes) and the score API rejects manual writes to them.
 */
export const SCORE_FIELD_SCOPES: Record<string, ScoreScope[]> = {
  internship: ["INTERNSHIP"],
  certifications: ["CERTIFICATIONS"],
  projects: ["PROJECTS"],
  fullstack: ["FULLSTACK"],
  hackathons: ["HACKATHONS"],
  inhouse: ["INHOUSE"],
  membership: ["MEMBERSHIP"],
  shl: ["SHL"],
};

/** May this user write the given rubric score field? */
export function canWriteScoreField(
  user: { isSuperAdmin: boolean; permissionScopes?: ScoreScope[] | null } | null | undefined,
  field: string
): boolean {
  const accepted = SCORE_FIELD_SCOPES[field];
  if (!accepted) return false;
  return accepted.some((s) => hasScope(user, s));
}

/**
 * The rubric score field each section owns, 1:1 — used to strip out-of-scope
 * SCORES from API responses so a scoped coordinator never receives another
 * section's marks. Academic/GitHub/Coding are included even though they are
 * auto-calculated: they still belong to their section's viewers.
 */
export const SCORE_FIELD_VIEW_SCOPE: Record<string, ScoreScope> = {
  academic: "ACADEMIC",
  github: "GITHUB",
  coding: "CODING",
  internship: "INTERNSHIP",
  certifications: "CERTIFICATIONS",
  projects: "PROJECTS",
  fullstack: "FULLSTACK",
  hackathons: "HACKATHONS",
  inhouse: "INHOUSE",
  membership: "MEMBERSHIP",
  shl: "SHL",
};

/** True when a score field is shared by sections the user only partly holds. */
export function isSharedScoreField(
  user: { isSuperAdmin: boolean; permissionScopes?: ScoreScope[] | null } | null | undefined,
  field: string
): boolean {
  const accepted = SCORE_FIELD_SCOPES[field];
  if (!accepted || accepted.length < 2) return false;
  return !accepted.every((s) => hasScope(user, s));
}

/* ------------------------------- Category map ------------------------------ */

/**
 * Which scope each proof document category belongs to. Used to decide whether
 * a scoped coordinator may view/verify a specific document.
 */
export const DOC_CATEGORY_SCOPE: Record<string, ScoreScope> = {
  TENTH_MARKSHEET: "ACADEMIC",
  TWELFTH_MARKSHEET: "ACADEMIC",
  CGPA_MARKSHEET: "ACADEMIC",
  INTERNSHIP: "INTERNSHIP",
  SKILL_CERT: "CERTIFICATIONS",
  COMPETITION: "HACKATHONS",
  INHOUSE_PROJECT: "INHOUSE",
  MEMBERSHIP: "MEMBERSHIP",
  SHL: "SHL",
};

/** Which scope each project-link category belongs to. */
export const LINK_CATEGORY_SCOPE: Record<string, ScoreScope> = {
  PROJECT: "PROJECTS",
  FULLSTACK_PROJECT: "FULLSTACK",
  INHOUSE_PROJECT_LINK: "INHOUSE",
};

export function docCategoryScope(category: string): ScoreScope {
  return DOC_CATEGORY_SCOPE[category] ?? "CERTIFICATIONS";
}

export function linkCategoryScope(category: string): ScoreScope {
  return LINK_CATEGORY_SCOPE[category] ?? "PROJECTS";
}
