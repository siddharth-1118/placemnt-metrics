import { ExternalLink, Code2 } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtNumber } from "@/lib/utils";
import type { LeetcodeScrapedData } from "@/lib/types";

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <p className={`text-lg font-semibold leading-tight ${accent ?? ""}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function LeetcodeCard({ data }: { data: LeetcodeScrapedData }) {
  const diffRows: [string, number, string][] = [
    ["Easy", data.solvedEasy, "text-emerald-600"],
    ["Medium", data.solvedMedium, "text-amber-600"],
    ["Hard", data.solvedHard, "text-rose-600"],
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt={data.username} className="h-11 w-11 rounded-full border object-cover" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
            <Code2 className="h-5 w-5 text-amber-700" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{data.name ?? data.username}</CardTitle>
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            @{data.username} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {data.ranking !== null && (
          <Badge variant="secondary">Rank #{fmtNumber(data.ranking)}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={fmtNumber(data.solvedTotal)} label="Problems solved" />
          <Stat
            value={data.contestRating !== null ? fmtNumber(Math.round(data.contestRating)) : "—"}
            label="Contest rating"
          />
          <Stat value={data.attendedContests !== null ? fmtNumber(data.attendedContests) : "—"} label="Contests" />
          <Stat
            value={data.topPercentage !== null ? `Top ${data.topPercentage}%` : "—"}
            label="Percentile"
          />
        </div>

        {/* Difficulty breakdown bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Solved by difficulty</span>
            <span className="text-muted-foreground">{data.solvedTotal} total</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {data.solvedTotal > 0 &&
              diffRows.map(([label, n, accent]) => (
                <span
                  key={label}
                  title={`${label}: ${n}`}
                  className={label === "Easy" ? "bg-emerald-500" : label === "Medium" ? "bg-amber-500" : "bg-rose-500"}
                  style={{ width: `${(n / data.solvedTotal) * 100}%` }}
                />
              ))}
          </div>
          <div className="mt-1.5 flex gap-4 text-xs">
            {diffRows.map(([label, n, accent]) => (
              <span key={label} className={accent}>
                {label}: <span className="font-semibold tabular-nums">{n}</span>
              </span>
            ))}
          </div>
        </div>

        {data.skillTags.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.skillTags.map((t) => (
                <Badge key={t.name} variant="outline">
                  {t.name} · {t.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data.recentSubmissions.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent accepted submissions
            </p>
            <ul className="space-y-1">
              {data.recentSubmissions.slice(0, 5).map((s) => (
                <li key={s.slug} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <a
                    href={`https://leetcode.com/problems/${s.slug}/`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate font-medium text-primary hover:underline"
                  >
                    {s.title}
                  </a>
                  {s.solvedAt && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(s.solvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
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
