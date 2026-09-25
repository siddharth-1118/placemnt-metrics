import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Super-admin-only coordinator management.
 *
 * The super admin can:
 *  - create coordinator accounts by email (+ name + initial password),
 *  - grant/revoke what each coordinator can see and do
 *    (view submissions / score & verify),
 *  - delete coordinator accounts.
 *
 * Students (role !== COORDINATOR) are never listed or mutated here.
 */

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  fullName: z.string().trim().min(3, "Enter the coordinator's full name").max(80),
  registerNumber: z
    .string()
    .trim()
    .min(4, "Register number / staff ID is too short")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Only letters, digits and hyphens")
    .transform((v) => v.toUpperCase()),
  password: z.string().min(8, "Initial password must be at least 8 characters").max(100),
});

const updateSchema = z.object({
  id: z.string().min(1),
  canViewSubmissions: z.boolean().optional(),
  canScore: z.boolean().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  if (!user.isSuperAdmin) {
    return { user: null, error: NextResponse.json({ error: "Super admin only" }, { status: 403 }) };
  }
  return { user, error: null };
}

function coordinatorDto(s: {
  id: string;
  email: string;
  fullName: string;
  registerNumber: string;
  isSuperAdmin: boolean;
  canViewSubmissions: boolean;
  canScore: boolean;
  passwordHash: string | null;
  claimablePassword: boolean;
  createdAt: Date;
}) {
  return {
    id: s.id,
    email: s.email,
    fullName: s.fullName,
    registerNumber: s.registerNumber,
    isSuperAdmin: s.isSuperAdmin,
    canViewSubmissions: s.canViewSubmissions || s.canScore,
    canScore: s.canScore,
    hasPassword: !!s.passwordHash,
    awaitingClaim: s.claimablePassword,
    createdAt: s.createdAt.toISOString(),
  };
}

/** GET /api/admin/coordinators — list all coordinator accounts. */
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const rows = await prisma.student.findMany({
    where: { role: "COORDINATOR" },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ coordinators: rows.map(coordinatorDto) });
}

/** POST /api/admin/coordinators — create a coordinator account. */
export async function POST(req: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".") || "form"] = i.message;
    return NextResponse.json({ error: "Validation failed", fieldErrors: fe }, { status: 422 });
  }

  const { email, fullName, registerNumber, password } = parsed.data;

  const clash =
    (await prisma.student.findUnique({ where: { email }, select: { id: true } })) ??
    (await prisma.student.findUnique({ where: { registerNumber }, select: { id: true } }));
  if (clash) {
    return NextResponse.json(
      { error: "An account with this email or register number already exists" },
      { status: 409 }
    );
  }

  const created = await prisma.student.create({
    data: {
      email,
      fullName,
      registerNumber,
      // Placeholder marks — coordinator accounts are not placement candidates
      // unless they submit their own profile.
      tenthPercent: 0,
      twelfthPercent: 0,
      cgpa: 0,
      role: "COORDINATOR",
      evaluatorAssigned: true,
      canViewSubmissions: true,
      canScore: false,
      passwordHash: hashPassword(password),
    },
  });

  return NextResponse.json({ coordinator: coordinatorDto(created) }, { status: 201 });
}

/** PATCH /api/admin/coordinators — grant/revoke permissions. */
export async function PATCH(req: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const target = await prisma.student.findUnique({ where: { id: parsed.data.id } });
  if (!target || target.role !== "COORDINATOR") {
    return NextResponse.json({ error: "Coordinator not found" }, { status: 404 });
  }
  if (target.isSuperAdmin && target.id !== user.id) {
    return NextResponse.json(
      { error: "Another super admin's permissions cannot be changed here" },
      { status: 403 }
    );
  }

  // canScore implies canViewSubmissions.
  const canScore = parsed.data.canScore ?? target.canScore;
  const canViewSubmissions = parsed.data.canViewSubmissions ?? (target.canViewSubmissions || canScore);

  const updated = await prisma.student.update({
    where: { id: target.id },
    data: {
      canScore,
      canViewSubmissions: canViewSubmissions || canScore,
      evaluatorAssigned: canViewSubmissions || canScore,
    },
  });

  return NextResponse.json({ coordinator: coordinatorDto(updated) });
}

/** DELETE /api/admin/coordinators — remove a coordinator account. */
export async function DELETE(req: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const target = await prisma.student.findUnique({ where: { id: parsed.data.id } });
  if (!target || target.role !== "COORDINATOR") {
    return NextResponse.json({ error: "Coordinator not found" }, { status: 404 });
  }
  if (target.isSuperAdmin) {
    return NextResponse.json(
      { error: "A super admin account cannot be deleted from the portal" },
      { status: 403 }
    );
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  await prisma.student.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
