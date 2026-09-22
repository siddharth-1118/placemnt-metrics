import { ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { GithubCard } from "@/components/dashboard/github-card";
import { LeetcodeCard } from "@/components/dashboard/leetcode-card";
import { fmtPct, fmtNumber } from "@/lib/utils";
import type {
  GithubScrapedData,
  LeetcodeScrapedData,
  StudentDto,
} from "@/lib/types";

export function StudentSummaryCard({ s }: { s: StudentDto }) {
  const rows: [string, string][] = [
    ["Register number", s.registerNumber],
    ["Email", s.email],
    ["Faculty advisor", s.facultyAdvisor ?? "—"],
    ["10th %", fmtPct(s.tenthPercent)],
    ["12th %", fmtPct(s.twelfthPercent)],
    ["CGPA", s.cgpa.toFixed(2)],
  ];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>My submission</CardTitle>
        <Badge variant={s.status === "VERIFIED" ? "success" : "warning"}>
          {s.status === "VERIFIED" ? <ShieldCheck className="h-3 w-3" /> : null}
          {s.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b pb-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {s.proofUrls.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proof links
            </p>
            <ul className="space-y-1">
              {s.proofUrls.map((p, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{p.label}</span>{" "}
                  <a href={p.url} target="_blank" rel="noreferrer noopener" className="break-all text-xs text-primary hover:underline">
                    {p.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Verified score:</span>{" "}
          <span className="font-semibold">{s.scores.total.toFixed(1)}</span>
          <span className="text-muted-foreground"> / 100</span>
          {s.rank !== null && <span className="text-muted-foreground"> · Rank #{s.rank}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScrapeCards({ s }: { s: StudentDto }) {
  const gh = s.scrapes.find((x) => x.platform === "GITHUB");
  const lc = s.scrapes.find((x) => x.platform === "LEETCODE");
  const ghData = gh?.data && "publicRepos" in gh.data ? (gh.data as GithubScrapedData) : null;
  const lcData = lc?.data && "solvedTotal" in lc.data ? (lc.data as LeetcodeScrapedData) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ghData ? (
        <GithubCard data={ghData} />
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {gh?.status === "RUNNING" || gh?.status === "PENDING"
              ? "GitHub scrape in progress… refresh to update."
              : s.githubUrl
                ? `GitHub scrape failed: ${gh?.error ?? "unknown error"}`
                : "No GitHub profile submitted."}
          </CardContent>
        </Card>
      )}
      {lcData ? (
        <LeetcodeCard data={lcData} />
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {lc?.status === "RUNNING" || lc?.status === "PENDING"
              ? "LeetCode scrape in progress… refresh to update."
              : s.leetcodeUrl
                ? `LeetCode scrape failed: ${lc?.error ?? "unknown error"}`
                : "No LeetCode profile submitted."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { fmtNumber };
