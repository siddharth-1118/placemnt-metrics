import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  canWriteScoreField,
  docCategoryScope,
  hasScope,
  isSharedScoreField,
  linkCategoryScope,
  parseScopes,
  SCORE_FIELD_VIEW_SCOPE,
  scopesAreFull,
  serializeScopes,
  type ScoreScope,
} from "@/lib/scopes";

export { hashPassword, verifyPassword };

/**
 * Lightweight session auth:
 *  - Passwords: scrypt (salt:hash, hex).
 *  - Sessions: signed stateless cookie (userId.expiry.hmac) — no extra table.
 *  - Authorization: three tiers.
 *      SUPER_ADMIN  — everything + coordinator management (never through APIs)
 *      COORDINATOR  — gated by per-coordinator permissions (canViewSubmissions,
 *                     canScore; canScore implies canViewSubmissions)
 *      STUDENT      — own submission only.
 */

export const SESSION_COOKIE = "srm_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function createSessionValue(userId: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const payload = `${userId}.${expStr}`;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return userId;
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  // Values are URL-safe by construction (cuid + timestamp + hex HMAC).
  jar.set(SESSION_COOKIE, cookieSafe(createSessionValue(userId)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** cuids contain alphanumerics only — kept as a defensive URL-safe filter. */
function cookieSafe(v: string): string {
  return /^[A-Za-z0-9_.-]+$/.test(v) ? v : Buffer.from(v).toString("base64url");
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export interface SessionUser {
  id: string;
  role: "STUDENT" | "COORDINATOR";
  isSuperAdmin: boolean;
  evaluatorAssigned: boolean;
  /** May open the leaderboard / inspect student submissions. */
  canViewSubmissions: boolean;
  /** May score and verify documents & links (implies canViewSubmissions). */
  canScore: boolean;
  /** Score-section scopes: empty = ALL sections. See src/lib/scopes.ts. */
  permissionScopes: ScoreScope[];
  fullName: string;
  registerNumber: string;
  email: string;
}

/** Resolve the logged-in user from the session cookie (null if none). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = readSessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;

  const s = await prisma.student.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isSuperAdmin: true,
      evaluatorAssigned: true,
      canViewSubmissions: true,
      canScore: true,
      permissionScopes: true,
      fullName: true,
      registerNumber: true,
      email: true,
    },
  });
  if (!s) return null;
  const role = s.role === "COORDINATOR" ? "COORDINATOR" : "STUDENT";
  // canScore implies canViewSubmissions; super admin passes every check.
  const canViewSubmissions =
    s.isSuperAdmin || (role === "COORDINATOR" && (s.canViewSubmissions || s.canScore));
  const canScore = s.isSuperAdmin || (role === "COORDINATOR" && s.canScore);
  return {
    id: s.id,
    role,
    isSuperAdmin: s.isSuperAdmin,
    evaluatorAssigned: canViewSubmissions,
    canViewSubmissions,
    canScore,
    permissionScopes: parseScopes(s.permissionScopes),
    fullName: s.fullName,
    registerNumber: s.registerNumber,
    email: s.email,
  };
}

/**
 * Server-side scope helpers — an API may pass any SessionUser-shaped object.
 * Super admin and coordinators with an empty scope list pass every check.
 */
export { canWriteScoreField, hasScope, isSharedScoreField, parseScopes, serializeScopes };
export type { ScoreScope };

/**
 * View a StudentDto-like object through the viewer's permission scopes.
 * EVERYTHING outside the viewer's sections is stripped server-side, so a
 * scoped coordinator never even receives the hidden data:
 *
 *  - documents/links outside their sections are removed item-by-item
 *  - 10th/12th/CGPA marks vanish without the ACADEMIC scope
 *  - the GitHub/LeetCode profile URLs and scrape payloads vanish without
 *    the GITHUB / CODING scopes
 *  - per-section scores outside their sections are zeroed (and the total is
 *    re-summed from the visible sections only)
 *  - generic achievement proof links are hidden from all scoped viewers
 *
 * Unrestricted viewers (super admin, or an empty scope list) get everything
 * unchanged — the super admin always sees the full profile.
 */
export function filterStudentDtoForUser<
  TStudent extends {
    documents?: { category: string }[];
    projectLinks?: { category: string }[];
  },
>(
  student: TStudent,
  user: { isSuperAdmin: boolean; permissionScopes?: ScoreScope[] | null }
): TStudent {
  if (user.isSuperAdmin) return student;
  const scopes = user.permissionScopes ?? [];
  if (scopesAreFull(scopes)) return student; // unrestricted — return as-is

  const s = student as unknown as {
    tenthPercent: number;
    twelfthPercent: number;
    cgpa: number;
    githubUrl: string | null;
    leetcodeUrl: string | null;
    proofUrls: unknown[];
    scores?: Record<string, number>;
    scrapes?: { platform: string }[];
  };
  const scoreOf = (field: string): number =>
    hasScope(user, SCORE_FIELD_VIEW_SCOPE[field]) ? (s.scores?.[field] ?? 0) : 0;

  const visibleScores: Record<string, number> = {};
  for (const field of Object.keys(SCORE_FIELD_VIEW_SCOPE)) {
    visibleScores[field] = scoreOf(field);
  }
  const total = Object.values(visibleScores).reduce((a, b) => a + b, 0);

  return {
    ...student,
    // Academic marks — ACADEMIC scope only.
    tenthPercent: hasScope(user, "ACADEMIC") ? s.tenthPercent : 0,
    twelfthPercent: hasScope(user, "ACADEMIC") ? s.twelfthPercent : 0,
    cgpa: hasScope(user, "ACADEMIC") ? s.cgpa : 0,
    // Profile URLs — their own section's scope only.
    githubUrl: hasScope(user, "GITHUB") ? s.githubUrl : null,
    leetcodeUrl: hasScope(user, "CODING") ? s.leetcodeUrl : null,
    // Generic achievement proof links belong to no single section.
    proofUrls: [],
    documents: (student.documents ?? []).filter((d) =>
      hasScope(user, docCategoryScope(d.category))
    ),
    projectLinks: (student.projectLinks ?? []).filter((l) =>
      hasScope(user, linkCategoryScope(l.category))
    ),
    scores: { ...visibleScores, total } as unknown as TStudent,
    // Scrape payloads — each platform behind its own scope.
    scrapes: (s.scrapes ?? []).filter((sc) =>
      hasScope(user, sc.platform === "GITHUB" ? "GITHUB" : "CODING")
    ),
  } as TStudent;
}

/** Guard for all evaluator APIs — view level. */
export async function requireEvaluator(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: Response.json(
        { error: "Sign in required" },
        { status: 401 }
      ),
    };
  }
  if (!user.canViewSubmissions) {
    return {
      user: null,
      error: Response.json(
        { error: "You are not assigned to the evaluation task" },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

/** Guard for mutation APIs (scores, verification, deletes, resets, settings). */
export async function requireScorer(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: Response.json(
        { error: "Sign in required" },
        { status: 401 }
      ),
    };
  }
  if (!user.canScore) {
    return {
      user: null,
      error: Response.json(
        { error: "You do not have permission to change evaluations" },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

/** True when this user may bypass the submissions kill-switch. */
export function isEvaluatorUser(user: SessionUser | null): boolean {
  return !!user?.canViewSubmissions;
}
