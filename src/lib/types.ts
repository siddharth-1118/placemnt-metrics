export type Platform = "GITHUB" | "LEETCODE";
export type ScrapeStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type ScrapeMode = "live" | "mock";
export type StudentStatus = "PENDING" | "VERIFIED";

/** Score caps for the placement rubric (total 100). */
export const SCORE_CAPS = {
  academic: 40, // 10th %: 10 · 12th %: 10 · CGPA: 20
  github: 15,
  coding: 10,
  projects: 10,
  internship: 10,
  extras: 15,
} as const;

export const TOTAL_CAP = 100;

export interface ProofLink {
  label: string;
  url: string;
}

/* --------------------------------- GitHub --------------------------------- */

export interface GithubRepo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  isFork: boolean;
  updatedAt: string | null;
}

export interface GithubScrapedData {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  /** Received across all public owned repos. */
  totalStars: number;
  totalForks: number;
  /** Total contributions in the last 365 days (approximated from the graph). */
  contributionsLastYear: number;
  /** 7×53 intensity grid, oldest first, matching GitHub's contribution graph. */
  contributionCalendar: { date: string; count: number }[];
  languages: { name: string; count: number; pct: number }[];
  topRepos: GithubRepo[];
}

/* -------------------------------- LeetCode -------------------------------- */

export interface LeetcodeSkillTag {
  name: string;
  /** Problems solved for this topic/language tag. */
  count: number;
}

export interface LeetcodeRecentSubmission {
  title: string;
  slug: string;
  solvedAt: string | null;
}

export interface LeetcodeScrapedData {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  country: string | null;
  aboutMe: string | null;
  githubUrl: string | null;
  /** Global ranking (null if the profile has no rank yet). */
  ranking: number | null;
  /** Contest rating (null if no contests attended). */
  contestRating: number | null;
  attendedContests: number | null;
  topPercentage: number | null;
  solvedEasy: number;
  solvedMedium: number;
  solvedHard: number;
  solvedTotal: number;
  skillTags: LeetcodeSkillTag[];
  recentSubmissions: LeetcodeRecentSubmission[];
}

/* ------------------------------ API contracts ------------------------------ */

export type DocStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface DocumentDto {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  status: DocStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  /** URL the coordinator (or owner) can fetch the file from. */
  fileUrl: string;
}

export interface ProjectLinkDto {
  id: string;
  category: string;
  label: string;
  url: string;
  status: DocStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface ScrapeJob {
  platform: Platform;
  status: ScrapeStatus;
  mode: ScrapeMode | null;
  data: GithubScrapedData | LeetcodeScrapedData | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ScoreBreakdown {
  academic: number;
  github: number;
  coding: number;
  projects: number;
  internship: number;
  extras: number;
}

export interface StudentDto {
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
  proofUrls: ProofLink[];
  status: StudentStatus;
  coordinatorNote: string | null;
  documents: DocumentDto[];
  projectLinks: ProjectLinkDto[];
  scores: ScoreBreakdown & { total: number };
  rank: number | null;
  createdAt: string;
  updatedAt: string;
  scrapes: ScrapeJob[];
}

export interface SubmitStudentInput {
  registerNumber: string;
  fullName: string;
  email: string;
  facultyAdvisor?: string;
  tenthPercent: number;
  twelfthPercent: number;
  cgpa: number;
  githubUrl?: string;
  leetcodeUrl?: string;
  proofUrls?: ProofLink[];
}
