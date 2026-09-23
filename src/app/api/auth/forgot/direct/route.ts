import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const directSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the account's email"),
});

/**
 * POST /api/auth/forgot/direct — coordinator-initiated reset for ANY account,
 * even when the student never filed a request. Approving clears the old
 * password; the student's next sign-in with their email + any password they
 * choose stores that as their permanent password. Nothing is generated or
 * sent — the student picks their own password at sign-in.
 */
export async function POST(req: Request) {
  const { error } = await requireEvaluator();
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

  await prisma.student.update({
    where: { id: account.id },
    data: { passwordHash: null, claimablePassword: true },
  });

  await notify({
    studentId: account.id,
    title: "Password reset approved",
    body: "Your old password was cleared. Sign in with your registered email and any new password — that password becomes yours permanently.",
    kind: "INFO",
  });

  return NextResponse.json({
    ok: true,
    approved: true,
    account: { fullName: account.fullName, email: account.email, registerNumber: account.registerNumber },
    message: "Approved. The student signs in with their email + any password they choose.",
  });
}
