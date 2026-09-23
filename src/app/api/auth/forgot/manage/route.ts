import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
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
    select: { email: true, registerNumber: true, fullName: true, claimablePassword: true },
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
        awaitingClaim: account?.claimablePassword ?? false,
      };
    }),
  });
}

const resolveSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "resolve", "deny"]),
});

/**
 * POST /api/auth/forgot/manage — the coordinator VERIFIES the student's
 * identity and approves. Approval deletes the old password from the database
 * (hash cleared, claim flag set) — the student's next sign-in with their
 * registered email + any password they choose stores that password as their
 * permanent one. No password is ever generated, set, or sent by anyone.
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
  const action = parsed.data.action === "resolve" ? "approve" : parsed.data.action;

  const request = await prisma.passwordResetRequest.findUnique({ where: { id: parsed.data.id } });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "This request was already handled" }, { status: 409 });
  }

  if (action === "deny") {
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

  // APPROVE: kill the old password. The student claims their new permanent
  // password at their next sign-in (email + any password).
  await prisma.$transaction([
    prisma.student.update({
      where: { id: account.id },
      data: { passwordHash: null, claimablePassword: true },
    }),
    prisma.passwordResetRequest.update({
      where: { id: request.id },
      data: { status: "RESOLVED", resolvedById: user.id, resolvedAt: new Date() },
    }),
  ]);

  await notify({
    studentId: account.id,
    title: "Password reset approved",
    body: "Your old password was cleared. Sign in with your registered email and any new password — that password becomes yours permanently.",
    kind: "INFO",
  });

  return NextResponse.json({
    ok: true,
    approved: true,
    message: "Approved. The student signs in with their email + any password they choose — it becomes their permanent password.",
  });
}
