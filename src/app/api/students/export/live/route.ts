import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildXlsx, type XlsxRow } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

const DEFAULT_SYNC_TOKEN = "srm_ao1_matrix_feed";

function getExpectedToken(): string {
  return process.env.SYNC_TOKEN || DEFAULT_SYNC_TOKEN;
}

/**
 * GET /api/students/export/live
 *
 * Real-time live synchronization endpoint for Microsoft Excel, OneDrive, and Power Query.
 *
 * Query Params:
 *  - token / key: Sync authentication token (or active evaluator session cookie)
 *  - format: "csv" (default, best for Power Query) | "xlsx" | "json" (best for Excel Office Scripts)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || url.searchParams.get("key");
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  const expectedToken = getExpectedToken();
  const sessionUser = await getSessionUser();

  const isAuthorized =
    (token && token === expectedToken) ||
    Boolean(sessionUser?.canViewSubmissions || sessionUser?.isSuperAdmin);

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: "Unauthorized. Please provide a valid sync token (?token=...) or log in with coordinator credentials.",
      },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Retrieve all student candidates in the database, ordered by registration number
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

  // Compute calculated scores for each student
  const rawRows: (string | number)[][] = students.map((s) => {
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

    const totalVal =
      s.totalScore && s.totalScore > 0
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
      s.registerNumber,
      s.fullName,
      "AO1",
      "B.Tech - AIML",
      s.facultyAdvisor || "Dr. Kaliraj G",
      tenthScore,
      twelfthScore,
      cgpaScore,
      ghScore,
      codingScore,
      internScore,
      certScore,
      projScore,
      fsdScore,
      hackScore,
      inhouseScore,
      memberScore,
      shlScore,
      totalVal,
    ];
  });

  // FORMAT: JSON (For Excel Online Office Scripts)
  if (format === "json") {
    return NextResponse.json(
      {
        success: true,
        updatedAt: new Date().toISOString(),
        headers,
        rows: rawRows,
        count: rawRows.length,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }

  // FORMAT: XLSX (Binary OpenXML for Excel)
  if (format === "xlsx") {
    const columnWidths = [20, 30, 10, 18, 18, 14, 14, 12, 15, 16, 16, 22, 14, 18, 20, 15, 16, 25, 12];
    const xlsxRows: XlsxRow[] = rawRows.map((r, idx) => {
      const rowNum = idx + 2;
      return [
        { value: r[0], style: "center" },
        { value: r[1], style: "default" },
        { value: r[2], style: "center" },
        { value: r[3], style: "center" },
        { value: r[4], style: "center" },
        Number(r[5]) > 0 ? Number(r[5]) : "",
        Number(r[6]) > 0 ? Number(r[6]) : "",
        Number(r[7]) > 0 ? Number(r[7]) : "",
        Number(r[8]) > 0 ? Number(r[8]) : "",
        Number(r[9]) > 0 ? Number(r[9]) : "",
        Number(r[10]) > 0 ? Number(r[10]) : "",
        Number(r[11]) > 0 ? Number(r[11]) : "",
        Number(r[12]) > 0 ? Number(r[12]) : "",
        Number(r[13]) > 0 ? Number(r[13]) : "",
        Number(r[14]) > 0 ? Number(r[14]) : "",
        Number(r[15]) > 0 ? Number(r[15]) : "",
        Number(r[16]) > 0 ? Number(r[16]) : "",
        Number(r[17]) > 0 ? Number(r[17]) : "",
        {
          formula: `SUM(F${rowNum}:R${rowNum})`,
          value: Number(r[18]),
          style: "boldCenter",
        },
      ];
    });

    const buffer = buildXlsx({
      headers,
      rows: xlsxRows,
      columnWidths,
      sheetName: "AO1 Placement Matrix",
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'inline; filename="SRM_Placement_Matrix_AO1_Live.xlsx"',
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }

  // FORMAT: CSV (Default, native Power Query and Excel From Web connector)
  const csvLines = [
    headers.map((h) => `"${h.replaceAll('"', '""')}"`).join(","),
    ...rawRows.map((row) =>
      row
        .map((val) => {
          if (typeof val === "number") return val;
          return `"${String(val ?? "").replaceAll('"', '""')}"`;
        })
        .join(",")
    ),
  ];

  // Prepend UTF-8 Byte Order Mark (\ufeff) so Microsoft Excel natively recognizes UTF-8 without delimiter wizard
  const csvContent = "\ufeff" + csvLines.join("\r\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="SRM_Placement_Matrix_AO1_Live.csv"',
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

/**
 * Handle CORS preflight for Excel Online web requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
