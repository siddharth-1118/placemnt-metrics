import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { parseScopes, serializeScopes, SCORE_SCOPE_KEYS } from "@/lib/scopes";

export const dynamic = "force-dynamic";

/**
 * Super-admin-only coordinator management.
 *
 * The super admin can:
 *  - assign an EXISTING student (someone who submitted a profile) as a
 *    coordinator — no passwords are created or shared; the promoted student
 *    signs in with the email + password they already have,
 *  - grant/revoke what each coordinator can see and do
 *    (view submissions / score & verify / per-section scopes),
 *  - revoke coordinator access (the account returns to a normal student and
 *    their submission is kept — nothing is deleted).
 */

const scopesSchema = z
  .array(z.enum(SCORE_SCOPE_KEYS))
  .max(SCORE_SCOPE_KEYS.length)
  .optional();

const assignSchema = z.object({
  // Email of an existing submission — the account is promoted, never created.
  email: z.string().trim().toLowerCase().email("Enter the student's email").max(120),
  // Which rubric sections this coordinator can view & score. Omitted/empty = ALL.
  permissionScopes: scopesSchema,
  // Explicitly grant scoring even with no section restrictions (full scorer).
  canScore: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  canViewSubmissions: z.boolean().optional(),
  canScore: z.boolean().optional(),
  // Empty array = unrestricted. A coordinator with at least one scope gets
  // canScore=true automatically (scoped coordinators score their sections).
  permissionScopes: scopesSchema,
});

const revokeSchema = z.object({ id: z.string().min(1) });

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
  permissionScopes: string;
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
    permissionScopes: parseScopes(s.permissionScopes),
    hasPassword: !!s.passwordHash,
    awaitingClaim: s.claimablePassword,
    createdAt: s.createdAt.toISOString(),
  };
}

/** GET /api/admin/coordinators            — list all coordinator accounts. */
/** GET /api/admin/coordinators?search=xy  — find students eligible for assignment. */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const search = new URL(req.url).searchParams.get("search")?.trim();
  if (search) {
    // Assignment picker: students who have submitted and are not already
    // coordinators. Small batch, so filter in memory (case-insensitive).
    const q = search.toLowerCase();
    const rows = await prisma.student.findMany({
      where: { role: { not: "COORDINATOR" } },
      select: { id: true, email: true, fullName: true, registerNumber: true },
      orderBy: { fullName: "asc" },
      take: 2000,
    });
    const candidates = rows
      .filter(
        (s) =>
          s.email.toLowerCase().includes(q) ||
          s.registerNumber.toLowerCase().includes(q) ||
          s.fullName.toLowerCase().includes(q)
      )
      .slice(0, 10);
    return NextResponse.json({ candidates });
  }

  const rows = await prisma.student.findMany({
    where: { role: "COORDINATOR" },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ coordinators: rows.map(coordinatorDto) });
}

/**
 * POST /api/admin/coordinators — promote an existing student to coordinator.
 * The student keeps their own email + password; nothing about their
 * submission (marks, documents, scores) changes, except they now appear in
 * the batch leaderboard as a candidate too (existing behaviour for
 * coordinators with real marks).
 */
export async function POST(req: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".") || "form"] = i.message;
    return NextResponse.json({ error: "Validation failed", fieldErrors: fe }, { status: 422 });
  }

  const { email } = parsed.data;
  const student = await prisma.student.findUnique({ where: { email } });
  if (!student) {
    return NextResponse.json(
      { error: "No submission found with this email — only students who submitted their application can be assigned." },
      { status: 404 }
    );
  }
  if (student.role === "COORDINATOR") {
    return NextResponse.json(
      { error: `${student.fullName} is already a coordinator.` },
      { status: 409 }
    );
  }

  const scopes = parsed.data.permissionScopes ?? [];
  const promoted = await prisma.student.update({
    where: { id: student.id },
    data: {
      role: "COORDINATOR",
      evaluatorAssigned: true,
      canViewSubmissions: true,
      // Scoped coordinators may score their assigned sections; with no scopes
      // the coordinator is view-only unless canScore was explicitly requested
      // (full scorer).
      canScore: parsed.data.canScore ?? scopes.length > 0,
      permissionScopes: serializeScopes(scopes),
    },
  });

  return NextResponse.json({ coordinator: coordinatorDto(promoted) }, { status: 201 });
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

  // canScore implies canViewSubmissions. Updating scopes also flips canScore
  // on when the coordinator gains at least one section (a scoped coordinator
  // needs canScore to reach the verify/score APIs), and off when the list is
  // emptied only if the request explicitly turned scoring off — an empty
  // array alone means "full access", never "no access".
  const nextScopes =
    parsed.data.permissionScopes !== undefined
      ? serializeScopes(parsed.data.permissionScopes)
      : target.permissionScopes;
  const scopeCount = parseScopes(nextScopes).length;
  const canScore = parsed.data.canScore ?? (scopeCount > 0 ? true : target.canScore);
  const canViewSubmissions = parsed.data.canViewSubmissions ?? (target.canViewSubmissions || canScore);

  const updated = await prisma.student.update({
    where: { id: target.id },
    data: {
      canScore,
      canViewSubmissions: canViewSubmissions || canScore,
      evaluatorAssigned: canViewSubmissions || canScore,
      permissionScopes: nextScopes,
    },
  });

  return NextResponse.json({ coordinator: coordinatorDto(updated) });
}

/**
 * DELETE /api/admin/coordinators — revoke coordinator access.
 * The account DEMOTES back to a normal student: their submission, marks,
 * documents and password all stay. Nothing is deleted. (Promoted accounts
 * carry real submissions behind them, so destroying the row here would
 * erase a student's application.)
 */
export async function DELETE(req: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const target = await prisma.student.findUnique({ where: { id: parsed.data.id } });
  if (!target || target.role !== "COORDINATOR") {
    return NextResponse.json({ error: "Coordinator not found" }, { status: 404 });
  }
  if (target.isSuperAdmin) {
    return NextResponse.json(
      { error: "A super admin account cannot be revoked from the portal" },
      { status: 403 }
    );
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "You cannot revoke your own access" }, { status: 400 });
  }

  await prisma.student.update({
    where: { id: target.id },
    data: {
      role: "STUDENT",
      evaluatorAssigned: false,
      canViewSubmissions: false,
      canScore: false,
      permissionScopes: "[]",
    },
  });
  return NextResponse.json({ ok: true });
}
