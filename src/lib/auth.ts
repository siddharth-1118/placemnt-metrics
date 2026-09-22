import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export { hashPassword, verifyPassword };

/**
 * Lightweight session auth:
 *  - Passwords: scrypt (salt:hash, hex).
 *  - Sessions: signed stateless cookie (userId.expiry.hmac) — no extra table.
 *  - Authorization: only coordinators with evaluatorAssigned = true may access
 *    the evaluator dashboard/APIs. Everyone else sees only their own submission.
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
  evaluatorAssigned: boolean;
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
      evaluatorAssigned: true,
      fullName: true,
      registerNumber: true,
      email: true,
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    role: s.role === "COORDINATOR" ? "COORDINATOR" : "STUDENT",
    evaluatorAssigned: s.evaluatorAssigned,
    fullName: s.fullName,
    registerNumber: s.registerNumber,
    email: s.email,
  };
}

/** Guard for evaluator-only APIs. Returns the user or a NextResponse error. */
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
  if (user.role !== "COORDINATOR" || !user.evaluatorAssigned) {
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
