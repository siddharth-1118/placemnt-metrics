"use client";

import { ExternalLink, Github, Star, GitFork } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtNumber } from "@/lib/utils";
import type { GithubScrapedData } from "@/lib/types";

const LEVEL_CLASSES = [
  "bg-stone-200 dark:bg-slate-800", // 0
  "bg-[#b8ddc4] dark:bg-[#1a4a2b]", // 1
  "bg-[#68c28c] dark:bg-[#20683f]", // 2
  "bg-[#2d9a58] dark:bg-[#28844f]", // 3
  "bg-[#165b33] dark:bg-[#34a464]", // 4
];

function intensity(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function ContributionHeatmap({ days }: { days: { date: string; count: number }[] }) {
  if (!days.length) {
    return (
      <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
        Contribution calendar unavailable for this profile configuration.
      </p>
    );
  }
  const first = new Date(days[0].date + "T00:00:00Z");
  const pad = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: ({ date: string; count: number } | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...days,
  ];
  const weeks: ({ date: string; count: number } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const visibleWeeks = weeks.slice(-53);

  return (
    <div className="overflow-x-auto scrollbar-thin pb-1">
      <div className="flex gap-[3px]">
        {visibleWeeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const day = week[di];
              if (!day) return <div key={di} className="h-2.5 w-2.5 bg-transparent" />;
              return (
                <div
                  key={day.date}
                  title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`}
                  className={`h-2.5 w-2.5 rounded-[2px] ${LEVEL_CLASSES[intensity(day.count)]}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#5c6470] dark:text-[#94a3b8]">
        <span>Less</span>
        {LEVEL_CLASSES.map((c, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function GithubCard({ data }: { data: GithubScrapedData }) {
  const stats = [
    { label: "Public Repos", value: fmtNumber(data.publicRepos) },
    { label: "Total Stars", value: fmtNumber(data.totalStars) },
    { label: "Forks Received", value: fmtNumber(data.totalForks) },
    { label: "Annual Commits", value: fmtNumber(data.contributionsLastYear) },
    { label: "Followers", value: fmtNumber(data.followers) },
  ];

  return (
    <Card className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-0 pb-3 border-b border-[#e2ded5] dark:border-[#262f3c]">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatarUrl}
            alt={data.login}
            className="h-10 w-10 rounded border border-[#ded9ce] object-cover dark:border-[#333e4e]"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded bg-[#f0ece4] text-[#474f5a] dark:bg-[#232b36] dark:text-[#cbd5e1]">
            <Github className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CardTitle className="truncate text-xs font-bold text-[#1c2024] dark:text-white">
              {data.name ?? data.login}
            </CardTitle>
            <Badge variant="success">Scraped</Badge>
          </div>
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#165b33] hover:underline dark:text-[#78d69f]"
          >
            @{data.login} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0 pt-3">
        {/* Metric boxes */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded border border-[#e2ded5] bg-[#faf8f5] p-2 text-xs dark:border-[#262f3c] dark:bg-[#161c24]"
            >
              <p className="font-mono text-sm font-bold text-[#1c2024] dark:text-white">{s.value}</p>
              <p className="text-[10px] text-[#5c6470] dark:text-[#94a3b8]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Heatmap calendar */}
        <div className="rounded border border-[#e2ded5] bg-[#faf8f5] p-3 dark:border-[#262f3c] dark:bg-[#161c24]">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1c2024] dark:text-white">
              Contribution Graph (Last 365 Days)
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#165b33] dark:text-[#78d69f]">
              {data.contributionsLastYear} commits
            </span>
          </div>
          <ContributionHeatmap days={data.contributionCalendar} />
        </div>

        {/* Languages breakdown */}
        {data.languages.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1c2024] dark:text-white">
              Top Repository Languages
            </p>
            <div className="flex h-2 overflow-hidden rounded bg-stone-200 dark:bg-slate-800">
              {data.languages.map((l) => (
                <span
                  key={l.name}
                  title={`${l.name} · ${l.pct}%`}
                  style={{ width: `${l.pct}%` }}
                  className={
                    l.name === "Python"
                      ? "bg-[#2563eb]"
                      : l.name === "TypeScript"
                      ? "bg-[#3b82f6]"
                      : l.name === "JavaScript"
                      ? "bg-[#d97706]"
                      : l.name === "Java"
                      ? "bg-[#b45309]"
                      : l.name === "C++"
                      ? "bg-[#059669]"
                      : "bg-[#165b33]"
                  }
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
              {data.languages.map((l) => (
                <span key={l.name}>
                  <strong className="text-[#1c2024] dark:text-stone-300">{l.name}</strong> {l.pct}%
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top Repositories */}
        {data.topRepos.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1c2024] dark:text-white">
              Featured Public Repositories
            </p>
            <ul className="space-y-1.5">
              {data.topRepos.slice(0, 4).map((r) => (
                <li
                  key={r.name}
                  className="rounded border border-[#e2ded5] bg-[#faf8f5] p-2 text-xs dark:border-[#262f3c] dark:bg-[#161c24]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-bold text-[#165b33] hover:underline dark:text-[#78d69f]"
                    >
                      {r.name}
                    </a>
                    <div className="flex items-center gap-2.5 text-[#5c6470] dark:text-[#94a3b8]">
                      {r.language && (
                        <span className="rounded bg-white px-1.5 py-0.2 text-[10px] text-[#1c2024] border border-[#ded9ce] dark:bg-[#232b36] dark:border-[#323d4c] dark:text-[#cbd5e1]">
                          {r.language}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 font-mono text-[11px]">
                        <Star className="h-3 w-3 text-amber-600" /> {fmtNumber(r.stars)}
                      </span>
                      <span className="flex items-center gap-0.5 font-mono text-[11px]">
                        <GitFork className="h-3 w-3" /> {fmtNumber(r.forks)}
                      </span>
                    </div>
                  </div>
                  {r.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">{r.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
