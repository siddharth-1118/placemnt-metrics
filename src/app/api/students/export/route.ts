import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator, filterStudentDtoForUser } from "@/lib/auth";
import { scopesAreFull, SCORE_FIELD_VIEW_SCOPE, type ScoreScope } from "@/lib/scopes";
import { toDto } from "@/lib/dto";
import { buildXlsx, type XlsxRow } from "@/lib/xlsx";
import { docCategoryLabel, linkCategoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/export — cohort report as a real Excel (.xlsx) file.
 *
 * Includes:
 *  - Candidate identity and rank
 *  - Contributor attribution headers
 *  - All 13 official evaluation components
 *  - Clickable URLs for all uploaded documents (with security tokens for instant viewing)
 *  - Clickable URLs for all submitted project, portfolio, GitHub, and LeetCode links
 */
export async function GET(req: Request) {
  const { user, error } = await requireEvaluator();
  if (error) return error;

  // Resolve base URL so links in Excel are full, clickable URLs
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  // Return all student candidates in the database.
  // Exclude pure faculty coordinator accounts (registerNumber starting with COORD-).
  const students = await prisma.student.findMany({
    where: {
      NOT: {
        registerNumber: { startsWith: "COORD-" },
      },
    },
    orderBy: [{ totalScore: "desc" }, { registerNumber: "asc" }],
    include: { scrapes: true, documents: true, projectLinks: true },
  });

  const tokenMap = new Map(students.map((s) => [s.id, s.uploadToken]));

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

  // Helpers to format uploaded documents and submitted links
  const formatDocs = (s: (typeof dtos)[number], categoryFilter?: (cat: string) => boolean) => {
    const token = tokenMap.get(s.id) ?? "";
    const docs = (s.documents ?? []).filter((d) => !categoryFilter || categoryFilter(d.category));
    if (docs.length === 0) return "—";
    return docs
      .map(
        (d, idx) =>
          `${idx + 1}. [${docCategoryLabel(d.category)}] ${d.fileName} (${d.status}):\n${baseUrl}/api/documents/${d.id}/file?token=${token}`
      )
      .join("\n\n");
  };

  const formatProjectLinks = (s: (typeof dtos)[number], categoryFilter?: (cat: string) => boolean) => {
    const links = (s.projectLinks ?? []).filter((l) => !categoryFilter || categoryFilter(l.category));
    if (links.length === 0) return "—";
    return links
      .map((l, idx) => `${idx + 1}. [${linkCategoryLabel(l.category)}] ${l.label} (${l.status}):\n${l.url}`)
      .join("\n\n");
  };

  const formatAllSubmittedLinks = (s: (typeof dtos)[number]) => {
    const items: string[] = [];
    if (s.githubUrl) items.push(`• GitHub: ${s.githubUrl}`);
    if (s.leetcodeUrl) items.push(`• LeetCode: ${s.leetcodeUrl}`);

    for (const l of s.projectLinks ?? []) {
      items.push(`• [${linkCategoryLabel(l.category)}] ${l.label} (${l.status}): ${l.url}`);
    }

    for (const p of s.proofUrls ?? []) {
      if (p.url && !items.some((i) => i.includes(p.url))) {
        items.push(`• [Proof Link] ${p.label || "Link"}: ${p.url}`);
      }
    }

    return items.length > 0 ? items.join("\n") : "—";
  };

  // Column plan: identity columns + contributor attribution + all 13 evaluation components + proof links
  type Col = { header: string; width: number; value: (s: (typeof dtos)[number]) => string | number };
  const cols: Col[] = [
    { header: "Rank", width: 7, value: (s) => s.rank ?? "" },
    { header: "Register Number [Contributor ID]", width: 18, value: (s) => s.registerNumber },
    { header: "Full Name [Responsible Contributor]", width: 26, value: (s) => s.fullName },
    { header: "College Email", width: 28, value: (s) => s.email },
    { header: "Faculty Advisor [Faculty Guide]", width: 24, value: (s) => s.facultyAdvisor ?? "School of Computing" },
  ];

  if (has("ACADEMIC")) {
    cols.push(
      { header: "10th % [Owner: Sravani]", width: 14, value: (s) => `${s.tenthPercent}%` },
      { header: "12th % [Owner: Sravani]", width: 14, value: (s) => `${s.twelfthPercent}%` },
      { header: "Degree CGPA [Owner: Sravani]", width: 14, value: (s) => s.cgpa },
      { header: "Sem 1 SGPA", width: 12, value: (s) => s.sgpaSem1 },
      { header: "Sem 2 SGPA", width: 12, value: (s) => s.sgpaSem2 },
      { header: "Academic Score (10) [Sravani]", width: 16, value: (s) => s.scores.academic },
      {
        header: "Academic Marksheet Proofs (Links) [Sravani]",
        width: 45,
        value: (s) => formatDocs(s, (cat) => cat.includes("MARKSHEET")),
      },
    );
  }

  if (has("GITHUB")) {
    cols.push(
      {
        header: "GitHub Profile URL",
        width: 32,
        value: (s) => s.githubUrl ?? "—",
      },
      {
        header: "GitHub Repos [Scraped]",
        width: 14,
        value: (s) => {
          const gh = s.scrapes?.find((x) => x.platform === "GITHUB")?.data as any;
          return gh?.publicRepos ?? "—";
        },
      },
      {
        header: "GitHub Stars [Scraped]",
        width: 14,
        value: (s) => {
          const gh = s.scrapes?.find((x) => x.platform === "GITHUB")?.data as any;
          return gh?.totalStars ?? "—";
        },
      },
      {
        header: "GitHub 1y Contribs [Scraped]",
        width: 16,
        value: (s) => {
          const gh = s.scrapes?.find((x) => x.platform === "GITHUB")?.data as any;
          return gh?.contributionsLastYear ?? "—";
        },
      },
      { header: "GitHub Score (15) [Harshitha & Harshini]", width: 22, value: (s) => s.scores.github },
    );
  }

  if (has("CODING")) {
    cols.push(
      {
        header: "LeetCode Profile URL",
        width: 32,
        value: (s) => s.leetcodeUrl ?? "—",
      },
      {
        header: "LeetCode Solved [Scraped]",
        width: 15,
        value: (s) => {
          const lc = s.scrapes?.find((x) => x.platform === "LEETCODE")?.data as any;
          return lc?.solvedTotal ?? "—";
        },
      },
      {
        header: "LeetCode Rating [Scraped]",
        width: 15,
        value: (s) => {
          const lc = s.scrapes?.find((x) => x.platform === "LEETCODE")?.data as any;
          return lc?.contestRating ? Math.round(lc.contestRating) : "—";
        },
      },
      {
        header: "Coding Score (10) [Sarvesh | Verifier: Shubhang Dharshan]",
        width: 28,
        value: (s) => s.scores.coding,
      },
    );
  }

  // Section scores and section-specific proof links
  if (has("INTERNSHIP")) {
    cols.push(
      { header: "Internships (10) [Aarya Jain & Arya G]", width: 22, value: (s) => Number(s.scores.internship) },
      {
        header: "Internship Proof Documents (Links) [Aarya & Arya]",
        width: 45,
        value: (s) => formatDocs(s, (cat) => cat === "INTERNSHIP"),
      },
    );
  }

  if (has("CERTIFICATIONS")) {
    cols.push(
      { header: "Global Certs (15) [Darshil Joshi & Rachit Jha]", width: 24, value: (s) => Number(s.scores.certifications) },
      {
        header: "Certification Proof Documents (Links) [Darshil & Rachit]",
        width: 45,
        value: (s) => formatDocs(s, (cat) => cat === "SKILL_CERT"),
      },
    );
  }

  if (has("PROJECTS")) {
    cols.push(
      { header: "Projects (5) [Ahmad Thalha, Abishai & Kunsh]", width: 24, value: (s) => Number(s.scores.projects) },
      {
        header: "Submitted Project Repos & Links [Ahmad, Abishai & Kunsh]",
        width: 45,
        value: (s) => formatProjectLinks(s, (cat) => cat === "PROJECT"),
      },
    );
  }

  if (has("FULLSTACK")) {
    cols.push(
      { header: "Full-Stack FSD (5) [Sai, Eishit & Manushree]", width: 24, value: (s) => Number(s.scores.fullstack) },
      {
        header: "Full-Stack Project & Live Demo Links [Sai, Eishit & Manushree]",
        width: 45,
        value: (s) => formatProjectLinks(s, (cat) => cat === "FULLSTACK_PROJECT"),
      },
    );
  }

  if (has("HACKATHONS")) {
    cols.push(
      { header: "Hackathons (10) [Vaishnavi, Darshil & Sharmistha]", width: 24, value: (s) => Number(s.scores.hackathons) },
      {
        header: "Hackathon Proof Documents (Links) [Vaishnavi, Darshil & Sharmistha]",
        width: 45,
        value: (s) => formatDocs(s, (cat) => cat === "COMPETITION"),
      },
    );
  }

  if (has("INHOUSE")) {
    cols.push(
      { header: "In-House UROP/SERI (8) [Vishnu, Thirisha & Abhishek]", width: 24, value: (s) => Number(s.scores.inhouse) },
      {
        header: "In-House UROP/SERI Proof Documents & Links [Vishnu, Thirisha & Abhishek]",
        width: 45,
        value: (s) => {
          const docs = formatDocs(s, (cat) => cat === "INHOUSE_PROJECT");
          const links = formatProjectLinks(s, (cat) => cat === "INHOUSE_PROJECT_LINK");
          if (docs === "—" && links === "—") return "—";
          if (docs === "—") return links;
          if (links === "—") return docs;
          return `${docs}\n\n${links}`;
        },
      },
    );
  }

  if (has("MEMBERSHIP")) {
    cols.push(
      { header: "Memberships (2) [Diksha & Adutiya]", width: 20, value: (s) => Number(s.scores.membership) },
      {
        header: "Membership Proof Documents (Links) [Diksha & Adutiya]",
        width: 45,
        value: (s) => formatDocs(s, (cat) => cat === "MEMBERSHIP"),
      },
    );
  }

  if (has("SHL")) {
    cols.push(
      { header: "SHL / NCET (10) [Krish, Sharon & Shagun]", width: 22, value: (s) => Number(s.scores.shl) },
      {
        header: "SHL Assessment Proofs (Links) [Krish, Sharon & Shagun]",
        width: 45,
        value: (s) => formatDocs(s, (cat) => cat === "SHL"),
      },
    );
  }

  cols.push(
    { header: "Total Score (100)", width: 14, value: (s) => s.scores.total },
    { header: "Status [Audit Verdict]", width: 14, value: (s) => s.status },
    {
      header: "Verified Proofs",
      width: 14,
      value: (s) => (s.documents ?? []).filter((d) => d.status === "VERIFIED").length,
    },
    { header: "Total Uploads", width: 12, value: (s) => (s.documents ?? []).length },

    // Master proof columns showing all links
    {
      header: "All Submitted Project & Portfolio Links",
      width: 50,
      value: (s) => formatAllSubmittedLinks(s),
    },
    {
      header: "All Uploaded Proof Documents (Direct View/Download Links)",
      width: 65,
      value: (s) => formatDocs(s),
    },

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
