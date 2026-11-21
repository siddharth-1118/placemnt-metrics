import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { buildXlsx, type XlsxRow } from "@/lib/xlsx";

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
  sgpaSem1?: number | null;
  sgpaSem2?: number | null;
  scoreAcademic?: number | null;
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

function makeHyperlinkCell(url?: string | null): { value: string; formula?: string; style: "link" | "default" } {
  if (!url || !url.trim()) {
    return { value: "", style: "default" };
  }
  const cleanUrl = url.trim();
  return {
    value: cleanUrl,
    formula: `HYPERLINK("${cleanUrl.replace(/"/g, '""')}", "${cleanUrl.replace(/"/g, '""')}")`,
    style: "link",
  };
}

function buildPlacementMatrixXlsx(students: ExportableCandidate[], baseUrl = ""): Buffer {
  // Determine dynamic column counts per category across all exported candidates
  let maxProjects = 3;
  let maxFullstack = 2;
  let maxInhouseLinks = 2;
  let maxInhouseDocs = 2;
  let maxInternships = 2;
  let maxCerts = 6;
  let maxHackathons = 4;
  let maxMemberships = 2;
  let maxShl = 1;

  for (const s of students) {
    const pLinks = (s.projectLinks || []).filter((l) => l.category === "PROJECT" || !l.category);
    const proofLinks = parseProofUrls(s.proofUrls);
    maxProjects = Math.max(maxProjects, pLinks.length + proofLinks.length);

    const fsLinks = (s.projectLinks || []).filter((l) => l.category === "FULLSTACK_PROJECT");
    maxFullstack = Math.max(maxFullstack, fsLinks.length);

    const ihLinks = (s.projectLinks || []).filter((l) => l.category === "INHOUSE_PROJECT_LINK");
    maxInhouseLinks = Math.max(maxInhouseLinks, ihLinks.length);

    const ihDocs = (s.documents || []).filter((d) => d.category === "INHOUSE_PROJECT");
    maxInhouseDocs = Math.max(maxInhouseDocs, ihDocs.length);

    const internDocs = (s.documents || []).filter((d) => d.category === "INTERNSHIP");
    maxInternships = Math.max(maxInternships, internDocs.length);

    const certDocs = (s.documents || []).filter((d) => d.category === "SKILL_CERT");
    maxCerts = Math.max(maxCerts, certDocs.length);

    const hackDocs = (s.documents || []).filter((d) => d.category === "COMPETITION");
    maxHackathons = Math.max(maxHackathons, hackDocs.length);

    const memDocs = (s.documents || []).filter((d) => d.category === "MEMBERSHIP");
    maxMemberships = Math.max(maxMemberships, memDocs.length);

    const shlDocs = (s.documents || []).filter((d) => d.category === "SHL");
    maxShl = Math.max(maxShl, shlDocs.length);
  }

  // Official 19 Rubric Columns
  const headers: string[] = [
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
  ];

  const columnWidths: number[] = [
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
    35, // GitHub Profile Link
    35, // Coding Profile Link (LeetCode)
  ];

  // Dynamic slot headers: each link and document gets its own separate Excel box (column)
  for (let i = 1; i <= maxProjects; i++) {
    headers.push(`Projects Done - Link ${i}`);
    columnWidths.push(42);
  }
  for (let i = 1; i <= maxFullstack; i++) {
    headers.push(`Full Stack Developer - Link ${i}`);
    columnWidths.push(42);
  }
  for (let i = 1; i <= maxInhouseLinks; i++) {
    headers.push(`Inhouse Projects - Link ${i}`);
    columnWidths.push(42);
  }
  for (let i = 1; i <= maxInhouseDocs; i++) {
    headers.push(`Inhouse Projects - Document ${i} Link`);
    columnWidths.push(45);
  }
  for (let i = 1; i <= maxInternships; i++) {
    headers.push(`Internship Experience - Document ${i} Link`);
    columnWidths.push(45);
  }
  for (let i = 1; i <= maxCerts; i++) {
    headers.push(`Skillset & Certifications - Document ${i} Link`);
    columnWidths.push(45);
  }
  for (let i = 1; i <= maxHackathons; i++) {
    headers.push(`Coding Competitions & Hackathons - Document ${i} Link`);
    columnWidths.push(45);
  }
  for (let i = 1; i <= maxMemberships; i++) {
    headers.push(`Professional Membership - Document ${i} Link`);
    columnWidths.push(42);
  }
  for (let i = 1; i <= maxShl; i++) {
    headers.push(`SHL Assessment - Document ${i} Link`);
    columnWidths.push(45);
  }

  // Academic marksheets
  headers.push(
    "Academic - 10th Marksheet Link",
    "Academic - 12th Marksheet Link",
    "Academic - Degree CGPA Marksheet Link",
    "Academic - Semester 1 Marksheet Link",
    "Academic - Semester 2 Marksheet Link"
  );
  columnWidths.push(45, 45, 45, 45, 45);

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

    // Ensure Degree CGPA is accurately derived (from s.cgpa or SGPAs)
    const rawCgpa = Number(s.cgpa ?? 0);
    const s1 = Number(s.sgpaSem1 ?? 0);
    const s2 = Number(s.sgpaSem2 ?? 0);
    const effectiveCgpa =
      rawCgpa > 0
        ? rawCgpa
        : s1 > 0 && s2 > 0
          ? Math.round(((s1 + s2) / 2) * 100) / 100
          : s1 > 0
            ? s1
            : s2 > 0
              ? s2
              : 0;

    // Degree CGPA score (out of 5)
    let cgpaScore = 0;
    if (effectiveCgpa > 0) {
      if (effectiveCgpa > 9.5) cgpaScore = 5.0;
      else if (effectiveCgpa >= 9.1) cgpaScore = 4.0;
      else if (effectiveCgpa >= 8.6) cgpaScore = 3.0;
      else if (effectiveCgpa >= 7.5) cgpaScore = 2.0;
      else cgpaScore = 1.0;
    } else if (s.scoreAcademic && Number(s.scoreAcademic) > 0) {
      // Deduce CGPA portion from scoreAcademic if available
      cgpaScore = Math.max(0, Math.min(5, Math.round((Number(s.scoreAcademic) - tenthScore - twelfthScore) * 10) / 10));
    }

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

    // Base row (Columns 1-19) + Profiles (20-21)
    const row: XlsxRow = [
      { value: s.registerNumber || "", style: "center" },
      { value: s.fullName || "", style: "default" },
      { value: s.section || "AO1", style: "center" },
      { value: s.specialization || "B.Tech - AIML", style: "center" },
      { value: s.facultyAdvisor || "Dr. Kaliraj G", style: "center" },
      tenthScore > 0 ? tenthScore : "",
      twelfthScore > 0 ? twelfthScore : "",
      cgpaScore > 0 ? cgpaScore : effectiveCgpa > 0 ? 1.0 : "",
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
      makeHyperlinkCell(s.githubUrl),
      makeHyperlinkCell(s.leetcodeUrl),
    ];

    // 1. Projects Done (Link 1..N) - pure clickable URL
    const projectItems: string[] = [];
    for (const p of (s.projectLinks || []).filter((l) => l.category === "PROJECT" || !l.category)) {
      if (p.url) projectItems.push(p.url.trim());
    }
    for (const p of parseProofUrls(s.proofUrls)) {
      if (p.url) projectItems.push(p.url.trim());
    }
    for (let i = 0; i < maxProjects; i++) {
      row.push(makeHyperlinkCell(projectItems[i]));
    }

    // 2. Full Stack Developer (Link 1..N) - pure clickable URL
    const fullstackItems: string[] = [];
    for (const p of (s.projectLinks || []).filter((l) => l.category === "FULLSTACK_PROJECT")) {
      if (p.url) fullstackItems.push(p.url.trim());
    }
    for (let i = 0; i < maxFullstack; i++) {
      row.push(makeHyperlinkCell(fullstackItems[i]));
    }

    // 3. Inhouse Projects Links (Link 1..N) - pure clickable URL
    const inhouseLinkItems: string[] = [];
    for (const p of (s.projectLinks || []).filter((l) => l.category === "INHOUSE_PROJECT_LINK")) {
      if (p.url) inhouseLinkItems.push(p.url.trim());
    }
    for (let i = 0; i < maxInhouseLinks; i++) {
      row.push(makeHyperlinkCell(inhouseLinkItems[i]));
    }

    // 4. Inhouse Projects Documents (Doc 1..N) - pure clickable URL
    const inhouseDocItems = (s.documents || []).filter((d) => d.category === "INHOUSE_PROJECT");
    for (let i = 0; i < maxInhouseDocs; i++) {
      const doc = inhouseDocItems[i];
      row.push(makeHyperlinkCell(doc ? makeDocLink(doc, s, baseUrl) : ""));
    }

    // 5. Internship Documents (Doc 1..N) - pure clickable URL
    const internDocItems = (s.documents || []).filter((d) => d.category === "INTERNSHIP");
    for (let i = 0; i < maxInternships; i++) {
      const doc = internDocItems[i];
      row.push(makeHyperlinkCell(doc ? makeDocLink(doc, s, baseUrl) : ""));
    }

    // 6. Skillset & Certifications Documents (Doc 1..N) - pure clickable URL
    const certDocItems = (s.documents || []).filter((d) => d.category === "SKILL_CERT");
    for (let i = 0; i < maxCerts; i++) {
      const doc = certDocItems[i];
      row.push(makeHyperlinkCell(doc ? makeDocLink(doc, s, baseUrl) : ""));
    }

    // 7. Coding Competitions & Hackathons Documents (Doc 1..N) - pure clickable URL
    const hackDocItems = (s.documents || []).filter((d) => d.category === "COMPETITION");
    for (let i = 0; i < maxHackathons; i++) {
      const doc = hackDocItems[i];
      row.push(makeHyperlinkCell(doc ? makeDocLink(doc, s, baseUrl) : ""));
    }

    // 8. Professional Memberships Documents (Doc 1..N) - pure clickable URL
    const memDocItems = (s.documents || []).filter((d) => d.category === "MEMBERSHIP");
    for (let i = 0; i < maxMemberships; i++) {
      const doc = memDocItems[i];
      row.push(makeHyperlinkCell(doc ? makeDocLink(doc, s, baseUrl) : ""));
    }

    // 9. SHL Assessment Documents (Doc 1..N) - pure clickable URL
    const shlDocItems = (s.documents || []).filter((d) => d.category === "SHL");
    for (let i = 0; i < maxShl; i++) {
      const doc = shlDocItems[i];
      row.push(makeHyperlinkCell(doc ? makeDocLink(doc, s, baseUrl) : ""));
    }

    // 10. Academic Marksheets - pure clickable URL highlighting the marksheet
    const doc10th = (s.documents || []).find((d) => d.category === "TENTH_MARKSHEET");
    row.push(makeHyperlinkCell(doc10th ? makeDocLink(doc10th, s, baseUrl) : ""));

    const doc12th = (s.documents || []).find((d) => d.category === "TWELFTH_MARKSHEET");
    row.push(makeHyperlinkCell(doc12th ? makeDocLink(doc12th, s, baseUrl) : ""));

    const docCgpa = (s.documents || []).find((d) => d.category === "CGPA_MARKSHEET");
    row.push(makeHyperlinkCell(docCgpa ? makeDocLink(docCgpa, s, baseUrl) : ""));

    const docSem1 = (s.documents || []).find((d) => d.category === "SEM1_MARKSHEET");
    row.push(makeHyperlinkCell(docSem1 ? makeDocLink(docSem1, s, baseUrl) : ""));

    const docSem2 = (s.documents || []).find((d) => d.category === "SEM2_MARKSHEET");
    row.push(makeHyperlinkCell(docSem2 ? makeDocLink(docSem2, s, baseUrl) : ""));

    return row;
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
 * with every rubric mark, link, and document proof formatted into its own individual cell.
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
    const targetIds = Array.isArray(body?.students)
      ? (body.students as { id?: string }[])
          .map((s) => s.id)
          .filter(Boolean) as string[]
      : [];

    const whereClause: any = {
      NOT: {
        registerNumber: { startsWith: "COORD-" },
      },
    };
    if (targetIds.length > 0) {
      whereClause.id = { in: targetIds };
    }

    const students = await prisma.student.findMany({
      where: whereClause,
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
    console.error("POST /api/students/export failed:", err);
    return NextResponse.json(
      { error: "Failed to generate Excel file" },
      { status: 500 }
    );
  }
}
