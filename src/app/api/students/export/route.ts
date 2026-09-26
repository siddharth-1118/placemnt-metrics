import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator, filterStudentDtoForUser } from "@/lib/auth";
import { scopesAreFull, SCORE_FIELD_VIEW_SCOPE, type ScoreScope } from "@/lib/scopes";
import { toDto } from "@/lib/dto";
import { buildXlsx, type XlsxRow } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/export — cohort report as a real Excel (.xlsx) file.
 *
 * Access rules:
 *  - Students and anonymous users are rejected (403 / 401) — coordinators
 *    and super admins only. The same evaluator gate as the list endpoint.
 *  - A scoped coordinator's file contains only their sections' columns;
 *    the super admin and unrestricted coordinators get the full sheet.
 */
export async function GET() {
  const { user, error } = await requireEvaluator();
  if (error) return error;

  const students = await prisma.student.findMany({
    where: {
      OR: [{ role: { not: "COORDINATOR" } }, { tenthPercent: { gt: 0 } }],
    },
    orderBy: [{ totalScore: "desc" }, { registerNumber: "asc" }],
    include: { scrapes: true, documents: true, projectLinks: true },
  });

  // Same scope filtering the dashboard uses — out-of-scope marks are stripped
  // server-side before anything is written into the workbook.
  const dtos = students.map((s) => filterStudentDtoForUser(toDto(s), user));
  const scopes: ScoreScope[] | null = user.isSuperAdmin
    ? null
    : scopesAreFull(user.permissionScopes)
      ? null
      : user.permissionScopes;

  const full = scopes === null;
  const has = (s: ScoreScope) => full || scopes!.includes(s);

  // Column plan: identity columns always; every score column only when the
  // viewer holds that section's scope.
  type Col = { header: string; width: number; value: (s: (typeof dtos)[number]) => string | number };
  const cols: Col[] = [
    { header: "Rank", width: 7, value: (s) => s.rank ?? "" },
    { header: "Register Number", width: 16, value: (s) => s.registerNumber },
    { header: "Full Name", width: 26, value: (s) => s.fullName },
    { header: "Email", width: 30, value: (s) => s.email },
  ];
  if (has("ACADEMIC"))
    cols.push(
      { header: "CGPA", width: 8, value: (s) => s.cgpa },
      { header: "10th %", width: 8, value: (s) => s.tenthPercent },
      { header: "12th %", width: 8, value: (s) => s.twelfthPercent },
      { header: "Academic (10)", width: 12, value: (s) => s.scores.academic },
    );
  if (has("GITHUB"))
    cols.push({ header: "GitHub (15)", width: 11, value: (s) => s.scores.github });
  if (has("CODING"))
    cols.push({ header: "Coding (10)", width: 11, value: (s) => s.scores.coding });
  const sectionCols: Array<{ key: keyof (typeof dtos)[number]["scores"]; header: string }> = [
    { key: "internship", header: "Internship (10)" },
    { key: "certifications", header: "Certifications (15)" },
    { key: "projects", header: "Projects (5)" },
    { key: "fullstack", header: "Full-stack (5)" },
    { key: "hackathons", header: "Hackathons (10)" },
    { key: "inhouse", header: "In-house (8)" },
    { key: "membership", header: "Membership (2)" },
    { key: "shl", header: "SHL (10)" },
  ];
  for (const { key, header } of sectionCols) {
    const scope = SCORE_FIELD_VIEW_SCOPE[key as string];
    if (scope && has(scope))
      cols.push({ header, width: Math.max(11, header.length - 4), value: (s) => Number(s.scores[key]) });
  }
  cols.push(
    { header: "Total (100)", width: 11, value: (s) => s.scores.total },
    { header: "Status", width: 10, value: (s) => s.status },
    {
      header: "Verified Docs",
      width: 12,
      value: (s) => (s.documents ?? []).filter((d) => d.status === "VERIFIED").length,
    },
    { header: "Total Docs", width: 11, value: (s) => (s.documents ?? []).length },
    { header: "Last Updated", width: 12, value: (s) => s.updatedAt.slice(0, 10) },
  );

  const headers = cols.map((c) => c.header);
  const rows: XlsxRow[] = dtos.map((s) => cols.map((c) => c.value(s)));

  const buf = buildXlsx({
    sheetName: "Placement Matrix",
    headers,
    rows,
    columnWidths: cols.map((c) => c.width),
  });

  const filename = `SRM_Placement_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

