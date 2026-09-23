import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** GET /api/auth/forgot/manage — all reset requests, newest first. */
export async function GET() {
  const { error } = await requireEvaluator();
  if (error) return error;

  const requests = await prisma.passwordResetRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Cross-check each request against real accounts so the coordinator can
  // spot mismatches at a glance.
  const accounts = await prisma.student.findMany({
    where: { email: { in: requests.map((r) => r.email) } },
    select: { email: true, registerNumber: true, fullName: true },
  });
  const byEmail = new Map(accounts.map((a) => [a.email, a]));

  return NextResponse.json({
    requests: requests.map((r) => {
      const account = byEmail.get(r.email);
      return {
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        registerNumber: r.registerNumber,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        matchesAccount: !!account && account.registerNumber === r.registerNumber,
        accountName: account?.fullName ?? null,
      };
    }),
  });
}

const resolveSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["resolve", "deny"]),
  /** Optional: coordinator-chosen password. A secure temp one is generated when omitted. */
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(100).optional(),
});

/**
 * POST /api/auth/forgot/manage — resolve a request by setting a new password
 * on the matched account (returned ONCE in the response so the coordinator
 * can hand it to the student), or deny it. The student gets a notification.
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
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const request = await prisma.passwordResetRequest.findUnique({ where: { id: parsed.data.id } });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "This request was already handled" }, { status: 409 });
  }

  if (parsed.data.action === "deny") {
    await prisma.passwordResetRequest.update({
      where: { id: request.id },
      data: { status: "DENIED", resolvedById: user.id, resolvedAt: new Date() },
    });
    return NextResponse.json({ ok: true, denied: true });
  }

  const account = await prisma.student.findUnique({ where: { email: request.email } });
  if (!account) {
    return NextResponse.json(
      { error: "No account exists with this email — verify the student's details" },
      { status: 404 }
    );
  }

  const tempPassword =
    parsed.data.newPassword ??
    `SRM-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}!`;

  await prisma.student.update({
    where: { id: account.id },
    data: { passwordHash: hashPassword(tempPassword) },
  });
  await prisma.passwordResetRequest.update({
    where: { id: request.id },
    data: { status: "RESOLVED", resolvedById: user.id, resolvedAt: new Date() },
  });
  await notify({
    studentId: account.id,
    title: "Password reset",
    body: "Your password was reset by a coordinator. Sign in with the new password they gave you.",
    kind: "INFO",
  });

  return NextResponse.json({ ok: true, tempPassword });
}
