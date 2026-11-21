import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setStudentUnlock,
  revokeStudentUnlock,
  setGlobalStudentUnlock,
  revokeGlobalStudentUnlock,
  revokeAllStudentUnlocks,
  getAllStudentUnlocksState,
  getUnlockedSectionLabels,
  type UnlockableSection,
  UNLOCKABLE_SECTIONS_DEF,
} from "@/lib/student-unlock";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/unlock-batch
 * Retrieve all currently active student unlocks and global unlock status.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || (!user.canViewSubmissions && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const state = await getAllStudentUnlocksState();
  return NextResponse.json({
    globalUnlock: state.globalUnlock,
    isGlobalActive: state.isGlobalActive,
    unlocks: state.unlocks,
    count: state.count,
  });
}

/**
 * POST /api/students/unlock-batch
 * Unlock ALL students at once (allStudents: true) or a batch list of student IDs.
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

  const isAllStudents = body?.allStudents === true;
  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];

  if (!isAllStudents && studentIds.length === 0) {
    return NextResponse.json(
      { error: "Must specify allStudents: true or provide studentIds array" },
      { status: 422 }
    );
  }

  const sections: UnlockableSection[] = Array.isArray(body?.sections)
    ? body.sections.filter((s: string) => UNLOCKABLE_SECTIONS_DEF.some((def) => def.key === s))
    : ["ALL"];

  if (sections.length === 0) {
    return NextResponse.json(
      { error: "At least one section must be selected for unlock" },
      { status: 422 }
    );
  }

  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const sectionLabels = getUnlockedSectionLabels(sections);
  const byName = user.fullName || "Super Admin";

  // CASE 1: GLOBAL UNLOCK (ALL STUDENTS AT ONCE)
  if (isAllStudents) {
    const globalRecord = await setGlobalStudentUnlock({
      sections,
      reason,
      byName,
      byId: user.id,
    });

    // Notify all active students in the database (fire & forget / non-blocking)
    try {
      const allStudents = await prisma.student.findMany({
        select: { id: true },
      });
      if (allStudents.length > 0) {
        await prisma.notification.createMany({
          data: allStudents.map((s) => ({
            studentId: s.id,
            title: "⚡ Profile Edit Access Granted to All Students",
            body: `Super Admin has unlocked all students for editing: ${sectionLabels}. You can now update your details and re-upload documents.`,
            kind: "INFO",
          })),
        });
      }
    } catch {
      // ignore notification errors
    }

    return NextResponse.json({
      success: true,
      allStudents: true,
      globalUnlock: globalRecord,
      message: `Successfully granted edit access to ALL students (${sectionLabels})`,
    });
  }

  // CASE 2: BATCH LIST OF SPECIFIC STUDENTS
  for (const id of studentIds) {
    await setStudentUnlock(id, {
      sections,
      reason,
      byName,
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
    allStudents: false,
    unlockedCount: studentIds.length,
    message: `Granted edit access for ${studentIds.length} students (${sectionLabels})`,
  });
}

/**
 * DELETE /api/students/unlock-batch
 * Batch revoke unlocks for all students (allStudents: true) or multiple specific students.
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

  const isAllStudents = body?.allStudents === true;
  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];

  if (!isAllStudents && studentIds.length === 0) {
    return NextResponse.json(
      { error: "Must specify allStudents: true or provide studentIds array" },
      { status: 422 }
    );
  }

  if (isAllStudents) {
    await revokeAllStudentUnlocks();
    return NextResponse.json({
      success: true,
      allStudents: true,
      message: "Successfully locked all students — all edit permissions revoked",
    });
  }

  for (const id of studentIds) {
    await revokeStudentUnlock(id);
  }

  return NextResponse.json({
    success: true,
    allStudents: false,
    revokedCount: studentIds.length,
    message: `Revoked edit access for ${studentIds.length} students`,
  });
}
