import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDto, redactReviewers } from "@/lib/dto";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/submission — the signed-in user's own submission with scrape
 * payloads and scores. Students can never see anyone else's data here.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: user.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  if (!student) {
    return NextResponse.json({ error: "No submission found" }, { status: 404 });
  }
  // WHO reviewed/verified a record is evaluator-only — a student never gets
  // the reviewer's name, the verifier's name, or the score-entry audit.
  const dto = toDto(student);
  const canSeeReviewer = user.canViewSubmissions;
  return NextResponse.json({
    student: {
      ...dto,
      verifiedByName: canSeeReviewer ? dto.verifiedByName : null,
      verifiedAt: canSeeReviewer ? dto.verifiedAt : null,
      scoreAudit: canSeeReviewer ? dto.scoreAudit : [],
      documents: redactReviewers(dto.documents, canSeeReviewer),
      projectLinks: redactReviewers(dto.projectLinks, canSeeReviewer),
    },
  });
}
