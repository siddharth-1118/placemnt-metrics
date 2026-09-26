"use client";

import { ExternalLink, Code2 } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtNumber } from "@/lib/utils";
import type { LeetcodeScrapedData } from "@/lib/types";

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded border border-[#e2ded5] bg-[#faf8f5] p-2 text-xs dark:border-[#262f3c] dark:bg-[#161c24]">
      <p className="font-mono text-sm font-bold text-[#1c2024] dark:text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[#5c6470] dark:text-[#94a3b8]">{label}</p>
    </div>
  );
}

export function LeetcodeCard({ data }: { data: LeetcodeScrapedData }) {
  const diffRows: [string, number, string, string][] = [
    ["Easy", data.solvedEasy, "text-[#165b33] dark:text-[#78d69f]", "bg-[#165b33]"],
    ["Medium", data.solvedMedium, "text-[#92540d] dark:text-[#f3b55c]", "bg-[#d97706]"],
    ["Hard", data.solvedHard, "text-[#a82424] dark:text-[#f38d8d]", "bg-[#a82424]"],
  ];

  return (
    <Card className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-0 pb-3 border-b border-[#e2ded5] dark:border-[#262f3c]">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatarUrl}
            alt={data.username}
            className="h-10 w-10 rounded border border-[#ded9ce] object-cover dark:border-[#333e4e]"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded bg-[#f0ece4] text-[#474f5a] dark:bg-[#232b36] dark:text-[#cbd5e1]">
            <Code2 className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CardTitle className="truncate text-xs font-bold text-[#1c2024] dark:text-white">
              {data.name ?? data.username}
            </CardTitle>
            <Badge variant="success">Scraped</Badge>
          </div>
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#165b33] hover:underline dark:text-[#78d69f]"
          >
            @{data.username} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {data.ranking !== null && (
          <span className="rounded border border-[#ded9ce] bg-[#faf8f5] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#1c2024] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#f0ede6]">
            Rank #{fmtNumber(data.ranking)}
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-4 p-0 pt-3">
        {/* Metric boxes */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={fmtNumber(data.solvedTotal)} label="Problems Solved" />
          <Stat
            value={data.contestRating !== null ? fmtNumber(Math.round(data.contestRating)) : "—"}
            label="Contest Rating"
          />
          <Stat
            value={data.attendedContests !== null ? fmtNumber(data.attendedContests) : "—"}
            label="Contests Attended"
          />
          <Stat
            value={data.topPercentage !== null ? `Top ${data.topPercentage}%` : "—"}
            label="Global Percentile"
          />
        </div>

        {/* Difficulty breakdown bar */}
        <div className="rounded border border-[#e2ded5] bg-[#faf8f5] p-3 dark:border-[#262f3c] dark:bg-[#161c24]">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1c2024] dark:text-white">Solved by Difficulty</span>
            <span className="font-mono text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
              {data.solvedTotal} total solved
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded bg-stone-200 dark:bg-slate-800">
            {data.solvedTotal > 0 &&
              diffRows.map(([label, n, _, bg]) => (
                <span
                  key={label}
                  title={`${label}: ${n}`}
                  className={bg}
                  style={{ width: `${(n / data.solvedTotal) * 100}%` }}
                />
              ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            {diffRows.map(([label, n, textClr]) => (
              <span key={label} className="flex items-center gap-1">
                <span className="text-[#5c6470] dark:text-[#94a3b8]">{label}:</span>
                <span className={`font-mono font-bold ${textClr}`}>{n}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Badges strip if any */}
        {data.badges.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1c2024] dark:text-white">
              Earned Badges &amp; Recognitions ({data.badges.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.badges.map((b) => (
                <span
                  key={b.name}
                  className="rounded border border-[#e2ded5] bg-[#faf8f5] px-2 py-0.5 text-[11px] text-[#1c2024] dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#f0ede6]"
                >
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
