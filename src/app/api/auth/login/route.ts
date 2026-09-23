import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword, setSessionCookie, getSessionUser, clearSessionCookie,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/** POST /api/auth/login — any account (student or coordinator) may sign in. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 422 });
  }

  const s = await prisma.student.findUnique({ where: { email: parsed.data.email } });
  if (!s) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // CLAIM FLOW: after a coordinator approves a password-reset request, the old
  // hash is deleted (passwordHash = null, claimablePassword = true). The very
  // next sign-in with the registered email — whatever password the user
  // types — becomes their permanent password. Nothing is sent to anyone.
  if (!s.passwordHash && s.claimablePassword) {
    await prisma.student.update({
      where: { id: s.id },
      data: { passwordHash: hashPassword(parsed.data.password), claimablePassword: false },
    });
    await setSessionCookie(s.id);
    return NextResponse.json({
      user: {
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        registerNumber: s.registerNumber,
        role: s.role,
        evaluatorAssigned: s.evaluatorAssigned,
      },
      passwordClaimed: true,
    });
  }

  if (!s.passwordHash || !verifyPassword(parsed.data.password, s.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await setSessionCookie(s.id);
  return NextResponse.json({
    user: {
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      registerNumber: s.registerNumber,
      role: s.role,
      evaluatorAssigned: s.evaluatorAssigned,
    },
  });
}

/** GET /api/auth/login — current session user (null when signed out). */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}

/** DELETE /api/auth/login — sign out. */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
