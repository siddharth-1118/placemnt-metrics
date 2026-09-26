import {
  ShieldCheck,
  Trophy,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Badge, Card, CardContent } from "@/components/ui";
import { GithubCard } from "@/components/dashboard/github-card";
import { LeetcodeCard } from "@/components/dashboard/leetcode-card";
import { fmtPct, fmtNumber } from "@/lib/utils";
import { SCORE_CAPS } from "@/lib/types";
import type {
  GithubScrapedData,
  LeetcodeScrapedData,
  StudentDto,
} from "@/lib/types";

export function StudentSummaryCard({ s }: { s: StudentDto }) {
  const academicMarks = [
    { label: "10th Board", val: fmtPct(s.tenthPercent), weight: "Max 2.5 pts" },
    { label: "12th / Diploma", val: fmtPct(s.twelfthPercent), weight: "Max 2.5 pts" },
    { label: "Degree CGPA", val: s.cgpa.toFixed(2), weight: "Max 5.0 pts" },
  ];

  return (
    <Card className="rounded-md border border-[#e2ded5] bg-white p-5 dark:border-[#262f3c] dark:bg-[#1b222c]">
      {/* Top row: Profile meta and Score badge */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#e2ded5] pb-4 dark:border-[#262f3c] md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#165b33] text-sm font-bold text-white">
            {s.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#1c2024] dark:text-white">{s.fullName}</h2>
              <Badge variant={s.status === "VERIFIED" ? "success" : "warning"}>
                {s.status === "VERIFIED" ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {s.status === "VERIFIED" ? "Verified" : "Pending Review"}
              </Badge>
              {s.rank !== null && (
                <span className="rounded border border-[#b8ddc4] bg-[#eaf4ed] px-2 py-0.5 text-xs font-semibold text-[#165b33] dark:border-[#215736] dark:bg-[#133822] dark:text-[#78d69f]">
                  Rank #{s.rank}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-[#5c6470] dark:text-[#94a3b8]">
              <span className="font-mono text-[#1c2024] dark:text-stone-300">{s.registerNumber}</span>
              <span>·</span>
              <span>{s.email}</span>
              {s.facultyAdvisor && (
                <>
                  <span>·</span>
                  <span>FA: {s.facultyAdvisor}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Placement score highlight */}
        <div className="flex items-center gap-2">
          <div className="rounded border border-[#e2ded5] bg-[#faf8f5] px-3.5 py-2 text-right dark:border-[#262f3c] dark:bg-[#161c24]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5c6470] dark:text-[#94a3b8]">
              Placement Matrix Score
            </span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-xl font-bold text-[#165b33] dark:text-[#78d69f]">
                {s.scores.total.toFixed(1)}
              </span>
              <span className="text-xs text-[#5c6470] dark:text-[#94a3b8]">/ 100 M</span>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Marks Strip */}
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5c6470] dark:text-[#94a3b8]">
          Official Academic Records
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {academicMarks.map((m) => (
            <div
              key={m.label}
              className="rounded border border-[#e2ded5] bg-[#faf8f5] p-2.5 text-xs dark:border-[#262f3c] dark:bg-[#161c24]"
            >
              <div className="flex items-center justify-between text-[#5c6470] dark:text-[#94a3b8]">
                <span>{m.label}</span>
                <span className="text-[10px]">{m.weight}</span>
              </div>
              <p className="mt-0.5 font-mono text-base font-bold text-[#1c2024] dark:text-white">{m.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Legacy proof URLs if any */}
      {s.proofUrls.length > 0 && (
        <div className="mt-4 border-t border-[#e2ded5] pt-3 dark:border-[#262f3c]">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#5c6470] dark:text-[#94a3b8]">
            Submitted Proof Links
          </p>
          <ul className="space-y-1">
            {s.proofUrls.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-[#1c2024] dark:text-stone-300">{p.label}:</span>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-mono text-[#165b33] hover:underline dark:text-[#78d69f]"
                >
                  <span className="max-w-md truncate">{p.url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function ScrapeCards({ s, scrapes }: { s?: StudentDto; scrapes?: any[] }) {
  const scrapeList = s?.scrapes ?? scrapes ?? [];
  const gh = scrapeList.find((x) => x.platform === "GITHUB");
  const lc = scrapeList.find((x) => x.platform === "LEETCODE");
  const ghData = gh?.data && "publicRepos" in gh.data ? (gh.data as GithubScrapedData) : null;
  const lcData = lc?.data && "solvedTotal" in lc.data ? (lc.data as LeetcodeScrapedData) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ghData ? (
        <GithubCard data={ghData} />
      ) : (
        <Card className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <CardContent className="flex flex-col items-center justify-center p-4 text-center text-xs text-[#5c6470] dark:text-[#94a3b8]">
            <p className="font-semibold text-[#1c2024] dark:text-white">GitHub Profile Status</p>
            <p className="mt-1">
              {gh?.status === "RUNNING" || gh?.status === "PENDING"
                ? "Scraping profile from GitHub API in progress…"
                : s?.githubUrl
                ? `Scrape status: ${gh?.error ?? "pending"}`
                : "No GitHub profile link submitted."}
            </p>
          </CardContent>
        </Card>
      )}
      {lcData ? (
        <LeetcodeCard data={lcData} />
      ) : (
        <Card className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <CardContent className="flex flex-col items-center justify-center p-4 text-center text-xs text-[#5c6470] dark:text-[#94a3b8]">
            <p className="font-semibold text-[#1c2024] dark:text-white">LeetCode Profile Status</p>
            <p className="mt-1">
              {lc?.status === "RUNNING" || lc?.status === "PENDING"
                ? "Scraping profile from LeetCode API in progress…"
                : s?.leetcodeUrl
                ? `Scrape status: ${lc?.error ?? "pending"}`
                : "No LeetCode profile link submitted."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { fmtNumber };
