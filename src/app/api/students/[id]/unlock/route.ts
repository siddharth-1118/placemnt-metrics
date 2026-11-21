import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getStudentUnlock,
  setStudentUnlock,
  revokeStudentUnlock,
  getUnlockedSectionLabels,
  type UnlockableSection,
  UNLOCKABLE_SECTIONS_DEF,
} from "@/lib/student-unlock";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/students/[id]/unlock
 * Fetch current edit unlock status for a student.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const studentId = params.id;
  const isSelf = user.id === studentId;
  const isEvaluator = user.canViewSubmissions || user.isSuperAdmin;

  if (!isSelf && !isEvaluator) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const unlock = await getStudentUnlock(studentId);
  return NextResponse.json({
    studentId,
    isUnlocked: !!unlock && unlock.sections.length > 0,
    unlock,
    availableSections: UNLOCKABLE_SECTIONS_DEF,
  });
}

/**
 * POST /api/students/[id]/unlock
 * Grant or update edit access for a student (Super Admin & Evaluators).
 */
export async function POST(req: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (!user.isSuperAdmin && !user.canScore) {
    return NextResponse.json(
      { error: "Only Super Admins and authorized coordinators can unlock student sections" },
      { status: 403 }
    );
  }

  const studentId = params.id;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, registerNumber: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sections: UnlockableSection[] = Array.isArray(body?.sections)
    ? body.sections.filter((s: string) =>
        UNLOCKABLE_SECTIONS_DEF.some((def) => def.key === s)
      )
    : [];

  if (sections.length === 0) {
    return NextResponse.json(
      { error: "At least one section must be selected for unlock (or select 'ALL')" },
      { status: 422 }
    );
  }

  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const notify = body?.notify !== false;

  const unlockRecord = await setStudentUnlock(studentId, {
    sections,
    reason,
    byName: user.fullName || "Super Admin",
    byId: user.id,
  });

  const sectionLabels = getUnlockedSectionLabels(sections);

  // Send an in-app notification to the student so they know they have edit access
  if (notify) {
    try {
      await prisma.notification.create({
        data: {
          studentId,
          title: "Profile Edit Access Granted",
          body: `Super Admin (${user.fullName || "Coordinator"}) has unlocked your profile for editing: ${sectionLabels}.${
            reason ? ` Note: "${reason}"` : ""
          } You may now update your details in My Submission > Edit Profile.`,
          kind: "INFO",
        },
      });
    } catch {
      // transient notification failure should not block unlock
    }
  }

  return NextResponse.json({
    success: true,
    message: `Edit access successfully granted for: ${sectionLabels}`,
    unlock: unlockRecord,
  });
}

/**
 * DELETE /api/students/[id]/unlock
 * Revoke edit access / lock all sections for a student.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (!user.isSuperAdmin && !user.canScore) {
    return NextResponse.json(
      { error: "Only Super Admins and authorized coordinators can revoke student edit access" },
      { status: 403 }
    );
  }

  const studentId = params.id;
  await revokeStudentUnlock(studentId);

  // Send in-app notification
  try {
    await prisma.notification.create({
      data: {
        studentId,
        title: "Profile Edit Access Closed",
        body: `Your profile edit session has been closed by ${user.fullName || "Super Admin"}. Your current details and verified marks are saved.`,
        kind: "INFO",
      },
    });
  } catch {
    // transient
  }

  return NextResponse.json({
    success: true,
    message: "Student edit access revoked — all sections are now locked.",
  });
}
