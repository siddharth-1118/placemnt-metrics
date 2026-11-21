import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setStudentUnlock,
  revokeStudentUnlock,
  getAllStudentUnlocks,
  getUnlockedSectionLabels,
  type UnlockableSection,
  UNLOCKABLE_SECTIONS_DEF,
} from "@/lib/student-unlock";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/unlock-batch
 * Retrieve all currently active student unlocks.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || (!user.canViewSubmissions && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const unlocks = await getAllStudentUnlocks();
  return NextResponse.json({
    unlocks,
    count: Object.keys(unlocks).length,
  });
}

/**
 * POST /api/students/unlock-batch
 * Batch unlock multiple students at once.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || (!user.isSuperAdmin && !user.canScore)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
  if (studentIds.length === 0) {
    return NextResponse.json({ error: "No student IDs provided" }, { status: 422 });
  }

  const sections: UnlockableSection[] = Array.isArray(body?.sections)
    ? body.sections.filter((s: string) => UNLOCKABLE_SECTIONS_DEF.some((def) => def.key === s))
    : ["ALL"];

  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const sectionLabels = getUnlockedSectionLabels(sections);

  for (const id of studentIds) {
    await setStudentUnlock(id, {
      sections,
      reason,
      byName: user.fullName || "Super Admin",
      byId: user.id,
    });

    try {
      await prisma.notification.create({
        data: {
          studentId: id,
          title: "Profile Edit Access Granted",
          body: `Super Admin has unlocked your profile for editing: ${sectionLabels}.`,
          kind: "INFO",
        },
      });
    } catch {}
  }

  return NextResponse.json({
    success: true,
    unlockedCount: studentIds.length,
    message: `Granted edit access for ${studentIds.length} students (${sectionLabels})`,
  });
}

/**
 * DELETE /api/students/unlock-batch
 * Batch revoke unlocks for multiple students.
 */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || (!user.isSuperAdmin && !user.canScore)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
  if (studentIds.length === 0) {
    return NextResponse.json({ error: "No student IDs provided" }, { status: 422 });
  }

  for (const id of studentIds) {
    await revokeStudentUnlock(id);
  }

  return NextResponse.json({
    success: true,
    revokedCount: studentIds.length,
    message: `Revoked edit access for ${studentIds.length} students`,
  });
}
