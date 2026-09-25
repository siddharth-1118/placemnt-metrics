import { SCORE_CAPS, TOTAL_CAP, type LeetcodeScrapedData, type GithubScrapedData, type ScoreBreakdown } from "@/lib/types";

export const SCORE_CAP_KEYS = [
  "academic",
  "github",
  "coding",
  "internship",
  "certifications",
  "projects",
  "fullstack",
  "hackathons",
  "inhouse",
  "membership",
  "shl",
] as const;
export type ScoreCapKey = (typeof SCORE_CAP_KEYS)[number];

export const SCORE_LABELS: Record<ScoreCapKey, string> = {
  academic: "Academic Marks (10th 2.5 · 12th 2.5 · CGPA 5)",
  github: "GitHub Profile",
  coding: "Coding Practice Platform",
  internship: "Internship Experience",
  certifications: "Skillset & Global Certifications",
  projects: "Projects Done",
  fullstack: "Full Stack Developer Experience",
  hackathons: "Coding Competitions & Hackathons",
  inhouse: "Inhouse Projects Done",
  membership: "Membership of Professional Bodies",
  shl: "SHL / Talent Discovery / NCET",
};

function clamp(v: number, max: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, Math.round(v * 100) / 100));
}

/** Clamp a coordinator-entered breakdown to the PPT caps (total 100). */
export function clampScores(input: Partial<Record<ScoreCapKey, number>>): ScoreBreakdown & { total: number } {
  const academic = clamp(input.academic ?? 0, SCORE_CAPS.academic);
  const github = clamp(input.github ?? 0, SCORE_CAPS.github);
  const coding = clamp(input.coding ?? 0, SCORE_CAPS.coding);
  const internship = clamp(input.internship ?? 0, SCORE_CAPS.internship);
  const certifications = clamp(input.certifications ?? 0, SCORE_CAPS.certifications);
  const projects = clamp(input.projects ?? 0, SCORE_CAPS.projects);
  const fullstack = clamp(input.fullstack ?? 0, SCORE_CAPS.fullstack);
  const hackathons = clamp(input.hackathons ?? 0, SCORE_CAPS.hackathons);
  const inhouse = clamp(input.inhouse ?? 0, SCORE_CAPS.inhouse);
  const membership = clamp(input.membership ?? 0, SCORE_CAPS.membership);
  const shl = clamp(input.shl ?? 0, SCORE_CAPS.shl);
  const total = clamp(
    academic + github + coding + internship + certifications + projects + fullstack + hackathons + inhouse + membership + shl,
    TOTAL_CAP
  );
  return { academic, github, coding, internship, certifications, projects, fullstack, hackathons, inhouse, membership, shl, total };
}

/**
 * Band-based suggestion from the official PPT:
 *   10th %: 96–100→2.5 · 91–95→2 · 86–90→1.5 · 75–85→1 · <75→0.5
 *   12th %: same bands
 *   CGPA:   >9.5→5 · 9.1–9.5→4 · 8.6–9→3 · 7.5–8.5→2 · <7.5→1
 */
export function suggestAcademicScore(tenth: number, twelfth: number, cgpa: number): number {
  const tenthB = tenth >= 96 ? 2.5 : tenth >= 91 ? 2 : tenth >= 86 ? 1.5 : tenth >= 75 ? 1 : 0.5;
  const twelfthB = twelfth >= 96 ? 2.5 : twelfth >= 91 ? 2 : twelfth >= 86 ? 1.5 : twelfth >= 75 ? 1 : 0.5;
  const cgpaB = cgpa > 9.5 ? 5 : cgpa >= 9.1 ? 4 : cgpa >= 8.6 ? 3 : cgpa >= 7.5 ? 2 : 1;
  return clamp(tenthB + twelfthB + cgpaB, SCORE_CAPS.academic);
}

/** GitHub suggestion mapped to the PPT's 15-mark component (15 → 10 internal). */
export function suggestGithubScore(g?: GithubScrapedData | null): number {
  if (!g) return 0;
  // Contributions/repos last year (max 5): >20→5, 16–20→4, 11–15→3, 6–10→2, 1–5→1
  const contrib = g.contributionsLastYear >= 21 ? 5 : g.contributionsLastYear >= 16 ? 4 : g.contributionsLastYear >= 11 ? 3 : g.contributionsLastYear >= 6 ? 2 : g.contributionsLastYear >= 1 ? 1 : 0;
  // Frequency — approximated from contributions: ≥2/month→2, 1/month→1
  const freq = g.contributionsLastYear >= 24 ? 2 : g.contributionsLastYear >= 12 ? 1 : 0;
  // Community projects (max 3): 2 per project, cap 3 → approximate via stars.
  const community = g.totalStars >= 30 ? 3 : g.totalStars >= 15 ? 2 : g.totalStars >= 5 ? 1 : 0;
  // Collaborations (max 5): approximate via forks.
  const collab = g.totalForks >= 15 ? 5 : g.totalForks >= 8 ? 3 : g.totalForks >= 3 ? 1 : 0;
  return clamp(contrib + freq + community + collab, SCORE_CAPS.github);
}

/** Coding platforms suggestion mapped to the PPT's 10-mark component. */
export function suggestCodingScore(l?: LeetcodeScrapedData | null): number {
  if (!l) return 0;
  // Badges (max 5): LeetCode has no badges in the scrape — approximate from solved counts.
  const badges = l.solvedTotal >= 500 ? 5 : l.solvedTotal >= 400 ? 4 : l.solvedTotal >= 300 ? 3 : l.solvedTotal >= 150 ? 2 : l.solvedTotal >= 50 ? 1 : 0;
  // Medium & hard solved (max 5): >200→5, 150–200→4, 100–150→3, 50–100→2, 25–50→1, <25→0
  const mh = l.solvedMedium + l.solvedHard;
  const mhScore = mh > 200 ? 5 : mh >= 150 ? 4 : mh >= 100 ? 3 : mh >= 50 ? 2 : mh >= 25 ? 1 : 0;
  return clamp(badges + mhScore, SCORE_CAPS.coding);
}

/**
 * Auto-apply the scraped GitHub / LeetCode suggestions for a student, filling
 * only scores that are still zero (fresh submissions). Coordinator-entered
 * scores are never overwritten. Recomputes the total from all 11 components
 * and refreshes ranks. Called after the submit/rescrape scrapes settle.
 */
export async function applyAutoPlatformScores(studentId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { scrapes: true },
  });
  if (!student) return;

  const ghJob = student.scrapes.find((s) => s.platform === "GITHUB");
  const lcJob = student.scrapes.find((s) => s.platform === "LEETCODE");

  let ghData: GithubScrapedData | null = null;
  let lcData: LeetcodeScrapedData | null = null;
  try {
    if (ghJob?.status === "SUCCESS" && ghJob.dataJson) ghData = JSON.parse(ghJob.dataJson);
    if (lcJob?.status === "SUCCESS" && lcJob.dataJson) lcData = JSON.parse(lcJob.dataJson);
  } catch {
    // Corrupt payloads shouldn't block scoring — treat as missing.
  }

  const clamped = clampScores({
    academic: student.scoreAcademic,
    github: student.scoreGithub > 0 ? student.scoreGithub : suggestGithubScore(ghData),
    coding: student.scoreCoding > 0 ? student.scoreCoding : suggestCodingScore(lcData),
    internship: student.scoreInternship,
    certifications: student.scoreCertifications,
    projects: student.scoreProjects,
    fullstack: student.scoreFullstack,
    hackathons: student.scoreHackathons,
    inhouse: student.scoreInhouse,
    membership: student.scoreMembership,
    shl: student.scoreShl,
  });

  const unchanged =
    clamped.github === student.scoreGithub &&
    clamped.coding === student.scoreCoding &&
    clamped.total === student.totalScore;
  if (unchanged) return;

  await prisma.student.update({
    where: { id: student.id },
    data: {
      scoreGithub: clamped.github,
      scoreCoding: clamped.coding,
      totalScore: clamped.total,
    },
  });
  await assignRanks();
}

/**
 * Recompute dense placement ranks (1, 2, 3, …, ties share a rank) for all
 * students ordered by total score, then register number for stable ties.
 */
export async function assignRanks(): Promise<void> {
  // Imported lazily to keep this module edge-safe for client importers.
  const { prisma } = await import("@/lib/prisma");
  const students = await prisma.student.findMany({
    orderBy: [{ totalScore: "desc" }, { registerNumber: "asc" }],
    select: { id: true, totalScore: true },
  });

  let lastScore: number | null = null;
  let rank = 0;
  const updates: { id: string; rank: number | null }[] = [];
  for (const [i, s] of students.entries()) {
    if (s.totalScore <= 0) {
      updates.push({ id: s.id, rank: null });
      continue;
    }
    if (s.totalScore !== lastScore) {
      rank = i + 1;
      lastScore = s.totalScore;
    }
    updates.push({ id: s.id, rank });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.student.update({ where: { id: u.id }, data: { rank: u.rank } })
    )
  );
}
