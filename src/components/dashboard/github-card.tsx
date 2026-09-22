"use client";

import { ExternalLink, Github, Star, GitFork, Users } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtNumber } from "@/lib/utils";
import type { GithubScrapedData } from "@/lib/types";

const LEVEL_CLASSES = [
  "bg-muted", // 0
  "bg-emerald-200", // 1
  "bg-emerald-400", // 2
  "bg-emerald-500", // 3
  "bg-emerald-700", // 4
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
      <p className="text-sm text-muted-foreground">
        Contribution calendar unavailable (GitHub limits this for some profiles).
      </p>
    );
  }
  // Pad the first week so columns align to weekdays (Mon-first like GitHub).
  const first = new Date(days[0].date + "T00:00:00Z");
  const pad = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: ({ date: string; count: number } | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...days,
  ];
  const weeks: ({ date: string; count: number } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  // Cap displayed columns so the grid stays readable in the modal.
  const visibleWeeks = weeks.slice(-53);

  return (
    <div className="overflow-x-auto scrollbar-thin pb-1">
      <div className="flex gap-[3px]">
        {visibleWeeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const day = week[di];
              if (!day) return <div key={di} className="h-3 w-3 rounded-[3px] bg-transparent" />;
              return (
                <div
                  key={day.date}
                  title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`}
                  className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASSES[intensity(day.count)]}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        Less
        {LEVEL_CLASSES.map((c, i) => (
          <span key={i} className={`h-3 w-3 rounded-[3px] ${c}`} />
        ))}
        More
      </div>
    </div>
  );
}

export function GithubCard({ data }: { data: GithubScrapedData }) {
  const stats = [
    { label: "Public repos", value: fmtNumber(data.publicRepos) },
    { label: "Stars", value: fmtNumber(data.totalStars) },
    { label: "Forks", value: fmtNumber(data.totalForks) },
    { label: "Contributions (1y)", value: fmtNumber(data.contributionsLastYear) },
    { label: "Followers", value: fmtNumber(data.followers) },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt={data.login} className="h-11 w-11 rounded-full border" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Github className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{data.name ?? data.login}</CardTitle>
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            @{data.login} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {data.bio && <p className="hidden truncate text-xs text-muted-foreground sm:block">{data.bio}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-lg font-semibold leading-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contribution activity (past year)
          </p>
          <ContributionHeatmap days={data.contributionCalendar} />
        </div>

        {data.languages.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top languages
            </p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {data.languages.map((l) => (
                <span
                  key={l.name}
                  title={`${l.name} · ${l.pct}%`}
                  style={{ width: `${l.pct}%` }}
                  className={l.name === "Python" ? "bg-blue-500" : l.name === "TypeScript" ? "bg-blue-600" : l.name === "JavaScript" ? "bg-amber-400" : l.name === "Java" ? "bg-orange-500" : l.name === "C++" ? "bg-pink-600" : l.name === "C" ? "bg-slate-500" : "bg-emerald-500"}
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {data.languages.map((l) => (
                <span key={l.name}>
                  <span className="font-medium text-foreground">{l.name}</span> {l.pct}%
                </span>
              ))}
            </div>
          </div>
        )}

        {data.topRepos.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top repositories
            </p>
            <ul className="space-y-2">
              {data.topRepos.slice(0, 5).map((r) => (
                <li key={r.name} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {r.name}
                    </a>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {r.language && <Badge variant="outline">{r.language}</Badge>}
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3" /> {fmtNumber(r.stars)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <GitFork className="h-3 w-3" /> {fmtNumber(r.forks)}
                      </span>
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.description}</p>
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
