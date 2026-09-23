import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between successful resets

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  registerNumber: z
    .string()
    .trim()
    .min(4, "Register number is too short")
    .max(20, "Register number is too long")
    .transform((v) => v.toUpperCase()),
  tenthPercent: z.coerce.number().min(0).max(100),
  twelfthPercent: z.coerce.number().min(0).max(100),
  cgpa: z.coerce.number().min(0).max(10),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(100),
});

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]!.trim() : null) ?? "unknown";
}

/**
 * POST /api/auth/self-reset — instant, delivery-free password reset.
 *
 * The student proves identity with the exact academic marks on their own
 * submission (10th, 12th, CGPA) — data only they (and the coordinator) know.
 * Marks are compared with a tight tolerance (0.01) since students may round
 * when typing.
 *
 * Guards:
 *  - 5 attempts per IP+email per 15 min (enum/brute-force resistance)
 *  - 10-minute cooldown between successful resets per account
 *  - response is identical for "no such account" vs "wrong marks" (no enumeration)
 *  - same-account session cookies are NOT invalidated; the student just signs
 *    in with the new password on their next visit
 *  - coordinator notification channel stays untouched — this is fully
 *    self-service; nothing needs to be sent to anyone
 */
export async function POST(req: Request) {
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

  const ip = clientIp(req);
  const d = parsed.data;

  // Rate limit per IP+email, independent of whether the account exists.
  const recent = await prisma.passwordResetRequest.count({
    where: {
      email: d.email,
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
      note: { contains: `ip:${ip}` },
    },
  });
  if (recent >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts — wait 15 minutes and try again, or ask your coordinator." },
      { status: 429 }
    );
  }

  const account = await prisma.student.findUnique({ where: { email: d.email } });

  const marksMatch =
    account !== null &&
    Math.abs(account.tenthPercent - d.tenthPercent) < 0.011 &&
    Math.abs(account.twelfthPercent - d.twelfthPercent) < 0.011 &&
    Math.abs(account.cgpa - d.cgpa) < 0.011 &&
    account.registerNumber === d.registerNumber;

  if (!account || !marksMatch) {
    // Audit the attempt (also feeds the rate limiter). The note distinguishes
    // failure kinds for the coordinator panel without leaking anything here.
    await prisma.passwordResetRequest.create({
      data: {
        fullName: "(self-reset attempt)",
        email: d.email,
        registerNumber: d.registerNumber,
        status: "DENIED",
        note: `ip:${ip} · failed identity proof`,
      },
    });
    return NextResponse.json(
      { error: "The details don't match our records. Check your register number and exact marks — or send a coordinator request below." },
      { status: 403 }
    );
  }

  // Successful identity proof — enforce the cooldown per account.
  const lastResolved = await prisma.passwordResetRequest.findFirst({
    where: { email: d.email, status: "RESOLVED", resolvedAt: { not: null } },
    orderBy: { resolvedAt: "desc" },
  });
  if (lastResolved?.resolvedAt && Date.now() - lastResolved.resolvedAt.getTime() < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Your password was reset recently — wait 10 minutes, or ask your coordinator for help." },
      { status: 429 }
    );
  }

  await prisma.$transaction([
    prisma.student.update({
      where: { id: account.id },
      data: { passwordHash: hashPassword(d.newPassword) },
    }),
    prisma.passwordResetRequest.create({
      data: {
        fullName: account.fullName,
        email: d.email,
        registerNumber: d.registerNumber,
        status: "RESOLVED",
        resolvedAt: new Date(),
        note: `ip:${ip} · self-reset via identity proof (marks verified)`,
      },
    }),
  ]);

  await notify({
    studentId: account.id,
    title: "Password changed via self-reset",
    body: "Your password was just changed using identity verification. If this wasn't you, contact your coordinator immediately.",
    kind: "WARNING",
  });

  return NextResponse.json({
    ok: true,
    message: "Password updated. Sign in with your email and new password now.",
  });
}
