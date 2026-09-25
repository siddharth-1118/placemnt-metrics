/**
 * Per-coordinator permission scopes.
 *
 * A coordinator's `permissionScopes` column stores a JSON array of scope keys
 * (see SCORE_SCOPE_KEYS). Each scope is a score rubric section the coordinator
 * may VIEW the evidence for and SCORE/verify.
 *
 *   ACADEMIC   — 10th/12th/CGPA marks + marksheet documents
 *   GITHUB     — GitHub profile evidence
 *   CODING     — LeetCode evidence
 *   PROJECTS   — project links & in-house project documents
 *   INTERNSHIP — internship proof documents
 *   EXTRAS     — certifications, competitions & hackathons, memberships, SHL
 *
 * An EMPTY array means ALL sections (full access) — that is what the super
 * admin and previously-created coordinators have, so existing accounts keep
 * working unchanged after this feature ships.
 */

export const SCORE_SCOPE_KEYS = [
  "ACADEMIC",
  "GITHUB",
  "CODING",
  "PROJECTS",
  "INTERNSHIP",
  "EXTRAS",
] as const;

export type ScoreScope = (typeof SCORE_SCOPE_KEYS)[number];

export const SCORE_SCOPE_LABELS: Record<ScoreScope, string> = {
  ACADEMIC: "Academic marks",
  GITHUB: "GitHub",
  CODING: "LeetCode / coding",
  PROJECTS: "Projects",
  INTERNSHIP: "Internships",
  EXTRAS: "Extras (certs, hackathons)",
};

/** Parse the stored JSON column; invalid/unknown entries are dropped. */
export function parseScopes(raw: string | null | undefined): ScoreScope[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    const set = new Set<ScoreScope>();
    for (const v of parsed) {
      if (typeof v === "string" && (SCORE_SCOPE_KEYS as readonly string[]).includes(v)) {
        set.add(v as ScoreScope);
      }
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

/** Serialize a scope list back to the JSON column format. */
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

/* ------------------------------- Category map ------------------------------ */

/**
 * Which scope each proof document category belongs to. Used to decide whether
 * a scoped coordinator may view/verify a specific document. Hackathons and
 * competitions are scored under EXTRAS.
 */
export const DOC_CATEGORY_SCOPE: Record<string, ScoreScope> = {
  TENTH_MARKSHEET: "ACADEMIC",
  TWELFTH_MARKSHEET: "ACADEMIC",
  CGPA_MARKSHEET: "ACADEMIC",
  INTERNSHIP: "INTERNSHIP",
  SKILL_CERT: "EXTRAS",
  COMPETITION: "EXTRAS",
  INHOUSE_PROJECT: "PROJECTS",
  MEMBERSHIP: "EXTRAS",
  SHL: "EXTRAS",
};

/** Which scope each project-link category belongs to. */
export const LINK_CATEGORY_SCOPE: Record<string, ScoreScope> = {
  PROJECT: "PROJECTS",
  FULLSTACK_PROJECT: "PROJECTS",
  INHOUSE_PROJECT_LINK: "PROJECTS",
};

export function docCategoryScope(category: string): ScoreScope {
  return DOC_CATEGORY_SCOPE[category] ?? "EXTRAS";
}

export function linkCategoryScope(category: string): ScoreScope {
  return LINK_CATEGORY_SCOPE[category] ?? "PROJECTS";
}
