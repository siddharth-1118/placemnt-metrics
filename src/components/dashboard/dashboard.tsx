"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, ChevronsUpDown, Code2, FileCheck2, Github, Loader2, RefreshCw, Search, Users,
} from "lucide-react";
import { Badge, Button, Card, CardContent, Input } from "@/components/ui";
import { StudentDetailModal } from "@/components/dashboard/student-detail-modal";
import { fmtPct, timeAgo } from "@/lib/utils";
import type { StudentDto } from "@/lib/types";

type SortKey = "rank" | "totalScore" | "cgpa" | "name" | "registerNumber";
type StatusFilter = "ALL" | "PENDING" | "VERIFIED";
type ProfileFilter = "ALL" | "BOTH" | "GITHUB_ONLY" | "LEETCODE_ONLY" | "NONE";

function scrapeSummary(s: StudentDto, platform: "GITHUB" | "LEETCODE") {
  const job = s.scrapes.find((x) => x.platform === platform);
  if (!job) return { text: "not provided", tone: "muted" as const };
  if (job.status === "RUNNING" || job.status === "PENDING") return { text: "scraping…", tone: "warn" as const };
  if (job.status === "FAILED") return { text: "failed", tone: "bad" as const };
  if (platform === "GITHUB" && job.data && "publicRepos" in job.data) {
    const d = job.data;
    return { text: `${d.publicRepos} repos · ★${d.totalStars} · ${d.contributionsLastYear} commits`, tone: "good" as const };
  }
  if (platform === "LEETCODE" && job.data && "solvedTotal" in job.data) {
    const d = job.data;
    const rating = d.contestRating !== null ? ` · ${Math.round(d.contestRating)} rating` : "";
    return { text: `${d.solvedTotal} solved${rating}`, tone: "good" as const };
  }
  return { text: "—", tone: "muted" as const };
}

function DocsCell({ s }: { s: StudentDto }) {
  const docs = s.documents?.length ?? 0;
  const links = s.projectLinks?.length ?? 0;
  if (docs === 0 && links === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const verified = (s.documents ?? []).filter((d) => d.status === "VERIFIED").length
    + (s.projectLinks ?? []).filter((l) => l.status === "VERIFIED").length;
  const total = docs + links;
  const rejected = (s.documents ?? []).filter((d) => d.status === "REJECTED").length
    + (s.projectLinks ?? []).filter((l) => l.status === "REJECTED").length;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <FileCheck2 className="h-3.5 w-3.5 opacity-70" />
      <span className="tabular-nums">{verified}/{total}</span>
      {rejected > 0 && <span className="text-destructive">· {rejected} rej</span>}
    </span>
  );
}

function SummaryCell({ s, platform }: { s: StudentDto; platform: "GITHUB" | "LEETCODE" }) {
  const { text, tone } = scrapeSummary(s, platform);
  const cls = {
    good: "text-foreground",
    warn: "text-amber-600",
    bad: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];
  const Icon = platform === "GITHUB" ? Github : Code2;
  return (
    <span className={`inline-flex items-center gap-1.5 ${cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function Dashboard() {
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("totalScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/students", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load students");
      const body = await res.json();
      setStudents(body.students);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for scrape completions while anything is in flight.
  const anyRunning = students.some((s) => s.scrapes.some((j) => j.status === "RUNNING" || j.status === "PENDING"));
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [anyRunning, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students.filter((s) => {
      if (q && !`${s.fullName} ${s.registerNumber} ${s.email}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (profileFilter === "BOTH" && !(s.githubUrl && s.leetcodeUrl)) return false;
      if (profileFilter === "GITHUB_ONLY" && (!s.githubUrl || s.leetcodeUrl)) return false;
      if (profileFilter === "LEETCODE_ONLY" && (s.githubUrl || !s.leetcodeUrl)) return false;
      if (profileFilter === "NONE" && (s.githubUrl || s.leetcodeUrl)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "rank": {
          const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
          const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
          return (ra - rb) * dir;
        }
        case "cgpa":
          return (a.cgpa - b.cgpa) * dir;
        case "name":
          return a.fullName.localeCompare(b.fullName) * dir;
        case "registerNumber":
          return a.registerNumber.localeCompare(b.registerNumber) * dir;
        default:
          return (a.scores.total - b.scores.total) * dir;
      }
    });
    return list;
  }, [students, query, statusFilter, profileFilter, sortKey, sortDir]);

  const stats = useMemo(
    () => ({
      total: students.length,
      verified: students.filter((s) => s.status === "VERIFIED").length,
      pending: students.filter((s) => s.status === "PENDING").length,
      avgScore: students.length
        ? Math.round((students.reduce((a, s) => a + s.scores.total, 0) / students.length) * 10) / 10
        : 0,
    }),
    [students]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "registerNumber" ? "asc" : "desc");
    }
  }

  async function rescrape(s: StudentDto, e: React.MouseEvent) {
    e.stopPropagation();
    setBusyId(s.id);
    try {
      await fetch(`/api/students/${s.id}/rescrape`, { method: "POST" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const selectCls =
    "h-9 rounded-lg border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Students", value: stats.total, icon: Users },
          { label: "Verified", value: stats.verified, icon: Award },
          { label: "Pending review", value: stats.pending, icon: Loader2 },
          { label: "Avg. score", value: stats.avgScore, icon: Award },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 pt-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <c.icon className="h-4.5 w-4.5 text-primary" />
              </span>
              <div>
                <p className="text-xl font-bold leading-tight">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, register number or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
        </select>
        <select className={selectCls} value={profileFilter} onChange={(e) => setProfileFilter(e.target.value as ProfileFilter)} aria-label="Filter by linked profiles">
          <option value="ALL">All profiles</option>
          <option value="BOTH">GitHub + LeetCode</option>
          <option value="GITHUB_ONLY">GitHub only</option>
          <option value="LEETCODE_ONLY">LeetCode only</option>
          <option value="NONE">No profiles</option>
        </select>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card scrollbar-thin">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th onClick={() => toggleSort("rank")}>Rank</Th>
              <Th onClick={() => toggleSort("registerNumber")}>Reg. no.</Th>
              <Th onClick={() => toggleSort("name")}>Name</Th>
              <Th onClick={() => toggleSort("cgpa")}>CGPA</Th>
              <Th>10th</Th>
              <Th>12th</Th>
              <Th>GitHub (scraped)</Th>
              <Th>LeetCode (scraped)</Th>
              <Th>Docs</Th>
              <Th>Status</Th>
              <Th onClick={() => toggleSort("totalScore")}>Score</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading submissions…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  No students match the current filters. Try{" "}
                  <button className="text-primary underline" onClick={() => { setQuery(""); setStatusFilter("ALL"); setProfileFilter("ALL"); }}>
                    clearing filters
                  </button>
                  .
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="cursor-pointer border-t transition-colors hover:bg-accent/50"
              >
                <td className="px-3 py-2.5 font-semibold tabular-nums">{s.rank ? `#${s.rank}` : "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{s.registerNumber}</td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{s.fullName}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{s.cgpa.toFixed(2)}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{fmtPct(s.tenthPercent)}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{fmtPct(s.twelfthPercent)}</td>
                <td className="max-w-[220px] px-3 py-2.5"><SummaryCell s={s} platform="GITHUB" /></td>
                <td className="max-w-[220px] px-3 py-2.5"><SummaryCell s={s} platform="LEETCODE" /></td>
                <td className="px-3 py-2.5"><DocsCell s={s} /></td>
                <td className="px-3 py-2.5">
                  <Badge variant={s.status === "VERIFIED" ? "success" : "warning"}>{s.status}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-semibold tabular-nums">{s.scores.total.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Re-scrape profiles"
                    disabled={busyId === s.id}
                    onClick={(e) => rescrape(s, e)}
                  >
                    {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Click a row to open the evaluation modal with live scraped profiles and the score panel. Scrapes refresh automatically while jobs run.
      </p>

      {selectedId && (
        <StudentDetailModal
          studentId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function Th({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) {
  return (
    <th className="px-3 py-2.5 font-medium">
      {onClick ? (
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
          {children} <ChevronsUpDown className="h-3 w-3 opacity-60" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}
