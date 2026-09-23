import { SCORE_CAPS, TOTAL_CAP, type LeetcodeScrapedData, type GithubScrapedData, type ScoreBreakdown } from "@/lib/types";

export const SCORE_CAP_KEYS = ["academic", "github", "coding", "projects", "internship", "extras"] as const;
export type ScoreCapKey = (typeof SCORE_CAP_KEYS)[number];

export const SCORE_LABELS: Record<ScoreCapKey, string> = {
  academic: "Academic Marks",
  github: "GitHub Profile",
  coding: "Coding Platforms",
  projects: "Projects",
  internship: "Internships",
  extras: "Extras & Certifications",
};

function clamp(v: number, max: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, Math.round(v * 100) / 100));
}

/** Clamp a coordinator-entered breakdown to the rubric caps. */
export function clampScores(input: Partial<Record<ScoreCapKey, number>>): ScoreBreakdown & { total: number } {
  const academic = clamp(input.academic ?? 0, SCORE_CAPS.academic);
  const github = clamp(input.github ?? 0, SCORE_CAPS.github);
  const coding = clamp(input.coding ?? 0, SCORE_CAPS.coding);
  const projects = clamp(input.projects ?? 0, SCORE_CAPS.projects);
  const internship = clamp(input.internship ?? 0, SCORE_CAPS.internship);
  const extras = clamp(input.extras ?? 0, SCORE_CAPS.extras);
  const total = clamp(
    academic + github + coding + projects + internship + extras,
    TOTAL_CAP
  );
  return { academic, github, coding, projects, internship, extras, total };
}

/**
 * Deterministic auto-score suggestion derived from scraped metrics — shown to
 * coordinators as a starting point; they can override every field.
 */
export function suggestGithubScore(g?: GithubScrapedData | null): number {
  if (!g) return 0;
  let s = 0;
  // Repos (max 4): >=20 repos → 4, >=10 → 3, >=5 → 2, >=1 → 1
  s += g.publicRepos >= 20 ? 4 : g.publicRepos >= 10 ? 3 : g.publicRepos >= 5 ? 2 : g.publicRepos >= 1 ? 1 : 0;
  // Contributions (max 4): >=500 → 4, >=250 → 3, >=100 → 2, >=25 → 1
  s += g.contributionsLastYear >= 500 ? 4 : g.contributionsLastYear >= 250 ? 3 : g.contributionsLastYear >= 100 ? 2 : g.contributionsLastYear >= 25 ? 1 : 0;
  // Stars (max 4): >=50 → 4, >=15 → 3, >=5 → 2, >=1 → 1
  s += g.totalStars >= 50 ? 4 : g.totalStars >= 15 ? 3 : g.totalStars >= 5 ? 2 : g.totalStars >= 1 ? 1 : 0;
  // Language breadth (max 3): >=6 → 3, >=4 → 2, >=2 → 1
  s += g.languages.length >= 6 ? 3 : g.languages.length >= 4 ? 2 : g.languages.length >= 2 ? 1 : 0;
  return clamp(s, SCORE_CAPS.github);
}

export function suggestCodingScore(l?: LeetcodeScrapedData | null): number {
  if (!l) return 0;
  let s = 0;
  // Total solved (max 4): >=500 → 4, >=300 → 3, >=150 → 2, >=50 → 1
  s += l.solvedTotal >= 500 ? 4 : l.solvedTotal >= 300 ? 3 : l.solvedTotal >= 150 ? 2 : l.solvedTotal >= 50 ? 1 : 0;
  // Difficulty mix (max 3): hard problems show depth
  s += l.solvedHard >= 50 ? 3 : l.solvedHard >= 20 ? 2 : l.solvedHard >= 5 ? 1 : 0;
  // Contest rating (max 3): >=2000 → 3, >=1800 → 2, >=1600 → 1
  s += (l.contestRating ?? 0) >= 2000 ? 3 : (l.contestRating ?? 0) >= 1800 ? 2 : (l.contestRating ?? 0) >= 1600 ? 1 : 0;
  return clamp(s, SCORE_CAPS.coding);
}

export function suggestAcademicScore(tenth: number, twelfth: number, cgpa: number): number {
  const tenthP = (Math.max(0, Math.min(100, tenth)) / 100) * 10;
  const twelfthP = (Math.max(0, Math.min(100, twelfth)) / 100) * 10;
  const cgpaP = (Math.max(0, Math.min(10, cgpa)) / 10) * 20;
  return clamp(tenthP + twelfthP + cgpaP, SCORE_CAPS.academic);
}

/**
 * Auto-apply the scraped GitHub / LeetCode suggestions for a student, filling
 * only scores that are still zero (fresh submissions). Coordinator-entered
 * scores are never overwritten. Recomputes the total from all six components
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

  const ghSuggested = suggestGithubScore(ghData);
  const lcSuggested = suggestCodingScore(lcData);

  // Fill zeros only — an explicit coordinator score always wins.
  const merged = {
    academic: student.scoreAcademic,
    github: student.scoreGithub > 0 ? student.scoreGithub : ghSuggested,
    coding: student.scoreCoding > 0 ? student.scoreCoding : lcSuggested,
    projects: student.scoreProjects,
    internship: student.scoreInternship,
    extras: student.scoreExtras,
  };
  const clamped = clampScores(merged);

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
