import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  registerNumber: z
    .string()
    .trim()
    .min(4, "Register number is too short")
    .max(20, "Register number is too long")
    .transform((v) => v.toUpperCase()),
});

/**
 * POST /api/auth/forgot — a student who forgot their password files a reset
 * request with name + email + register number. The response is intentionally
 * identical whether or not the account exists (no account enumeration).
 * A coordinator resolves the request: they verify the student's identity,
 * then issue a new password from the dashboard.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".") || "form"] = i.message;
    return NextResponse.json({ error: "Validation failed", fieldErrors: fe }, { status: 422 });
  }

  // Best-effort matching for the coordinator's convenience, but never an
  // error from the requester's point of view.
  let matches = false;
  try {
    const account = await prisma.student.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, registerNumber: true },
    });
    matches = account !== null && account.registerNumber === parsed.data.registerNumber;
  } catch {
    // DB lookup hiccup must not block the request — coordinator verifies manually.
  }

  try {
    await prisma.passwordResetRequest.create({
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        registerNumber: parsed.data.registerNumber,
        note: matches ? null : "Details do not match an existing account — verify manually",
      },
    });
  } catch (err) {
    // Most likely the PasswordResetRequest table doesn't exist yet (deployed
    // database not migrated). Log loudly server-side but still accept the
    // student's submission so they aren't stuck — the coordinator panel and
    // the direct-reset tool remain available to fix the password.
    console.error("[forgot] could not persist reset request:", (err as Error).message);
    return NextResponse.json({
      ok: true,
      degraded: true,
      message:
        "Request noted. Ask your coordinator to reset your password directly from their dashboard — they can issue a new one for your email.",
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Request sent. Your coordinator will verify your details and issue a new password — collect it from them.",
  });
}
