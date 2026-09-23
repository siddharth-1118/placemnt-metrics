import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const directSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the account's email"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(100).optional(),
  /** When true the student gets an in-app notice that their password changed. */
  notifyStudent: z.boolean().optional(),
});

/**
 * POST /api/auth/forgot/direct — coordinator-initiated password reset for ANY
 * account (student or coordinator), even when the student never filed a
 * request. Generates a secure temporary password (or uses the provided one),
 * returns it ONCE in the response, and optionally notifies the student.
 */
export async function POST(req: Request) {
  const { user, error } = await requireEvaluator();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = directSchema.safeParse(body);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".") || "form"] = i.message;
    return NextResponse.json({ error: "Validation failed", fieldErrors: fe }, { status: 422 });
  }

  const account = await prisma.student.findUnique({ where: { email: parsed.data.email } });
  if (!account) {
    return NextResponse.json({ error: "No account exists with this email" }, { status: 404 });
  }

  const tempPassword =
    parsed.data.newPassword ??
    `SRM-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}!`;

  await prisma.student.update({
    where: { id: account.id },
    data: { passwordHash: hashPassword(tempPassword) },
  });

  if (parsed.data.notifyStudent !== false) {
    await notify({
      studentId: account.id,
      title: "Password reset by coordinator",
      body:
        account.id === user.id
          ? "Your password was changed."
          : "Your password was reset by a coordinator. Sign in with the new password they gave you.",
      kind: "INFO",
    });
  }

  return NextResponse.json({
    ok: true,
    account: { fullName: account.fullName, email: account.email, registerNumber: account.registerNumber },
    tempPassword,
  });
}
