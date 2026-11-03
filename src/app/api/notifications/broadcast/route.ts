import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { auditStudentDocuments, docCategoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/broadcast
 *
 * Allows placement coordinators to broadcast in-app notifications to students:
 * - Specific to students with missing mandatory documents (auto-personalized with exact missing items)
 * - Specific to students missing a particular document category/topic
 * - To candidates with zero uploaded documents
 * - Or general announcements to all registered students
 */
export async function POST(req: Request) {
  const { user, error } = await requireEvaluator();
  if (error) return error;

  let body: {
    target?: "MISSING_MANDATORY" | "MISSING_TOPIC" | "ALL_STUDENTS" | "ZERO_UPLOADS";
    topicCategory?: string;
    customTitle?: string;
    customMessage?: string;
    kind?: "WARNING" | "INFO";
    studentIds?: string[];
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const target = body.target || "MISSING_MANDATORY";
  const kind = body.kind === "INFO" ? "INFO" : "WARNING";

  // Query all eligible students (excluding pure faculty coordinators)
  const students = await prisma.student.findMany({
    where: {
      NOT: {
        registerNumber: { startsWith: "COORD-" },
      },
      ...(body.studentIds && body.studentIds.length > 0 ? { id: { in: body.studentIds } } : {}),
    },
    include: {
      documents: true,
    },
  });

  const notificationsToSend: { studentId: string; title: string; body: string; kind: string }[] = [];
  const recipientNames: string[] = [];

  for (const student of students) {
    const audit = auditStudentDocuments(student.documents);
    let shouldSend = false;
    let missingList: string[] = [];

    if (target === "MISSING_MANDATORY") {
      if (audit.missingCount > 0) {
        shouldSend = true;
        missingList = audit.missingDocLabels;
      }
    } else if (target === "ZERO_UPLOADS") {
      if (!student.documents || student.documents.length === 0) {
        shouldSend = true;
        missingList = ["All verification documents (zero uploaded)"];
      }
    } else if (target === "MISSING_TOPIC" && body.topicCategory) {
      const hasCategory = (student.documents ?? []).some(
        (d) => d.category === body.topicCategory && d.status !== "REJECTED"
      );
      if (!hasCategory) {
        shouldSend = true;
        missingList = [docCategoryLabel(body.topicCategory)];
      }
    } else if (target === "ALL_STUDENTS") {
      shouldSend = true;
      missingList = audit.missingCount > 0 ? audit.missingDocLabels : [];
    }

    if (shouldSend) {
      const defaultTitle =
        missingList.length > 0
          ? `⚠️ Action Required: Upload Missing Placement Documents`
          : `📢 Placement Notice from Coordinators`;

      const missingText = missingList.length > 0 ? missingList.join(", ") : "required documents";
      const defaultBody =
        missingList.length > 0
          ? `Dear ${student.fullName}, our records show you have not yet uploaded: ${missingText}. Please log in and upload these verification files immediately.`
          : `Dear ${student.fullName}, please ensure your placement documents and profile details are up to date.`;

      let finalBody = body.customMessage && body.customMessage.trim().length > 0 ? body.customMessage : defaultBody;
      finalBody = finalBody
        .replaceAll("{name}", student.fullName)
        .replaceAll("{missing_documents}", missingText)
        .replaceAll("{register_number}", student.registerNumber);

      notificationsToSend.push({
        studentId: student.id,
        title: (body.customTitle && body.customTitle.trim().length > 0 ? body.customTitle : defaultTitle)
          .replaceAll("{name}", student.fullName)
          .replaceAll("{missing_documents}", missingText),
        body: finalBody,
        kind,
      });

      recipientNames.push(`${student.fullName} (${student.registerNumber})`);
    }
  }

  if (notificationsToSend.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      message: "No students match the criteria for this notification.",
      recipients: [],
    });
  }

  // Persist notifications using transaction for atomicity and SQLite/Postgres compatibility
  await prisma.$transaction(
    notificationsToSend.map((n) =>
      prisma.notification.create({
        data: {
          studentId: n.studentId,
          title: n.title,
          body: n.body,
          kind: n.kind,
        },
      })
    )
  );

  return NextResponse.json({
    success: true,
    count: notificationsToSend.length,
    message: `Successfully dispatched notifications to ${notificationsToSend.length} students.`,
    recipients: recipientNames,
  });
}
