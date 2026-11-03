import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { auditStudentDocuments, docCategoryLabel } from "@/lib/categories";
import {
  buildPlacementReminderHtml,
  getEmailConfigInfo,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/send-email
 * Returns the current email server configuration status.
 */
export async function GET() {
  const { error } = await requireEvaluator();
  if (error) return error;

  return NextResponse.json({
    configured: isEmailConfigured(),
    info: getEmailConfigInfo(),
  });
}

/**
 * POST /api/students/send-email
 *
 * Dispatches personalized reminder emails to students regarding their missing documents.
 */
export async function POST(req: Request) {
  const { user, error } = await requireEvaluator();
  if (error) return error;

  let body: {
    target?: "MISSING_MANDATORY" | "MISSING_TOPIC" | "ALL_STUDENTS" | "ZERO_UPLOADS" | "CUSTOM_IDS";
    topicCategory?: string;
    studentIds?: string[];
    customSubject?: string;
    customMessage?: string;
    ccFacultyAdvisor?: boolean;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const target = body.target || "MISSING_MANDATORY";

  // Query eligible candidates (excluding pure faculty coordinators)
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

  const targetsToSend: Array<{
    student: (typeof students)[0];
    missingText: string;
  }> = [];

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
        missingList = ["All verification marksheets (10th, 12th, CGPA)"];
      }
    } else if (target === "MISSING_TOPIC" && body.topicCategory) {
      const hasCategory = (student.documents ?? []).some(
        (d) => d.category === body.topicCategory && d.status !== "REJECTED"
      );
      if (!hasCategory) {
        shouldSend = true;
        missingList = [docCategoryLabel(body.topicCategory)];
      }
    } else if (target === "ALL_STUDENTS" || target === "CUSTOM_IDS") {
      shouldSend = true;
      missingList = audit.missingCount > 0 ? audit.missingDocLabels : ["Profile details"];
    }

    if (shouldSend) {
      targetsToSend.push({
        student,
        missingText: missingList.join(", ") || "Mandatory Verification Documents",
      });
    }
  }

  if (targetsToSend.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      message: "No students match the criteria for sending emails.",
      sentTo: [],
    });
  }

  let sentCount = 0;
  let failedCount = 0;
  const sentRecipients: string[] = [];
  const errors: string[] = [];

  const defaultSubject = "[Action Required] Upload Missing Placement Verification Documents — SRM";
  const defaultMessage =
    "Our placement verification records indicate that you have pending or missing documents. Please log in and upload these verification files immediately to maintain your eligibility for campus placements.";

  const rawSubject = body.customSubject && body.customSubject.trim().length > 0 ? body.customSubject : defaultSubject;
  const rawMessage = body.customMessage && body.customMessage.trim().length > 0 ? body.customMessage : defaultMessage;

  // Dispatch emails in small batches of 5 to avoid connection flooding
  const BATCH_SIZE = 5;
  for (let i = 0; i < targetsToSend.length; i += BATCH_SIZE) {
    const batch = targetsToSend.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async ({ student, missingText }) => {
        if (!student.email || !student.email.includes("@")) {
          failedCount++;
          return;
        }

        const personalizedSubject = rawSubject
          .replaceAll("{name}", student.fullName)
          .replaceAll("{missing_documents}", missingText)
          .replaceAll("{register_number}", student.registerNumber);

        const personalizedMessage = rawMessage
          .replaceAll("{name}", student.fullName)
          .replaceAll("{missing_documents}", missingText)
          .replaceAll("{register_number}", student.registerNumber);

        const html = buildPlacementReminderHtml({
          studentName: student.fullName,
          registerNumber: student.registerNumber,
          missingDocumentsText: missingText,
          customMessage: personalizedMessage,
        });

        const text = `Dear ${student.fullName} (${student.registerNumber}),\n\n${personalizedMessage}\n\nPending Documents: ${missingText}\n\nPlease upload them on the placement portal:\nhttps://placemnt-metrics.vercel.app/my-submission\n\nRegards,\nSRM School of Computing Placement Cell`;

        const res = await sendEmail({
          to: student.email,
          subject: personalizedSubject,
          text,
          html,
        });

        if (res.success) {
          sentCount++;
          sentRecipients.push(`${student.fullName} <${student.email}>`);

          // Also record an in-app notification so the student sees it on the web portal too
          try {
            await prisma.notification.create({
              data: {
                studentId: student.id,
                title: `📧 Email Notice Sent: Upload Missing Documents`,
                body: personalizedMessage,
                kind: "WARNING",
              },
            });
          } catch {
            // Non-blocking
          }
        } else {
          failedCount++;
          if (res.error) errors.push(`${student.email}: ${res.error}`);
        }
      })
    );
  }

  const configured = isEmailConfigured();

  return NextResponse.json({
    success: true,
    count: sentCount,
    failedCount,
    configured,
    mode: configured ? "smtp" : "simulated",
    message: configured
      ? `Successfully dispatched ${sentCount} reminder emails.`
      : `Simulated dispatch of ${sentCount} reminder emails (SMTP credentials not yet set in environment).`,
    sentTo: sentRecipients,
    errors: errors.slice(0, 10),
  });
}
