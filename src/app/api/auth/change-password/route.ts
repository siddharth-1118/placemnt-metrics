import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(100),
});

/**
 * POST /api/auth/change-password — a signed-in user rotates their own
 * password (e.g. after logging in with a coordinator-issued temporary one).
 * The current password is required, so a hijacked session cannot silently
 * take over the account.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".") || "form"] = i.message;
    return NextResponse.json({ error: "Validation failed", fieldErrors: fe }, { status: 422 });
  }

  const row = await prisma.student.findUnique({ where: { id: user.id } });
  if (!row) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (!row.passwordHash || !verifyPassword(parsed.data.currentPassword, row.passwordHash)) {
    return NextResponse.json(
      { error: "Current password is incorrect", fieldErrors: { currentPassword: "Incorrect password" } },
      { status: 403 }
    );
  }

  await prisma.student.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.newPassword) },
  });

  return NextResponse.json({ ok: true, message: "Password updated — use it on your next sign in." });
}
