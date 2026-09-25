import { clampScores } from "@/lib/score";
import type { StudentDto } from "@/lib/types";

interface DocRow {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  status: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

interface LinkRow {
  id: string;
  category: string;
  label: string;
  url: string;
  status: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

export function docToDto(d: DocRow): StudentDto["documents"][number] {
  return {
    id: d.id,
    category: d.category,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    note: d.note,
    status: d.status === "VERIFIED" ? "VERIFIED" : d.status === "REJECTED" ? "REJECTED" : "PENDING",
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    reviewNote: d.reviewNote,
    createdAt: d.createdAt.toISOString(),
    // Session-authenticated (owner or evaluator); token param also accepted.
    fileUrl: `/api/documents/${d.id}/file`,
  };
}

export function linkToDto(l: LinkRow): StudentDto["projectLinks"][number] {
  return {
    id: l.id,
    category: l.category,
    label: l.label,
    url: l.url,
    status: l.status === "VERIFIED" ? "VERIFIED" : l.status === "REJECTED" ? "REJECTED" : "PENDING",
    reviewedAt: l.reviewedAt?.toISOString() ?? null,
    reviewNote: l.reviewNote,
    createdAt: l.createdAt.toISOString(),
  };
}

/** Map a Prisma student (+ scrapes) to the API DTO. */
export function toDto(
  s: {
  id: string;
  registerNumber: string;
  fullName: string;
  email: string;
  facultyAdvisor: string | null;
  tenthPercent: number;
  twelfthPercent: number;
  cgpa: number;
  githubUrl: string | null;
  leetcodeUrl: string | null;
  proofUrls: string;
  status: string;
  coordinatorNote: string | null;
  scoreAcademic: number;
  scoreGithub: number;
  scoreCoding: number;
  scoreInternship: number;
  scoreCertifications: number;
  scoreProjects: number;
  scoreFullstack: number;
  scoreHackathons: number;
  scoreInhouse: number;
  scoreMembership: number;
  scoreShl: number;
  totalScore: number;
  rank: number | null;
  createdAt: Date;
  updatedAt: Date;
  scrapes: {
    platform: string;
    status: string;
    mode: string | null;
    dataJson: string | null;
    errorMessage: string | null;
    startedAt: Date;
    finishedAt: Date | null;
  }[];
  documents?: DocRow[];
  projectLinks?: LinkRow[];
},
  documentsArg?: DocRow[],
  linksArg?: LinkRow[]): StudentDto {
  let proofUrls: StudentDto["proofUrls"] = [];
  try {
    const parsed = JSON.parse(s.proofUrls || "[]");
    if (Array.isArray(parsed)) {
      proofUrls = parsed.filter(
        (p): p is { label: string; url: string } =>
          typeof p === "object" && p !== null && typeof (p as { label?: unknown }).label === "string"
      );
    }
  } catch {
    proofUrls = [];
  }

  return {
    id: s.id,
    registerNumber: s.registerNumber,
    fullName: s.fullName,
    email: s.email,
    facultyAdvisor: s.facultyAdvisor,
    tenthPercent: s.tenthPercent,
    twelfthPercent: s.twelfthPercent,
    cgpa: s.cgpa,
    githubUrl: s.githubUrl,
    leetcodeUrl: s.leetcodeUrl,
    proofUrls,
    status: s.status === "VERIFIED" ? "VERIFIED" : "PENDING",
    coordinatorNote: s.coordinatorNote,
    documents: (documentsArg ?? s.documents ?? []).map(docToDto),
    projectLinks: (linksArg ?? s.projectLinks ?? []).map(linkToDto),
    scores: clampScores({
      academic: s.scoreAcademic,
      github: s.scoreGithub,
      coding: s.scoreCoding,
      internship: s.scoreInternship,
      certifications: s.scoreCertifications,
      projects: s.scoreProjects,
      fullstack: s.scoreFullstack,
      hackathons: s.scoreHackathons,
      inhouse: s.scoreInhouse,
      membership: s.scoreMembership,
      shl: s.scoreShl,
    }),
    rank: s.rank,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    scrapes: s.scrapes.map((sc) => {
      let data: StudentDto["scrapes"][number]["data"] = null;
      if (sc.dataJson) {
        try {
          data = JSON.parse(sc.dataJson);
        } catch {
          data = null;
        }
      }
      return {
        platform: sc.platform as StudentDto["scrapes"][number]["platform"],
        status: sc.status as StudentDto["scrapes"][number]["status"],
        mode: sc.mode === "live" ? "live" : sc.mode === "mock" ? "mock" : null,
        data,
        error: sc.errorMessage,
        startedAt: sc.startedAt.toISOString(),
        finishedAt: sc.finishedAt?.toISOString() ?? null,
      };
    }),
  };
}
