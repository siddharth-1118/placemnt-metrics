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
  badges?: LeetcodeBadge[];
  recentSubmissions: LeetcodeRecentSubmission[];
}

export interface LeetcodeBadge {
  name: string;
  icon?: string | null;
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

export interface SrmMetricCriterion {
  id: string;
  name: string;
  allottedMarks: number;
  splitUp: string;
}

export const SRM_OFFICIAL_METRICS: SrmMetricCriterion[] = [
  {
    id: "metric-1",
    name: "10th Standard Academic Marksheet",
    allottedMarks: 2.5,
    splitUp: ">=96% (2.5 M), 91-95% (2.0 M), 86-90% (1.5 M), 75-85% (1.0 M), <75% (0.5 M)",
  },
  {
    id: "metric-2",
    name: "12th Standard Academic Marksheet",
    allottedMarks: 2.5,
    splitUp: ">=96% (2.5 M), 91-95% (2.0 M), 86-90% (1.5 M), 75-85% (1.0 M), <75% (0.5 M)",
  },
  {
    id: "metric-3",
    name: "Degree CGPA / Semester Academic Record",
    allottedMarks: 5.0,
    splitUp: ">9.5 (5.0 M), 9.1-9.5 (4.0 M), 8.6-9.0 (3.0 M), 7.5-8.5 (2.0 M), <7.5 (1.0 M)",
  },
  {
    id: "metric-4",
    name: "GitHub Repositories & 1-Year Contributions",
    allottedMarks: 5.0,
    splitUp: ">=500 contribs / 20 repos (5 M), >=250 contribs / 10 repos (4 M), >=100 contribs (3 M)",
  },
  {
    id: "metric-5",
    name: "GitHub Consistency, Stars & Community Activity",
    allottedMarks: 5.0,
    splitUp: "Consistent monthly commit activity, repository stars earned, followers & community profile",
  },
  {
    id: "metric-6",
    name: "GitHub Collaborations & Open Source Pull Requests",
    allottedMarks: 5.0,
    splitUp: "External repository contributions, merged pull requests, and collaborative team repositories",
  },
  {
    id: "metric-7",
    name: "Coding Platforms: Badges & Topic Recognitions",
    allottedMarks: 5.0,
    splitUp: "50/100-day consistency badges, annual challenge badges, and study plan completion",
  },
  {
    id: "metric-8",
    name: "Coding Platforms: Medium & Hard Problems Solved",
    allottedMarks: 5.0,
    splitUp: ">=50 Hard / >=150 Medium (5 M), >=20 Hard / >=80 Medium (3 M), >=5 Hard / >=30 Medium (1.5 M)",
  },
  {
    id: "metric-9",
    name: "Internship & Research Experience",
    allottedMarks: 10.0,
    splitUp: "DRDO / ISRO / IIT / NIT / Research Labs (5 M) | Fortune 500 (4 M) | Startups (3 M) | <3 Mo (2 M)",
  },
  {
    id: "metric-10",
    name: "Core Project Portfolio & Live Deployments",
    allottedMarks: 5.0,
    splitUp: "Functional deployed applications with live demo link, structured repository, and documentation",
  },
  {
    id: "metric-11",
    name: "Full-Stack Development (FSD) Project",
    allottedMarks: 5.0,
    splitUp: "End-to-end full-stack project (frontend + API + database + secure user authentication)",
  },
  {
    id: "metric-12",
    name: "In-House Projects (UROP / SERI / Campus Initiatives)",
    allottedMarks: 8.0,
    splitUp: "Undergraduate Research Opportunity (UROP) or SERI campus research project with approved report",
  },
  {
    id: "metric-13",
    name: "Global Certs, Hackathons, SHL Assessment & Memberships",
    allottedMarks: 37.0,
    splitUp: "Global Certifications (15 M) + Hackathons (10 M) + SHL/NCET Assessment (10 M) + Professional Memberships (2 M)",
  },
];
