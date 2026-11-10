import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { buildXlsx, type XlsxRow } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/export
 *
 * Exports student candidate records in the exact official SRM Placement Evaluation format:
 *
 * Columns (19 total):
 *  1. Registration Number
 *  2. Full Name (AS PER ATTENDANCE)
 *  3. Section
 *  4. Specialization
 *  5. Faculty Advisor
 *  6. 10th Percentage (2.5)
 *  7. 12th Percentage (2.5)
 *  8. CGPA (5)
 *  9. Github Profile (15)
 * 10. Coding Practice Platform (10)
 * 11. Internship Experience (10)
 * 12. Skillset & Global Certifications Completed (15)
 * 13. Projects Done (5)
 * 14. Full Stack Developer Experience (5)
 * 15. Coding Competition & Hackathons Won (10)
 * 16. Inhouse Projects Done (5)
 * 17. Membership of Professional Bodies (2)
 * 18. SHL Assessment / Talent Discovery Assessment / N.C.A.T (National Competence & Employability Test) (13)
 * 19. Total
 */
export async function GET() {
  const { error } = await requireEvaluator();
  if (error) return error;

  // Retrieve all student candidates in the database, ordered by registration number
  // Exclude pure coordinator accounts (registerNumber starting with COORD-).
  const students = await prisma.student.findMany({
    where: {
      NOT: {
        registerNumber: { startsWith: "COORD-" },
      },
    },
    orderBy: [{ registerNumber: "asc" }],
  });

  const headers = [
    "Registration Number",
    "Full Name (AS PER ATTENDANCE)",
    "Section",
    "Specialization",
    "Faculty Advisor",
    "10th Percentage (2.5)",
    "12th Percentage (2.5)",
    "CGPA (5)",
    "Github Profile (15)",
    "Coding Practice Platform (10)",
    "Internship Experience (10)",
    "Skillset & Global Certifications Completed (15)",
    "Projects Done (5)",
    "Full Stack Developer Experience (5)",
    "Coding Competition & Hackathons Won (10)",
    "Inhouse Projects Done (5)",
    "Membership of Professional Bodies (2)",
    "SHL Assessment / Talent Discovery Assessment / N.C.A.T (National Competence & Employability Test) (13)",
    "Total",
  ];

  const columnWidths = [
    20, // Registration Number
    30, // Full Name (AS PER ATTENDANCE)
    10, // Section
    18, // Specialization
    18, // Faculty Advisor
    14, // 10th Percentage (2.5)
    14, // 12th Percentage (2.5)
    12, // CGPA (5)
    15, // Github Profile (15)
    16, // Coding Practice Platform (10)
    16, // Internship Experience (10)
    22, // Skillset & Global Certifications Completed (15)
    14, // Projects Done (5)
    18, // Full Stack Developer Experience (5)
    20, // Coding Competition & Hackathons Won (10)
    15, // Inhouse Projects Done (5)
    16, // Membership of Professional Bodies (2)
    25, // SHL Assessment ... (13)
    12, // Total
  ];

  const rows: XlsxRow[] = students.map((s, idx) => {
    const rowNum = idx + 2; // Row 1 is header

    // 10th Percentage score (out of 2.5)
    const tenthScore = s.tenthPercent
      ? s.tenthPercent >= 96
        ? 2.5
        : s.tenthPercent >= 91
          ? 2.0
          : s.tenthPercent >= 86
            ? 1.5
            : s.tenthPercent >= 75
              ? 1.0
              : 0.5
      : 0;

    // 12th Percentage score (out of 2.5)
    const twelfthScore = s.twelfthPercent
      ? s.twelfthPercent >= 96
        ? 2.5
        : s.twelfthPercent >= 91
          ? 2.0
          : s.twelfthPercent >= 86
            ? 1.5
            : s.twelfthPercent >= 75
              ? 1.0
              : 0.5
      : 0;

    // Degree CGPA score (out of 5)
    const cgpaScore = s.cgpa
      ? s.cgpa > 9.5
        ? 5.0
        : s.cgpa >= 9.1
          ? 4.0
          : s.cgpa >= 8.6
            ? 3.0
            : s.cgpa >= 7.5
              ? 2.0
              : 1.0
      : 0;

    // Component scores
    const ghScore = Number(s.scoreGithub ?? 0);
    const codingScore = Number(s.scoreCoding ?? 0);
    const internScore = Number(s.scoreInternship ?? 0);
    const certScore = Number(s.scoreCertifications ?? 0);
    const projScore = Number(s.scoreProjects ?? 0);
    const fsdScore = Number(s.scoreFullstack ?? 0);
    const hackScore = Number(s.scoreHackathons ?? 0);
    const inhouseScore = Math.min(5, Number(s.scoreInhouse ?? 0));
    const memberScore = Number(s.scoreMembership ?? 0);
    const shlScore = Number(s.scoreShl ?? 0);

    // Sum of scores
    const computedTotal =
      (s.totalScore && s.totalScore > 0)
        ? s.totalScore
        : Math.round(
            (tenthScore +
              twelfthScore +
              cgpaScore +
              ghScore +
              codingScore +
              internScore +
              certScore +
              projScore +
              fsdScore +
              hackScore +
              inhouseScore +
              memberScore +
              shlScore) *
              100
          ) / 100;

    return [
      { value: s.registerNumber, style: "center" },
      { value: s.fullName, style: "default" },
      { value: "AO1", style: "center" },
      { value: "B.Tech - AIML", style: "center" },
      { value: s.facultyAdvisor || "Dr. Kaliraj G", style: "center" },
      tenthScore > 0 ? tenthScore : "",
      twelfthScore > 0 ? twelfthScore : "",
      cgpaScore > 0 ? cgpaScore : "",
      ghScore > 0 ? ghScore : "",
      codingScore > 0 ? codingScore : "",
      internScore > 0 ? internScore : "",
      certScore > 0 ? certScore : "",
      projScore > 0 ? projScore : "",
      fsdScore > 0 ? fsdScore : "",
      hackScore > 0 ? hackScore : "",
      inhouseScore > 0 ? inhouseScore : "",
      memberScore > 0 ? memberScore : "",
      shlScore > 0 ? shlScore : "",
      {
        formula: `SUM(F${rowNum}:R${rowNum})`,
        value: computedTotal,
        style: "boldCenter",
      },
    ];
  });

  const buffer = buildXlsx({
    headers,
    rows,
    columnWidths,
    sheetName: "AO1 Placement Matrix",
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `SRM_Placement_Matrix_AO1_${dateStr}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
