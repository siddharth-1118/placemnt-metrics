"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Download,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { StudentDetailModal } from "@/components/dashboard/student-detail-modal";
import { scopesAreFull, type ScoreScope } from "@/lib/scopes";
import { SRM_OFFICIAL_METRICS, type StudentDto } from "@/lib/types";

type SortKey = "rank" | "totalScore" | "cgpa" | "name" | "registerNumber";
type StatusFilter = "ALL" | "PENDING" | "VERIFIED";
type ActiveSection = "STUDENTS" | "SCORES" | "MATRIX" | "REPORTS";

export function Dashboard({
  canScore = true,
  /** Super admin — may view every section regardless of scopes. */
  isSuperAdmin = false,
  permissionScopes = [],
}: {
  canScore?: boolean;
  isSuperAdmin?: boolean;
  /** Rubric sections this coordinator may view & score; empty = all. */
  permissionScopes?: ScoreScope[];
}) {
  // The columns this viewer may see; the server already strips the data for
  // out-of-scope fields, so this is purely visual (no empty columns).
  const has = (s: ScoreScope) => isSuperAdmin || scopesAreFull(permissionScopes) || permissionScopes.includes(s);
  const canSeeAcademic = has("ACADEMIC");
  const canSeeGithub = has("GITHUB");
  const canSeeCoding = has("CODING");
  const colCount = 6 + (canSeeAcademic ? 3 : 0) + (canSeeGithub ? 1 : 0) + (canSeeCoding ? 1 : 0);
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("STUDENTS");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/students", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError("Access restricted to authorized faculty coordinators.");
        } else {
          setError("Failed to load student placement records.");
        }
        return;
      }
      const data = await res.json();
      setStudents(data.students ?? []);
    } catch {
      setError("Network connection error. Could not reach server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function recalculate() {
    setRecalcBusy(true);
    setRecalcMsg(null);
    try {
      const res = await fetch("/api/students/recalculate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recalculation failed");
      setRecalcMsg(
        `Score recalculation complete: ${data.updatedScores} student scores and ranks updated.`
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Recalculation failed");
    } finally {
      setRecalcBusy(false);
    }
  }

  function exportToCsv() {
    if (!students.length) return;
    const headers = [
      "Rank",
      "Register Number",
      "Full Name",
      "Email",
      "CGPA",
      "Academic Score (10)",
      "GitHub Score (15)",
      "Coding Score (10)",
      "Internship Score (10)",
      "Certifications Score (15)",
      "Projects Score (5)",
      "Full-stack Score (5)",
      "Hackathons Score (10)",
      "In-house Score (8)",
      "Membership Score (2)",
      "SHL Score (10)",
      "Matrix Score (100)",
      "Status",
    ];

    const rows = students.map((s) => [
      s.rank ?? "—",
      `"${s.registerNumber}"`,
      `"${s.fullName}"`,
      `"${s.email}"`,
      s.cgpa,
      s.scores.academic,
      s.scores.github,
      s.scores.coding,
      s.scores.internship,
      s.scores.certifications,
      s.scores.projects,
      s.scores.fullstack,
      s.scores.hackathons,
      s.scores.inhouse,
      s.scores.membership,
      s.scores.shl,
      s.scores.total,
      s.status,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `SRM_Placement_Matrix_Cohort_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students.filter((s) => {
      if (q && !`${s.fullName} ${s.registerNumber} ${s.email}`.toLowerCase().includes(q))
        return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
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
  }, [students, query, statusFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const verifiedCount = students.filter((s) => s.status === "VERIFIED").length;
    const pendingCount = students.filter((s) => s.status === "PENDING").length;
    return {
      total: students.length,
      verified: verifiedCount,
      pending: pendingCount,
      avgScore: students.length
        ? Math.round(
            (students.reduce((a, s) => a + s.scores.total, 0) / students.length) * 10
          ) / 10
        : 0,
    };
  }, [students]);

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

  async function removeStudent(s: StudentDto, e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(
      `Permanently delete ${s.fullName} (${s.registerNumber})?\n\n` +
        "This removes their profile, scraped data, all uploaded documents and score. " +
        "It cannot be undone."
    );
    if (!ok) return;
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      if (selectedId === s.id) setSelectedId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header: Page Title & Short Description */}
      <div className="flex flex-col justify-between gap-3 border-b border-[#e2ded5] pb-4 dark:border-[#262f3c] sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1c2024] dark:text-white">
            Coordinator Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Manage student placement scores and placement matrix records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-8 text-xs"
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={recalculate}
            disabled={recalcBusy}
            className="h-8 text-xs text-[#165b33] border-[#b8ddc4] hover:bg-[#eaf4ed] dark:border-[#265335] dark:text-[#78d69f] dark:hover:bg-[#133822]"
          >
            {recalcBusy ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Calculator className="mr-1 h-3 w-3" />
            )}
            <span>Recalculate Scores</span>
          </Button>

          <Button
            size="sm"
            onClick={exportToCsv}
            disabled={!students.length}
            className="h-8 bg-[#165b33] text-xs font-medium text-white hover:bg-[#124929]"
          >
            <Download className="mr-1 h-3 w-3" />
            <span>Export CSV Report</span>
          </Button>
        </div>
      </div>

      {recalcMsg && (
        <div className="flex items-center gap-2 rounded border border-[#b8ddc4] bg-[#eaf4ed] px-3.5 py-2 text-xs text-[#165b33] dark:border-[#215736] dark:bg-[#133822] dark:text-[#78d69f]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{recalcMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded border border-[#f8c4c4] bg-[#fdeded] px-3.5 py-2 text-xs text-[#a82424] dark:border-[#5e2626] dark:bg-[#3d1818] dark:text-[#f38d8d]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Important Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={activeSection === "STUDENTS" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setStatusFilter("ALL");
          }}
          className="text-xs"
        >
          View Students
        </Button>

        <Button
          size="sm"
          variant={activeSection === "SCORES" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("SCORES");
            setStatusFilter("PENDING");
          }}
          className="text-xs"
        >
          Review Scores {stats.pending > 0 && `(${stats.pending})`}
        </Button>

        <Button
          size="sm"
          variant={activeSection === "MATRIX" ? "default" : "outline"}
          onClick={() => setActiveSection("MATRIX")}
          className="text-xs"
        >
          Manage Matrix
        </Button>

        <Button
          size="sm"
          variant={activeSection === "REPORTS" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("REPORTS");
          }}
          className="text-xs"
        >
          View Reports
        </Button>
      </div>

      {/* 3. Overview Strip — Key Administrative Information */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div className="px-2">
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Registered Students
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#1c2024] dark:text-white">
            {stats.total}
          </div>
        </div>
        <div className="px-2 border-l border-[#e2ded5] dark:border-[#262f3c]">
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Pending Reviews
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#92540d] dark:text-[#f3b55c]">
            {stats.pending}
          </div>
        </div>
        <div className="px-2 border-l border-[#e2ded5] dark:border-[#262f3c]">
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Verified Students
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#165b33] dark:text-[#78d69f]">
            {stats.verified}
          </div>
        </div>
        <div className="px-2 border-l border-[#e2ded5] dark:border-[#262f3c]">
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Matrix Rules
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#1c2024] dark:text-white">
            13 Criteria (100 M)
          </div>
        </div>
      </div>

      {/* 4. Action Sections (4 simple rectangular panels) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Section: Students */}
        <div className="rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div className="text-xs font-bold text-[#1c2024] dark:text-white">Students</div>
          <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
            View registered students
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveSection("STUDENTS");
              setStatusFilter("ALL");
            }}
            className="mt-3 w-full justify-center text-xs h-7"
          >
            View Students
          </Button>
        </div>

        {/* Section: Placement Matrix */}
        <div className="rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div className="text-xs font-bold text-[#1c2024] dark:text-white">Placement Matrix</div>
          <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
            Manage matrix rules
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSection("MATRIX")}
            className="mt-3 w-full justify-center text-xs h-7"
          >
            Manage Matrix Rules
          </Button>
        </div>

        {/* Section: Scores */}
        <div className="rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div className="text-xs font-bold text-[#1c2024] dark:text-white">Scores</div>
          <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
            Review and update scores
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveSection("SCORES");
              setStatusFilter("PENDING");
            }}
            className="mt-3 w-full justify-center text-xs h-7"
          >
            Review Scores
          </Button>
        </div>

        {/* Section: Reports */}
        <div className="rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div className="text-xs font-bold text-[#1c2024] dark:text-white">Reports</div>
          <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
            View placement reports
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            disabled={!students.length}
            className="mt-3 w-full justify-center text-xs h-7"
          >
            View Reports (CSV)
          </Button>
        </div>
      </div>

      {/* 5. Section: Placement Matrix Rules (when MATRIX selected) */}
      {activeSection === "MATRIX" && (
        <div className="rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div className="flex items-center justify-between border-b border-[#e2ded5] p-4 dark:border-[#262f3c]">
            <div>
              <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">
                Official Placement Matrix Rules (100 Marks Total)
              </h2>
              <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                SRM School of Computing Batches 2022–2026 &amp; 2023–2027 Evaluation Standard
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection("STUDENTS")}
              className="text-xs h-7"
            >
              Back to Students
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="portal-table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Metric Name</th>
                  <th className="text-center w-24">Marks</th>
                  <th>Evaluation Standard &amp; Criteria Split-Up</th>
                </tr>
              </thead>
              <tbody>
                {SRM_OFFICIAL_METRICS.map((m, idx) => (
                  <tr key={m.id}>
                    <td className="text-stone-400 font-medium">{idx + 1}</td>
                    <td className="font-semibold text-stone-900 dark:text-white">{m.name}</td>
                    <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                      {m.allottedMarks} M
                    </td>
                    <td className="text-stone-600 dark:text-stone-300">{m.splitUp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Section: Reports (when REPORTS selected) */}
      {activeSection === "REPORTS" && (
        <div className="rounded-md border border-[#e2ded5] bg-white p-5 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div className="flex items-center justify-between border-b border-[#e2ded5] pb-3 dark:border-[#262f3c]">
            <div>
              <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">
                Placement Reports &amp; Exports
              </h2>
              <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                Generate cohort-wide spreadsheets for company shortlisting and coordinator audits.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection("STUDENTS")}
              className="text-xs h-7"
            >
              Back to Students
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded border border-[#e2ded5] p-4 dark:border-[#262f3c]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Full Cohort Matrix Score Sheet (CSV)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                    Contains all registered candidate details, CGPA, official 13-criteria score breakdown, and verified placement rank.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={exportToCsv}
                  disabled={!students.length}
                  className="bg-[#165b33] text-xs font-medium text-white hover:bg-[#124929]"
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Download CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. STUDENT TABLE (VISUAL FOCUS OF DASHBOARD) */}
      {activeSection !== "MATRIX" && (
        <div className="rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c]">
          {/* Table Header with Search & Filter controls */}
          <div className="flex flex-col gap-3 p-4 border-b border-[#e2ded5] dark:border-[#262f3c] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">
                {activeSection === "SCORES" ? "Pending Reviews" : "All Registered Students"}
              </h2>
              <span className="rounded bg-[#f0ece4] px-2 py-0.5 text-xs font-semibold text-[#474f5a] dark:bg-[#232b36] dark:text-[#cbd5e1]">
                {filtered.length}
              </span>
            </div>

            {/* Clean, straightforward Search & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#88909c]" />
                <Input
                  placeholder="Search student or register no..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-8 rounded-md border border-[#d8d3c7] bg-white px-2.5 text-xs text-[#1c2024] outline-none dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="VERIFIED">Verified Only</option>
              </select>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-8 rounded-md border border-[#d8d3c7] bg-white px-2.5 text-xs text-[#1c2024] outline-none dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
              >
                <option value="rank">Sort by Rank</option>
                <option value="totalScore">Sort by Matrix Score</option>
                <option value="cgpa">Sort by CGPA</option>
                <option value="name">Sort by Student Name</option>
                <option value="registerNumber">Sort by Reg. Number</option>
              </select>
            </div>
          </div>

          {/* Clean Administrative Student Table */}
          <div className="overflow-x-auto">
            <table className="portal-table">
              <thead>
                <tr>
                  <th className="w-16">Rank</th>
                  <th>Register No.</th>
                  <th>Student Name</th>
                  {canSeeAcademic && <th>CGPA</th>}
                  <th>Status</th>
                  <th className="text-right">Matrix Score</th>
                  <th className="text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#5c6470]">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#165b33]" />
                      Loading student records…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#5c6470]">
                      No students found matching your search.
                    </td>
                  </tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id}>
                    {/* Rank */}
                    <td className="font-semibold text-[#165b33] dark:text-[#78d69f]">
                      {s.rank ? `#${s.rank}` : "—"}
                    </td>

                    {/* Register Number */}
                    <td className="font-mono font-medium text-[#1c2024] dark:text-[#f0ede6]">
                      {s.registerNumber}
                    </td>

                    {/* Student Name */}
                    <td>
                      <div className="font-semibold text-[#1c2024] dark:text-white">
                        {s.fullName}
                      </div>
                      <div className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                        {s.email}
                      </div>
                    </td>

                    {/* CGPA (visible only to coordinators with the academic scope) */}
                    {canSeeAcademic && (
                      <td className="font-medium text-[#1c2024] dark:text-[#f0ede6]">
                        {s.cgpa.toFixed(2)}
                      </td>
                    )}

                    {/* Status */}
                    <td>
                      {s.status === "VERIFIED" ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </td>

                    {/* Matrix Score */}
                    <td className="text-right">
                      <span className="font-bold text-[#1c2024] dark:text-white">
                        {s.scores.total.toFixed(1)}
                      </span>
                      <span className="text-[11px] text-[#5c6470]"> / 100</span>
                    </td>

                    {/* Actions: Simple Text Buttons [ View ] and [ Edit Score ] */}
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => setSelectedId(s.id)}
                        >
                          View
                        </Button>

                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-[#165b33] text-white hover:bg-[#124929]"
                          onClick={() => setSelectedId(s.id)}
                        >
                          Edit Score
                        </Button>

                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-[#5c6470] hover:text-[#a82424]"
                            title="Delete profile permanently"
                            disabled={busyId === s.id}
                            onClick={(e) => removeStudent(s, e)}
                          >
                            {busyId === s.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          title="Refresh live GitHub and LeetCode data"
                          disabled={busyId === s.id}
                          onClick={(e) => rescrape(s, e)}
                          className="h-7 px-2 text-xs text-[#5c6470] hover:text-[#1c2024]"
                        >
                          {busyId === s.id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-[#165b33]" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Audit & Scoring Modal */}
      {selectedId && (
        <StudentDetailModal
          studentId={selectedId}
          canScore={canScore}
          isSuperAdmin={isSuperAdmin}
          permissionScopes={permissionScopes}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
