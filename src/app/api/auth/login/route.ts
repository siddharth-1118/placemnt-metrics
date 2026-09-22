import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword, setSessionCookie, getSessionUser, clearSessionCookie,
} from "@/lib/auth";

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
  if (!s || !s.passwordHash || !verifyPassword(parsed.data.password, s.passwordHash)) {
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
