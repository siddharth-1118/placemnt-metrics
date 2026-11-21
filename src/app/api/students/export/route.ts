import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { buildXlsx, type XlsxRow } from "@/lib/xlsx";
import { docCategoryLabel, linkCategoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";

interface ExportableCandidate {
  id?: string;
  registerNumber: string;
  fullName: string;
  email?: string | null;
  section?: string | null;
  specialization?: string | null;
  facultyAdvisor?: string | null;
  tenthPercent?: number | null;
  twelfthPercent?: number | null;
  cgpa?: number | null;
  scoreGithub?: number | null;
  scoreCoding?: number | null;
  scoreInternship?: number | null;
  scoreCertifications?: number | null;
  scoreProjects?: number | null;
  scoreFullstack?: number | null;
  scoreHackathons?: number | null;
  scoreInhouse?: number | null;
  scoreMembership?: number | null;
  scoreShl?: number | null;
  totalScore?: number | null;
  scores?: {
    github?: number;
    coding?: number;
    internship?: number;
    certifications?: number;
    projects?: number;
    fullstack?: number;
    hackathons?: number;
    inhouse?: number;
    membership?: number;
    shl?: number;
    total?: number;
  };
  uploadToken?: string | null;
  githubUrl?: string | null;
  leetcodeUrl?: string | null;
  proofUrls?: any;
  projectLinks?: Array<{
    id?: string;
    category?: string;
    label?: string;
    url?: string;
    status?: string;
  }>;
  documents?: Array<{
    id?: string;
    category?: string;
    fileName?: string;
    fileUrl?: string;
    status?: string;
    note?: string | null;
  }>;
}

function parseProofUrls(raw: any): Array<{ label: string; url: string }> {
  if (Array.isArray(raw)) {
    return raw.filter((p) => p && typeof p.url === "string" && p.url.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) {
        return p.filter((x) => x && typeof x.url === "string" && x.url.trim().length > 0);
      }
    } catch {
      return [];
    }
  }
  return [];
}

function makeDocLink(
  doc: { id?: string; fileUrl?: string; fileName?: string },
  student: ExportableCandidate,
  baseUrl: string
): string {
  if (doc.fileUrl && doc.fileUrl.startsWith("http")) return doc.fileUrl;
  const path = doc.fileUrl || (doc.id ? `/api/documents/${doc.id}/file` : "");
  if (!path) return "";
  const tokenQuery = student.uploadToken ? `token=${encodeURIComponent(student.uploadToken)}` : "";
  let finalPath = path;
  if (tokenQuery) {
    finalPath = path.includes("?") ? `${path}&${tokenQuery}` : `${path}?${tokenQuery}`;
  }
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  return cleanBase ? `${cleanBase}${finalPath}` : finalPath;
}

function formatDocs(
  docs: Array<{ id?: string; category?: string; fileName?: string; fileUrl?: string; note?: string | null }> | undefined,
  categories: string[],
  student: ExportableCandidate,
  baseUrl: string,
  includeCategoryLabel = false
): string {
  if (!docs || docs.length === 0) return "—";
  const matched = docs.filter((d) => d.category && categories.includes(d.category));
  if (matched.length === 0) return "—";
  return matched
    .map((d) => {
      const prefix = includeCategoryLabel ? `${docCategoryLabel(d.category || "")} - ` : "";
      const noteStr = d.note ? ` [${d.note}]` : "";
      const url = makeDocLink(d, student, baseUrl);
      return `${prefix}${d.fileName || "Document"}${noteStr}${url ? `: ${url}` : ""}`;
    })
    .join("\n");
}

function formatProjectLinks(
  links: Array<{ id?: string; category?: string; label?: string; url?: string }> | undefined,
  categoryKey: string,
  extraProofUrls?: Array<{ label: string; url: string }>
): string {
  const items: string[] = [];
  if (links && links.length > 0) {
    for (const l of links) {
      if (l.category === categoryKey || (!l.category && categoryKey === "PROJECT")) {
        if (l.url) items.push(`${l.label ? `${l.label}: ` : ""}${l.url}`);
      }
    }
  }
  if (extraProofUrls && extraProofUrls.length > 0 && categoryKey === "PROJECT") {
    for (const p of extraProofUrls) {
      if (p.url) items.push(`${p.label ? `${p.label}: ` : ""}${p.url}`);
    }
  }
  return items.length > 0 ? items.join("\n") : "—";
}

function formatAllEvidence(student: ExportableCandidate, baseUrl: string): string {
  const lines: string[] = [];
  if (student.githubUrl) lines.push(`GitHub: ${student.githubUrl}`);
  if (student.leetcodeUrl) lines.push(`LeetCode: ${student.leetcodeUrl}`);

  if (student.projectLinks && student.projectLinks.length > 0) {
    for (const p of student.projectLinks) {
      if (p.url) {
        lines.push(`[${linkCategoryLabel(p.category || "")}] ${p.label ? `${p.label}: ` : ""}${p.url}`);
      }
    }
  }

  const proofs = parseProofUrls(student.proofUrls);
  for (const p of proofs) {
    if (p.url) {
      lines.push(`[Project Link] ${p.label ? `${p.label}: ` : ""}${p.url}`);
    }
  }

  if (student.documents && student.documents.length > 0) {
    for (const d of student.documents) {
      const url = makeDocLink(d, student, baseUrl);
      const noteStr = d.note ? ` (${d.note})` : "";
      lines.push(`[${docCategoryLabel(d.category || "")}] ${d.fileName || "File"}${noteStr}${url ? `: ${url}` : ""}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "—";
}

function buildPlacementMatrixXlsx(students: ExportableCandidate[], baseUrl = ""): Buffer {
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
    "GitHub Profile Link",
    "Coding Profile Link (LeetCode)",
    "Projects Links (Repo & Demo)",
    "Full Stack Project Links",
    "In-House Project Links",
    "Internship Proof Documents",
    "Skillset & Certifications Proofs",
    "Hackathons & Competitions Proofs",
    "In-House Project Proofs",
    "Membership Proofs",
    "SHL Assessment Proofs",
    "Academic Marksheets (10th / 12th / CGPA)",
    "All Uploaded Documents & Links (Consolidated)",
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
    32, // GitHub Profile Link
    32, // Coding Profile Link (LeetCode)
    42, // Projects Links (Repo & Demo)
    42, // Full Stack Project Links
    35, // In-House Project Links
    48, // Internship Proof Documents
    48, // Skillset & Certifications Proofs
    48, // Hackathons & Competitions Proofs
    42, // In-House Project Proofs
    38, // Membership Proofs
    42, // SHL Assessment Proofs
    48, // Academic Marksheets (10th / 12th / CGPA)
    55, // All Uploaded Documents & Links (Consolidated)
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

    // Component scores (supports both Prisma flat columns and DTO scores object)
    const ghScore = Number(s.scores?.github ?? s.scoreGithub ?? 0);
    const codingScore = Number(s.scores?.coding ?? s.scoreCoding ?? 0);
    const internScore = Number(s.scores?.internship ?? s.scoreInternship ?? 0);
    const certScore = Number(s.scores?.certifications ?? s.scoreCertifications ?? 0);
    const projScore = Number(s.scores?.projects ?? s.scoreProjects ?? 0);
    const fsdScore = Number(s.scores?.fullstack ?? s.scoreFullstack ?? 0);
    const hackScore = Number(s.scores?.hackathons ?? s.scoreHackathons ?? 0);
    const inhouseScore = Math.min(5, Number(s.scores?.inhouse ?? s.scoreInhouse ?? 0));
    const memberScore = Number(s.scores?.membership ?? s.scoreMembership ?? 0);
    const shlScore = Number(s.scores?.shl ?? s.scoreShl ?? 0);

    // Sum of scores
    const rawTotal = Number(s.scores?.total ?? s.totalScore ?? 0);
    const computedTotal =
      rawTotal > 0
        ? rawTotal
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

    const proofList = parseProofUrls(s.proofUrls);

    return [
      { value: s.registerNumber || "", style: "center" },
      { value: s.fullName || "", style: "default" },
      { value: s.section || "AO1", style: "center" },
      { value: s.specialization || "B.Tech - AIML", style: "center" },
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
      // Link & Proof Columns (Columns 20-32)
      { value: s.githubUrl || "—", style: "default" },
      { value: s.leetcodeUrl || "—", style: "default" },
      { value: formatProjectLinks(s.projectLinks, "PROJECT", proofList), style: "default" },
      { value: formatProjectLinks(s.projectLinks, "FULLSTACK_PROJECT"), style: "default" },
      { value: formatProjectLinks(s.projectLinks, "INHOUSE_PROJECT_LINK"), style: "default" },
      { value: formatDocs(s.documents, ["INTERNSHIP"], s, baseUrl), style: "default" },
      { value: formatDocs(s.documents, ["SKILL_CERT"], s, baseUrl), style: "default" },
      { value: formatDocs(s.documents, ["COMPETITION"], s, baseUrl), style: "default" },
      { value: formatDocs(s.documents, ["INHOUSE_PROJECT"], s, baseUrl), style: "default" },
      { value: formatDocs(s.documents, ["MEMBERSHIP"], s, baseUrl), style: "default" },
      { value: formatDocs(s.documents, ["SHL"], s, baseUrl), style: "default" },
      {
        value: formatDocs(
          s.documents,
          ["TENTH_MARKSHEET", "TWELFTH_MARKSHEET", "CGPA_MARKSHEET", "SEM1_MARKSHEET", "SEM2_MARKSHEET"],
          s,
          baseUrl,
          true
        ),
        style: "default",
      },
      { value: formatAllEvidence(s, baseUrl), style: "default" },
    ];
  });

  return buildXlsx({
    headers,
    rows,
    columnWidths,
    sheetName: "AO1 Placement Matrix",
  });
}

function createXlsxResponse(buffer: Buffer): NextResponse {
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

function getBaseUrl(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "placement-metrics.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

/**
 * GET /api/students/export
 * Retrieves all student records from the database and returns the official Excel workbook
 * complete with all rubric marks, profile links, project links, and document verification URLs.
 */
export async function GET(req: Request) {
  const { error } = await requireEvaluator();
  if (error) return error;

  try {
    const students = await prisma.student.findMany({
      where: {
        NOT: {
          registerNumber: { startsWith: "COORD-" },
        },
      },
      orderBy: [{ registerNumber: "asc" }],
      include: {
        documents: {
          select: {
            id: true,
            category: true,
            fileName: true,
            note: true,
            status: true,
          },
        },
        projectLinks: {
          select: {
            id: true,
            category: true,
            label: true,
            url: true,
            status: true,
          },
        },
      },
    });

    const baseUrl = getBaseUrl(req);
    const buffer = buildPlacementMatrixXlsx(students, baseUrl);
    return createXlsxResponse(buffer);
  } catch (err) {
    console.error("GET /api/students/export failed:", err);
    return NextResponse.json(
      { error: "Database query failed while exporting. Please try again or export from active table." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students/export
 * Accepts an array of students from the client in memory, generating the official Excel
 * workbook with marks and links immediately without an extra database query.
 */
export async function POST(req: Request) {
  const { error } = await requireEvaluator();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    let students: ExportableCandidate[] | null = Array.isArray(body?.students)
      ? body.students
      : null;

    if (!students || students.length === 0) {
      students = await prisma.student.findMany({
        where: {
          NOT: {
            registerNumber: { startsWith: "COORD-" },
          },
        },
        orderBy: [{ registerNumber: "asc" }],
        include: {
          documents: {
            select: {
              id: true,
              category: true,
              fileName: true,
              note: true,
              status: true,
            },
          },
          projectLinks: {
            select: {
              id: true,
              category: true,
              label: true,
              url: true,
              status: true,
            },
          },
        },
      });
    }

    const baseUrl = getBaseUrl(req);
    const buffer = buildPlacementMatrixXlsx(students, baseUrl);
    return createXlsxResponse(buffer);
  } catch (err) {
    console.error("POST /api/students/export failed:", err);
    return NextResponse.json(
      { error: "Failed to generate Excel file" },
      { status: 500 }
    );
  }
}
