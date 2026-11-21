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
  AlertTriangle,
  Share2,
  FileSpreadsheet,
  Bell,
  Send,
  Mail,
  Cloud,
  Unlock,
  Lock,
  Zap,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { StudentDetailModal } from "@/components/dashboard/student-detail-modal";
import { MissingDocsModal } from "@/components/dashboard/missing-docs-modal";
import { OneDriveSyncModal } from "@/components/dashboard/onedrive-sync-modal";
import { GlobalUnlockModal } from "@/components/dashboard/global-unlock-modal";
import { scopesAreFull, type ScoreScope } from "@/lib/scopes";
import { SRM_OFFICIAL_METRICS, type StudentDto } from "@/lib/types";
import { auditStudentDocuments, docCategoryLabel, linkCategoryLabel } from "@/lib/categories";
import { getUnlockedSectionLabels } from "@/lib/student-unlock";

type SortKey = "rank" | "totalScore" | "missingDocs" | "cgpa" | "name" | "registerNumber" | "projectLinks";
type StatusFilter = "ALL" | "PENDING" | "VERIFIED";
type DocFilter = "ALL" | "COMPLETE" | "MISSING" | "NO_DOCS";
type ProjectFilter =
  | "ALL"
  | "HAS_ANY_PROJECT"
  | "HAS_PROJECTS"
  | "HAS_FULLSTACK"
  | "HAS_INHOUSE"
  | "PENDING_VERIFY"
  | "VERIFIED"
  | "NO_PROJECTS";
type ActiveSection = "STUDENTS" | "SCORES" | "MATRIX" | "REPORTS";

export function getStudentReviewers(s: StudentDto): { finalVerifier: string | null; sectionReviewers: string[] } {
  const finalVerifier =
    s.status === "VERIFIED"
      ? s.verifiedByName ||
        s.scoreAudit?.find((a) => a.action === "verified" || a.field === "finalVerification")?.byName ||
        s.scoreAudit?.find((a) => a.byName && a.action !== "auto")?.byName ||
        s.documents?.find((d) => d.reviewedByName)?.reviewedByName ||
        "Faculty Coordinator"
      : null;
  const reviewers = new Set<string>();
  for (const a of s.scoreAudit ?? []) {
    if (a.byName && a.action !== "auto" && a.byName !== finalVerifier) {
      reviewers.add(a.byName);
    }
  }
  for (const d of s.documents ?? []) {
    if (d.reviewedByName && d.reviewedByName !== finalVerifier) {
      reviewers.add(d.reviewedByName);
    }
  }
  for (const l of s.projectLinks ?? []) {
    if (l.reviewedByName && l.reviewedByName !== finalVerifier) {
      reviewers.add(l.reviewedByName);
    }
  }
  return { finalVerifier, sectionReviewers: Array.from(reviewers) };
}

export function Dashboard({
  canScore = true,
  /** Super admin — may view every section regardless of scopes. */
  isSuperAdmin = false,
  permissionScopes = [],
  initialStudents,
}: {
  canScore?: boolean;
  isSuperAdmin?: boolean;
  /** Rubric sections this coordinator may view & score; empty = all. */
  permissionScopes?: ScoreScope[];
  /** Optional pre-fetched students from server component for instant 0-second page load. */
  initialStudents?: StudentDto[];
}) {
  // The columns this viewer may see; the server already strips the data for
  // out-of-scope fields, so this is purely visual (no empty columns).
  const has = (s: ScoreScope) => isSuperAdmin || scopesAreFull(permissionScopes) || permissionScopes.includes(s);
  const canSeeAcademic = has("ACADEMIC");
  const canSeeGithub = has("GITHUB");
  const canSeeCoding = has("CODING");
  const colCount = 6 + (canSeeAcademic ? 3 : 0) + (canSeeGithub ? 1 : 0) + (canSeeCoding ? 1 : 0);
  const [students, setStudents] = useState<StudentDto[]>(initialStudents ?? []);
  const [loading, setLoading] = useState(initialStudents && initialStudents.length > 0 ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [docFilter, setDocFilter] = useState<DocFilter>("ALL");
  const [topicFilter, setTopicFilter] = useState<string>("ALL");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("ALL");
  const [showShareModal, setShowShareModal] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<"email" | "broadcast" | "share" | "roster">("email");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [oneDriveModalOpen, setOneDriveModalOpen] = useState(false);
  const [globalUnlockModalOpen, setGlobalUnlockModalOpen] = useState(false);
  const [isGlobalActive, setIsGlobalActive] = useState(false);
  const [globalUnlock, setGlobalUnlock] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("STUDENTS");
  const [activeUnlocks, setActiveUnlocks] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setStudents((curr) => {
      if (!curr.length) setLoading(true);
      return curr;
    });
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

      fetch("/api/students/unlock-batch")
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (b) {
            if (b.unlocks) setActiveUnlocks(b.unlocks);
            setIsGlobalActive(b.isGlobalActive ?? false);
            setGlobalUnlock(b.globalUnlock ?? null);
          }
        })
        .catch(() => undefined);
    } catch {
      setError("Network connection error. Could not reach server.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleQuickLockAll() {
    try {
      const res = await fetch("/api/students/unlock-batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allStudents: true }),
      });
      if (res.ok) {
        setIsGlobalActive(false);
        setGlobalUnlock(null);
        await load();
      }
    } catch {}
  }

  useEffect(() => {
    if (initialStudents && initialStudents.length > 0) {
      setStudents(initialStudents);
      setLoading(false);
    }
    // Also fetch fresh in background so updates immediately reflect
    load();
  }, [load, initialStudents]);

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

  // Helper to trigger direct browser download of blob
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Client-side fallback: RFC-4180 CSV with UTF-8 BOM (\uFEFF)
  // Ensures Microsoft Excel opens it seamlessly without any encoding or delimiter prompts.
  function downloadCsvFallback(list: StudentDto[], filename: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    function makeCsvDocLink(d: { id?: string; fileUrl?: string; fileName?: string }, token?: string | null): string {
      const path = d.fileUrl || (d.id ? `/api/documents/${d.id}/file` : "");
      if (!path) return "";
      const tokenQuery = token ? `token=${encodeURIComponent(token)}` : "";
      const fullPath = tokenQuery ? (path.includes("?") ? `${path}&${tokenQuery}` : `${path}?${tokenQuery}`) : path;
      return origin ? `${origin}${fullPath}` : fullPath;
    }

    function escapeCsv(val: any): string {
      if (val === null || val === undefined || val === "") return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }

    function getItemText(label: string | null | undefined, url: string, note?: string | null): string {
      const parts: string[] = [];
      if (label && label.trim()) parts.push(label.trim());
      if (note && note.trim()) parts.push(`(${note.trim()})`);
      const prefix = parts.length > 0 ? `${parts.join(" ")}: ` : "";
      return `${prefix}${url}`;
    }

    // Determine max counts dynamically
    let maxProjects = 3;
    let maxFullstack = 2;
    let maxInhouseLinks = 2;
    let maxInhouseDocs = 2;
    let maxInternships = 2;
    let maxCerts = 6;
    let maxHackathons = 4;
    let maxMemberships = 2;
    let maxShl = 1;

    for (const s of list) {
      const pLinks = (s.projectLinks || []).filter((l) => l.category === "PROJECT" || !l.category);
      maxProjects = Math.max(maxProjects, pLinks.length + (s.proofUrls?.length || 0));

      const fsLinks = (s.projectLinks || []).filter((l) => l.category === "FULLSTACK_PROJECT");
      maxFullstack = Math.max(maxFullstack, fsLinks.length);

      const ihLinks = (s.projectLinks || []).filter((l) => l.category === "INHOUSE_PROJECT_LINK");
      maxInhouseLinks = Math.max(maxInhouseLinks, ihLinks.length);

      const ihDocs = (s.documents || []).filter((d) => d.category === "INHOUSE_PROJECT");
      maxInhouseDocs = Math.max(maxInhouseDocs, ihDocs.length);

      const internDocs = (s.documents || []).filter((d) => d.category === "INTERNSHIP");
      maxInternships = Math.max(maxInternships, internDocs.length);

      const certDocs = (s.documents || []).filter((d) => d.category === "SKILL_CERT");
      maxCerts = Math.max(maxCerts, certDocs.length);

      const hackDocs = (s.documents || []).filter((d) => d.category === "COMPETITION");
      maxHackathons = Math.max(maxHackathons, hackDocs.length);

      const memDocs = (s.documents || []).filter((d) => d.category === "MEMBERSHIP");
      maxMemberships = Math.max(maxMemberships, memDocs.length);

      const shlDocs = (s.documents || []).filter((d) => d.category === "SHL");
      maxShl = Math.max(maxShl, shlDocs.length);
    }

    const headers = [
      "Registration Number",
      "Full Name (AS PER ATTENDANCE)",
      "Section",
      "Specialization",
      "Faculty Advisor",
      "10th Percentage (2.5)",
      "12th Percentage (2.5)",
      "CGPA (5)",
      "Github Profile (15)",
      "Coding Practice Platform (10)",
      "Internship Experience (10)",
      "Skillset & Global Certifications Completed (15)",
      "Projects Done (5)",
      "Full Stack Developer Experience (5)",
      "Coding Competition & Hackathons Won (10)",
      "Inhouse Projects Done (5)",
      "Membership of Professional Bodies (2)",
      "SHL Assessment / Talent Discovery Assessment / N.C.A.T (National Competence & Employability Test) (13)",
      "Total",
      "GitHub Profile Link",
      "Coding Profile Link (LeetCode)",
    ];

    for (let i = 1; i <= maxProjects; i++) headers.push(`Projects Done - Link ${i}`);
    for (let i = 1; i <= maxFullstack; i++) headers.push(`Full Stack Developer - Link ${i}`);
    for (let i = 1; i <= maxInhouseLinks; i++) headers.push(`Inhouse Projects - Link ${i}`);
    for (let i = 1; i <= maxInhouseDocs; i++) headers.push(`Inhouse Projects - Document ${i} Link`);
    for (let i = 1; i <= maxInternships; i++) headers.push(`Internship Experience - Document ${i} Link`);
    for (let i = 1; i <= maxCerts; i++) headers.push(`Skillset & Certifications - Document ${i} Link`);
    for (let i = 1; i <= maxHackathons; i++) headers.push(`Coding Competitions & Hackathons - Document ${i} Link`);
    for (let i = 1; i <= maxMemberships; i++) headers.push(`Professional Membership - Document ${i} Link`);
    for (let i = 1; i <= maxShl; i++) headers.push(`SHL Assessment - Document ${i} Link`);
    headers.push(
      "Academic - 10th Marksheet Link",
      "Academic - 12th Marksheet Link",
      "Academic - Degree CGPA Marksheet Link",
      "Academic - Semester 1 Marksheet Link",
      "Academic - Semester 2 Marksheet Link"
    );

    const rows = list.map((s) => {
      const tenthScore = s.tenthPercent
        ? s.tenthPercent >= 96 ? 2.5 : s.tenthPercent >= 91 ? 2.0 : s.tenthPercent >= 86 ? 1.5 : s.tenthPercent >= 75 ? 1.0 : 0.5
        : 0;

      const twelfthScore = s.twelfthPercent
        ? s.twelfthPercent >= 96 ? 2.5 : s.twelfthPercent >= 91 ? 2.0 : s.twelfthPercent >= 86 ? 1.5 : s.twelfthPercent >= 75 ? 1.0 : 0.5
        : 0;

      const rawCgpa = Number(s.cgpa ?? 0);
      const s1 = Number(s.sgpaSem1 ?? 0);
      const s2 = Number(s.sgpaSem2 ?? 0);
      const effectiveCgpa =
        rawCgpa > 0
          ? rawCgpa
          : s1 > 0 && s2 > 0
            ? Math.round(((s1 + s2) / 2) * 100) / 100
            : s1 > 0
              ? s1
              : s2 > 0
                ? s2
                : 0;

      let cgpaScore = 0;
      if (effectiveCgpa > 0) {
        if (effectiveCgpa > 9.5) cgpaScore = 5.0;
        else if (effectiveCgpa >= 9.1) cgpaScore = 4.0;
        else if (effectiveCgpa >= 8.6) cgpaScore = 3.0;
        else if (effectiveCgpa >= 7.5) cgpaScore = 2.0;
        else cgpaScore = 1.0;
      } else if (s.scores?.academic && Number(s.scores.academic) > 0) {
        cgpaScore = Math.max(0, Math.min(5, Math.round((Number(s.scores.academic) - tenthScore - twelfthScore) * 10) / 10));
      }

      const ghScore = Number(s.scores?.github ?? 0);
      const codingScore = Number(s.scores?.coding ?? 0);
      const internScore = Number(s.scores?.internship ?? 0);
      const certScore = Number(s.scores?.certifications ?? 0);
      const projScore = Number(s.scores?.projects ?? 0);
      const fsdScore = Number(s.scores?.fullstack ?? 0);
      const hackScore = Number(s.scores?.hackathons ?? 0);
      const inhouseScore = Math.min(5, Number(s.scores?.inhouse ?? 0));
      const memberScore = Number(s.scores?.membership ?? 0);
      const shlScore = Number(s.scores?.shl ?? 0);

      const totalVal = (s.scores?.total && s.scores.total > 0)
        ? s.scores.total
        : (tenthScore + twelfthScore + cgpaScore + ghScore + codingScore + internScore + certScore + projScore + fsdScore + hackScore + inhouseScore + memberScore + shlScore);

      const r: (string | number)[] = [
        escapeCsv(s.registerNumber),
        escapeCsv(s.fullName),
        escapeCsv("AO1"),
        escapeCsv("B.Tech - AIML"),
        escapeCsv(s.facultyAdvisor || "Dr. Kaliraj G"),
        tenthScore > 0 ? tenthScore : 0,
        twelfthScore > 0 ? twelfthScore : 0,
        cgpaScore > 0 ? cgpaScore : 0,
        ghScore > 0 ? ghScore : 0,
        codingScore > 0 ? codingScore : 0,
        internScore > 0 ? internScore : 0,
        certScore > 0 ? certScore : 0,
        projScore > 0 ? projScore : 0,
        fsdScore > 0 ? fsdScore : 0,
        hackScore > 0 ? hackScore : 0,
        inhouseScore > 0 ? inhouseScore : 0,
        memberScore > 0 ? memberScore : 0,
        shlScore > 0 ? shlScore : 0,
        totalVal,
        escapeCsv(s.githubUrl || ""),
        escapeCsv(s.leetcodeUrl || ""),
      ];

      // Projects
      const projectItems: string[] = [];
      for (const p of (s.projectLinks || []).filter((l) => l.category === "PROJECT" || !l.category)) {
        if (p.url) projectItems.push(p.url.trim());
      }
      for (const p of s.proofUrls || []) {
        if (p?.url) projectItems.push(p.url.trim());
      }
      for (let i = 0; i < maxProjects; i++) r.push(escapeCsv(projectItems[i] || ""));

      // Fullstack
      const fullstackItems: string[] = [];
      for (const p of (s.projectLinks || []).filter((l) => l.category === "FULLSTACK_PROJECT")) {
        if (p.url) fullstackItems.push(p.url.trim());
      }
      for (let i = 0; i < maxFullstack; i++) r.push(escapeCsv(fullstackItems[i] || ""));

      // Inhouse links
      const inhouseLinkItems: string[] = [];
      for (const p of (s.projectLinks || []).filter((l) => l.category === "INHOUSE_PROJECT_LINK")) {
        if (p.url) inhouseLinkItems.push(p.url.trim());
      }
      for (let i = 0; i < maxInhouseLinks; i++) r.push(escapeCsv(inhouseLinkItems[i] || ""));

      // Inhouse docs
      const inhouseDocItems = (s.documents || []).filter((d) => d.category === "INHOUSE_PROJECT");
      for (let i = 0; i < maxInhouseDocs; i++) {
        const doc = inhouseDocItems[i];
        r.push(escapeCsv(doc ? makeCsvDocLink(doc, s.uploadToken) : ""));
      }

      // Internships
      const internDocItems = (s.documents || []).filter((d) => d.category === "INTERNSHIP");
      for (let i = 0; i < maxInternships; i++) {
        const doc = internDocItems[i];
        r.push(escapeCsv(doc ? makeCsvDocLink(doc, s.uploadToken) : ""));
      }

      // Certifications
      const certDocItems = (s.documents || []).filter((d) => d.category === "SKILL_CERT");
      for (let i = 0; i < maxCerts; i++) {
        const doc = certDocItems[i];
        r.push(escapeCsv(doc ? makeCsvDocLink(doc, s.uploadToken) : ""));
      }

      // Hackathons
      const hackDocItems = (s.documents || []).filter((d) => d.category === "COMPETITION");
      for (let i = 0; i < maxHackathons; i++) {
        const doc = hackDocItems[i];
        r.push(escapeCsv(doc ? makeCsvDocLink(doc, s.uploadToken) : ""));
      }

      // Memberships
      const memDocItems = (s.documents || []).filter((d) => d.category === "MEMBERSHIP");
      for (let i = 0; i < maxMemberships; i++) {
        const doc = memDocItems[i];
        r.push(escapeCsv(doc ? makeCsvDocLink(doc, s.uploadToken) : ""));
      }

      // SHL
      const shlDocItems = (s.documents || []).filter((d) => d.category === "SHL");
      for (let i = 0; i < maxShl; i++) {
        const doc = shlDocItems[i];
        r.push(escapeCsv(doc ? makeCsvDocLink(doc, s.uploadToken) : ""));
      }

      // Marksheets
      const doc10th = (s.documents || []).find((d) => d.category === "TENTH_MARKSHEET");
      r.push(escapeCsv(doc10th ? makeCsvDocLink(doc10th, s.uploadToken) : ""));

      const doc12th = (s.documents || []).find((d) => d.category === "TWELFTH_MARKSHEET");
      r.push(escapeCsv(doc12th ? makeCsvDocLink(doc12th, s.uploadToken) : ""));

      const docCgpa = (s.documents || []).find((d) => d.category === "CGPA_MARKSHEET");
      r.push(escapeCsv(docCgpa ? makeCsvDocLink(docCgpa, s.uploadToken) : ""));

      const docSem1 = (s.documents || []).find((d) => d.category === "SEM1_MARKSHEET");
      r.push(escapeCsv(docSem1 ? makeCsvDocLink(docSem1, s.uploadToken) : ""));

      const docSem2 = (s.documents || []).find((d) => d.category === "SEM2_MARKSHEET");
      r.push(escapeCsv(docSem2 ? makeCsvDocLink(docSem2, s.uploadToken) : ""));

      return r;
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, filename);
  }

  // Universal Excel (.xlsx) downloader: sends candidates directly via POST for zero DB load,
  // with server GET fallback and client CSV fallback so downloading NEVER fails.
  async function downloadExcelReport(targetList?: StudentDto[], fileSuffix = "") {
    const list = targetList && targetList.length > 0 ? targetList : students;
    if (!list.length) return;
    setExportBusy(true);

    const dateStr = new Date().toISOString().slice(0, 10);
    const suffixPart = fileSuffix ? `_${fileSuffix}` : "";
    const xlsxFilename = `SRM_Placement_Matrix_AO1${suffixPart}_${dateStr}.xlsx`;
    const csvFilename = `SRM_Placement_Matrix_AO1${suffixPart}_${dateStr}.csv`;

    try {
      // 1. Try server POST with in-memory payload (fastest & bypasses DB connection pool)
      const postRes = await fetch("/api/students/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: list }),
      });

      if (postRes.ok) {
        const blob = await postRes.blob();
        triggerDownload(blob, xlsxFilename);
        return;
      }

      // 2. Try server GET if POST failed
      const getRes = await fetch("/api/students/export", { cache: "no-store" });
      if (getRes.ok) {
        const blob = await getRes.blob();
        triggerDownload(blob, xlsxFilename);
        return;
      }

      throw new Error(`Export service error (${postRes.status})`);
    } catch (err) {
      console.warn("Server Excel generation failed, triggering instant client CSV fallback:", err);
      // 3. Client-side fallback guarantees file is ALWAYS downloaded
      downloadCsvFallback(list, csvFilename);
    } finally {
      setExportBusy(false);
    }
  }

  // Export currently filtered students as official Excel sheet
  function exportFilteredToCsv() {
    const filterName =
      projectFilter !== "ALL"
        ? `Projects_${projectFilter}`
        : topicFilter !== "ALL"
        ? topicFilter
        : docFilter !== "ALL"
        ? docFilter
        : "Filtered";
    downloadExcelReport(filtered, filterName);
  }

  // Export all candidates as official Excel sheet
  function exportToCsv() {
    downloadExcelReport(students, "All");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students.filter((s) => {
      if (q && !`${s.fullName} ${s.registerNumber} ${s.email} ${s.facultyAdvisor || ""}`.toLowerCase().includes(q))
        return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false;
      }
      if (docFilter === "COMPLETE") {
        const audit = auditStudentDocuments(s.documents);
        if (!audit.isComplete) return false;
      } else if (docFilter === "MISSING" && topicFilter === "ALL") {
        const audit = auditStudentDocuments(s.documents);
        if (audit.isComplete) return false;
      } else if (docFilter === "NO_DOCS") {
        if (s.documents && s.documents.length > 0) return false;
      }

      // Topic-specific missing filter (e.g. 10th marksheet, internship, etc.)
      if (topicFilter !== "ALL") {
        const hasTopic = (s.documents ?? []).some(
          (d) => d.category === topicFilter && d.status !== "REJECTED"
        );
        if (hasTopic) return false;
      }

      // Project links submission filter
      if (projectFilter !== "ALL") {
        const pLinks = (s.projectLinks || []).filter(
          (l) => l.category === "PROJECT" || !l.category
        );
        const fsLinks = (s.projectLinks || []).filter(
          (l) => l.category === "FULLSTACK_PROJECT"
        );
        const ihLinks = (s.projectLinks || []).filter(
          (l) => l.category === "INHOUSE_PROJECT_LINK"
        );
        const hasLegacy = Boolean(s.proofUrls && s.proofUrls.length > 0);
        const allLinks = s.projectLinks || [];

        if (projectFilter === "HAS_ANY_PROJECT") {
          if (allLinks.length === 0 && !hasLegacy) return false;
        } else if (projectFilter === "HAS_PROJECTS") {
          if (pLinks.length === 0 && !hasLegacy) return false;
        } else if (projectFilter === "HAS_FULLSTACK") {
          if (fsLinks.length === 0) return false;
        } else if (projectFilter === "HAS_INHOUSE") {
          const hasInhouseDoc = (s.documents || []).some(
            (d) => d.category === "INHOUSE_PROJECT"
          );
          if (ihLinks.length === 0 && !hasInhouseDoc) return false;
        } else if (projectFilter === "PENDING_VERIFY") {
          const hasPending = allLinks.some((l) => l.status === "PENDING");
          if (!hasPending) return false;
        } else if (projectFilter === "VERIFIED") {
          const hasVerified = allLinks.some((l) => l.status === "VERIFIED");
          if (!hasVerified) return false;
        } else if (projectFilter === "NO_PROJECTS") {
          if (allLinks.length > 0 || hasLegacy) return false;
        }
      }

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
        case "projectLinks": {
          const la = (a.projectLinks?.length || 0) + (a.proofUrls?.length || 0);
          const lb = (b.projectLinks?.length || 0) + (b.proofUrls?.length || 0);
          if (la !== lb) return (lb - la) * dir;
          return a.registerNumber.localeCompare(b.registerNumber);
        }
        case "missingDocs": {
          // Prioritize students with highest missing documents first
          const ma = auditStudentDocuments(a.documents).missingCount;
          const mb = auditStudentDocuments(b.documents).missingCount;
          if (ma !== mb) return (mb - ma) * dir;
          return a.registerNumber.localeCompare(b.registerNumber);
        }
        default:
          return (a.scores.total - b.scores.total) * dir;
      }
    });
    return list;
  }, [students, query, statusFilter, docFilter, topicFilter, projectFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const verifiedCount = students.filter((s) => s.status === "VERIFIED").length;
    const pendingCount = students.filter((s) => s.status === "PENDING").length;
    const missingDocsCount = students.filter(
      (s) => auditStudentDocuments(s.documents).missingCount > 0
    ).length;
    const docsCompleteCount = students.filter(
      (s) => auditStudentDocuments(s.documents).isComplete
    ).length;
    const noDocsCount = students.filter(
      (s) => !s.documents || s.documents.length === 0
    ).length;

    // Project links statistics
    const hasAnyProjectsCount = students.filter(
      (s) =>
        (s.projectLinks && s.projectLinks.length > 0) ||
        (s.proofUrls && s.proofUrls.length > 0)
    ).length;
    const hasProjectsCount = students.filter(
      (s) =>
        (s.projectLinks ?? []).some((l) => l.category === "PROJECT" || !l.category) ||
        (s.proofUrls && s.proofUrls.length > 0)
    ).length;
    const hasFullstackCount = students.filter(
      (s) => (s.projectLinks ?? []).some((l) => l.category === "FULLSTACK_PROJECT")
    ).length;
    const hasInhouseCount = students.filter(
      (s) =>
        (s.projectLinks ?? []).some((l) => l.category === "INHOUSE_PROJECT_LINK") ||
        (s.documents ?? []).some((d) => d.category === "INHOUSE_PROJECT")
    ).length;
    const pendingLinkVerificationCount = students.filter(
      (s) => (s.projectLinks ?? []).some((l) => l.status === "PENDING")
    ).length;
    const verifiedProjectsCount = students.filter(
      (s) => (s.projectLinks ?? []).some((l) => l.status === "VERIFIED")
    ).length;
    const noProjectsCount = students.filter(
      (s) =>
        (!s.projectLinks || s.projectLinks.length === 0) &&
        (!s.proofUrls || s.proofUrls.length === 0)
    ).length;

    return {
      total: students.length,
      verified: verifiedCount,
      pending: pendingCount,
      missingDocs: missingDocsCount,
      docsComplete: docsCompleteCount,
      noDocs: noDocsCount,
      hasAnyProjects: hasAnyProjectsCount,
      hasProjects: hasProjectsCount,
      hasFullstack: hasFullstackCount,
      hasInhouse: hasInhouseCount,
      pendingLinkVerification: pendingLinkVerificationCount,
      verifiedProjects: verifiedProjectsCount,
      noProjects: noProjectsCount,
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
            onClick={() => setGlobalUnlockModalOpen(true)}
            className={`h-8 text-xs font-semibold shadow-xs ${
              isGlobalActive
                ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/40"
                : "border border-amber-500/50 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
            }`}
            title="Grant or revoke profile and document edit permissions for ALL students at once"
          >
            {isGlobalActive ? (
              <>
                <Unlock className="mr-1.5 h-3.5 w-3.5" />
                <span>⚡ All Students Unlocked</span>
              </>
            ) : (
              <>
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                <span>⚡ Unlock All Students</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => setOneDriveModalOpen(true)}
            className="h-8 bg-[#0078d4] text-xs font-medium text-white hover:bg-[#0066b8]"
          >
            <Cloud className="mr-1 h-3 w-3" />
            <span>OneDrive Live Sync</span>
          </Button>

          <Button
            size="sm"
            onClick={exportToCsv}
            disabled={!students.length || exportBusy}
            className="h-8 bg-[#165b33] text-xs font-medium text-white hover:bg-[#124929]"
          >
            {exportBusy ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Download className="mr-1 h-3 w-3" />
            )}
            <span>Export Excel Report</span>
          </Button>
        </div>
      </div>

      {/* Global Unlock Alert Banner */}
      {isGlobalActive && globalUnlock && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-950 dark:text-emerald-100 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-emerald-500/20 p-1.5 text-emerald-700 dark:text-emerald-300">
              <Unlock className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold">⚡ GLOBAL EDIT ACCESS ACTIVE: </span>
              <span>All students have permission to edit: <strong>{getUnlockedSectionLabels(globalUnlock.sections)}</strong>.</span>
              {globalUnlock.unlockedBy && <span className="opacity-75"> · Authorized by {globalUnlock.unlockedBy}</span>}
              {globalUnlock.reason && <span className="italic opacity-85"> · &quot;{globalUnlock.reason}&quot;</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGlobalUnlockModalOpen(true)}
              className="h-7 text-xs border-emerald-600/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/15"
            >
              Configure
            </Button>
            <Button
              size="sm"
              onClick={handleQuickLockAll}
              className="h-7 bg-rose-600 hover:bg-rose-700 text-xs text-white font-semibold"
            >
              <Lock className="mr-1 h-3 w-3" />
              Lock All Students
            </Button>
          </div>
        </div>
      )}

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
          variant={
            activeSection === "STUDENTS" &&
            statusFilter === "ALL" &&
            docFilter === "ALL" &&
            projectFilter === "ALL"
              ? "default"
              : "outline"
          }
          onClick={() => {
            setActiveSection("STUDENTS");
            setStatusFilter("ALL");
            setDocFilter("ALL");
            setTopicFilter("ALL");
            setProjectFilter("ALL");
          }}
          className="text-xs"
        >
          All Students
        </Button>

        <Button
          size="sm"
          variant={activeSection === "SCORES" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("SCORES");
            setStatusFilter("PENDING");
            setDocFilter("ALL");
          }}
          className="text-xs"
        >
          Review Scores {stats.pending > 0 && `(${stats.pending})`}
        </Button>

        <Button
          size="sm"
          variant={docFilter === "COMPLETE" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setDocFilter("COMPLETE");
            setStatusFilter("ALL");
          }}
          className={`text-xs ${
            docFilter === "COMPLETE"
              ? "bg-[#165b33] text-white hover:bg-[#124929]"
              : "text-[#165b33] border-[#b8ddc4] hover:bg-[#eaf4ed] dark:text-[#78d69f] dark:border-[#265335] dark:hover:bg-[#133822]"
          }`}
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          <span>Docs Complete {stats.docsComplete > 0 && `(${stats.docsComplete})`}</span>
        </Button>

        <Button
          size="sm"
          variant={docFilter === "MISSING" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setDocFilter("MISSING");
            setStatusFilter("ALL");
          }}
          className={`text-xs ${
            docFilter === "MISSING"
              ? "bg-[#b45309] text-white hover:bg-[#92400e]"
              : "text-[#b45309] border-[#fcd34d] hover:bg-[#fef3c7] dark:text-[#fcd34d] dark:border-[#78350f] dark:hover:bg-[#451a03]"
          }`}
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          <span>Missing Docs {stats.missingDocs > 0 && `(${stats.missingDocs})`}</span>
        </Button>

        <Button
          size="sm"
          variant={docFilter === "NO_DOCS" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setDocFilter("NO_DOCS");
            setStatusFilter("ALL");
          }}
          className={`text-xs ${
            docFilter === "NO_DOCS"
              ? "bg-[#991b1b] text-white hover:bg-[#7f1d1d]"
              : "text-[#991b1b] border-[#fca5a5] hover:bg-[#fee2e2] dark:text-[#fca5a5] dark:border-[#7f1d1d] dark:hover:bg-[#450a0a]"
          }`}
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          <span>No Docs {stats.noDocs > 0 && `(${stats.noDocs})`}</span>
        </Button>

        {/* Project Links & Full Stack Quick Filters */}
        <Button
          size="sm"
          variant={projectFilter === "HAS_PROJECTS" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setProjectFilter(projectFilter === "HAS_PROJECTS" ? "ALL" : "HAS_PROJECTS");
          }}
          className={`text-xs ${
            projectFilter === "HAS_PROJECTS"
              ? "bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              : "text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-950/30"
          }`}
          title="Filter candidates who submitted General Project Links"
        >
          <span>📁 General Projects {stats.hasProjects > 0 && `(${stats.hasProjects})`}</span>
        </Button>

        <Button
          size="sm"
          variant={projectFilter === "HAS_FULLSTACK" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setProjectFilter(projectFilter === "HAS_FULLSTACK" ? "ALL" : "HAS_FULLSTACK");
          }}
          className={`text-xs ${
            projectFilter === "HAS_FULLSTACK"
              ? "bg-purple-600 text-white hover:bg-purple-700 font-semibold"
              : "text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-700 dark:hover:bg-purple-950/30"
          }`}
          title="Filter candidates who submitted Full Stack Developer Project Links"
        >
          <span>⚡ Full Stack Projects {stats.hasFullstack > 0 && `(${stats.hasFullstack})`}</span>
        </Button>

        <Button
          size="sm"
          variant={projectFilter === "PENDING_VERIFY" ? "default" : "outline"}
          onClick={() => {
            setActiveSection("STUDENTS");
            setProjectFilter(projectFilter === "PENDING_VERIFY" ? "ALL" : "PENDING_VERIFY");
          }}
          className={`text-xs ${
            projectFilter === "PENDING_VERIFY"
              ? "bg-amber-600 text-white hover:bg-amber-700 font-semibold animate-pulse"
              : "text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-950/30"
          }`}
          title="Filter candidates with project links waiting for coordinator review & verification"
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          <span>Verify Project Links {stats.pendingLinkVerification > 0 && `(${stats.pendingLinkVerification})`}</span>
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

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModalInitialTab("email");
            setShowShareModal(true);
          }}
          className="text-xs text-[#165b33] border-[#165b33]/40 hover:bg-[#eaf4ed] dark:text-[#78d69f] dark:border-[#165b33] dark:hover:bg-[#165b33]/20"
          title="Send personalized emails to students with missing documents"
        >
          <Mail className="mr-1 h-3.5 w-3.5" />
          <span>Send Emails</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModalInitialTab("broadcast");
            setShowShareModal(true);
          }}
          className="text-xs text-[#b45309] border-[#f59e0b] hover:bg-[#fffbeb] dark:text-[#fcd34d] dark:border-[#b45309] dark:hover:bg-[#451a03]"
          title="Send in-app reminder messages to students with missing documents"
        >
          <Bell className="mr-1 h-3.5 w-3.5" />
          <span>In-App Alerts</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModalInitialTab("share");
            setShowShareModal(true);
          }}
          className="text-xs text-[#0284c7] border-[#38bdf8] hover:bg-[#f0f9ff] dark:text-[#38bdf8] dark:border-[#0284c7] dark:hover:bg-[#082f49]"
          title="Open shareable defaulters notice grouped by topic"
        >
          <Share2 className="mr-1 h-3.5 w-3.5" />
          <span>Share Defaulters</span>
        </Button>
      </div>

      {/* 3. Overview Strip — Key Administrative Information */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div
          onClick={() => {
            setActiveSection("STUDENTS");
            setStatusFilter("ALL");
            setDocFilter("ALL");
          }}
          className={`px-2 cursor-pointer rounded p-1 transition-colors hover:bg-[#f6f5f2] dark:hover:bg-[#222a36] ${
            statusFilter === "ALL" && docFilter === "ALL" && activeSection === "STUDENTS" ? "ring-1 ring-[#165b33]" : ""
          }`}
          title="Click to view all registered students"
        >
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Registered Students
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#1c2024] dark:text-white">
            {stats.total}
          </div>
        </div>
        <div
          onClick={() => {
            setActiveSection("STUDENTS");
            setStatusFilter("PENDING");
            setDocFilter("ALL");
          }}
          className={`px-2 border-l border-[#e2ded5] dark:border-[#262f3c] cursor-pointer rounded p-1 transition-colors hover:bg-[#f6f5f2] dark:hover:bg-[#222a36] ${
            statusFilter === "PENDING" && activeSection === "STUDENTS" ? "ring-1 ring-[#92540d]" : ""
          }`}
          title="Click to filter pending reviews"
        >
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Pending Reviews
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#92540d] dark:text-[#f3b55c]">
            {stats.pending}
          </div>
        </div>
        <div
          onClick={() => {
            setActiveSection("STUDENTS");
            setDocFilter("COMPLETE");
            setStatusFilter("ALL");
          }}
          className={`px-2 border-l border-[#e2ded5] dark:border-[#262f3c] cursor-pointer rounded p-1 transition-colors hover:bg-[#f6f5f2] dark:hover:bg-[#222a36] ${
            docFilter === "COMPLETE" && activeSection === "STUDENTS" ? "ring-1 ring-[#165b33]" : ""
          }`}
          title="Click to filter students with all required marksheets submitted"
        >
          <span className="text-[11px] font-medium text-[#165b33] dark:text-[#78d69f]">
            Docs Complete
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#165b33] dark:text-[#78d69f]">
            {stats.docsComplete}
          </div>
        </div>
        <div
          onClick={() => {
            setActiveSection("STUDENTS");
            setDocFilter("MISSING");
            setStatusFilter("ALL");
          }}
          className={`px-2 border-l border-[#e2ded5] dark:border-[#262f3c] cursor-pointer rounded p-1 transition-colors hover:bg-[#f6f5f2] dark:hover:bg-[#222a36] ${
            docFilter === "MISSING" && activeSection === "STUDENTS" ? "ring-1 ring-[#b45309]" : ""
          }`}
          title="Click to filter students with missing required marksheets"
        >
          <span className="text-[11px] font-medium text-[#b45309] dark:text-[#fcd34d]">
            Missing Docs
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#b45309] dark:text-[#fcd34d]">
            {stats.missingDocs}
          </div>
        </div>
        <div
          onClick={() => {
            setActiveSection("STUDENTS");
            setStatusFilter("VERIFIED");
            setDocFilter("ALL");
          }}
          className={`px-2 border-l border-[#e2ded5] dark:border-[#262f3c] cursor-pointer rounded p-1 transition-colors hover:bg-[#f6f5f2] dark:hover:bg-[#222a36] ${
            statusFilter === "VERIFIED" && activeSection === "STUDENTS" ? "ring-1 ring-[#165b33]" : ""
          }`}
          title="Click to filter verified students"
        >
          <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
            Verified Students
          </span>
          <div className="mt-0.5 text-lg font-bold text-[#165b33] dark:text-[#78d69f]">
            {stats.verified}
          </div>
        </div>
        <div
          onClick={() => setActiveSection("MATRIX")}
          className="px-2 border-l border-[#e2ded5] dark:border-[#262f3c] cursor-pointer rounded p-1 transition-colors hover:bg-[#f6f5f2] dark:hover:bg-[#222a36]"
          title="Click to view matrix rules"
        >
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
            disabled={!students.length || exportBusy}
            className="mt-3 w-full justify-center text-xs h-7"
          >
            View Reports (Excel)
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
            <div className="rounded border border-[#b3d7f4] bg-[#f0f7fd] p-4 dark:border-[#1d4f79] dark:bg-[#0e273f]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-[#005a9e] dark:text-[#58a6ff]">
                      OneDrive &amp; Excel Online Real-Time Sync
                    </h3>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] dark:bg-emerald-950/60 dark:text-emerald-300 border-none">
                      Active Live Feed
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[#42526e] dark:text-[#a0c7e8]">
                    Linked to your OneDrive spreadsheet. Automatically fetches real-time candidate scores without downloading new files.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setOneDriveModalOpen(true)}
                  className="bg-[#0078d4] text-xs font-medium text-white hover:bg-[#0066b8]"
                >
                  <Cloud className="mr-1 h-3.5 w-3.5" />
                  Sync Instructions &amp; Feed
                </Button>
              </div>
            </div>
            <div className="rounded border border-[#e2ded5] p-4 dark:border-[#262f3c]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Full Cohort Matrix Score Sheet (Excel)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                    Contains all registered candidate details, CGPA, official 13-criteria score breakdown, and verified placement rank.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={exportToCsv}
                  disabled={!students.length || exportBusy}
                  className="bg-[#165b33] text-xs font-medium text-white hover:bg-[#124929]"
                >
                  {exportBusy ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5" />
                  )}
                  Download Excel
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
                {projectFilter === "HAS_PROJECTS"
                  ? "Students with General Project Links"
                  : projectFilter === "HAS_FULLSTACK"
                  ? "Students with Full-Stack Project Links"
                  : projectFilter === "HAS_INHOUSE"
                  ? "Students with In-House Projects"
                  : projectFilter === "PENDING_VERIFY"
                  ? "Students Awaiting Project Link Verification"
                  : projectFilter === "VERIFIED"
                  ? "Students with Verified Project Links"
                  : projectFilter === "NO_PROJECTS"
                  ? "Students with No Project Links"
                  : topicFilter !== "ALL"
                  ? `Students Missing: ${docCategoryLabel(topicFilter)}`
                  : docFilter === "MISSING"
                  ? "Students with Missing Documents"
                  : docFilter === "COMPLETE"
                  ? "Students with All Documents Submitted"
                  : docFilter === "NO_DOCS"
                  ? "Students with No Documents Uploaded"
                  : statusFilter === "PENDING"
                  ? "Pending Reviews"
                  : statusFilter === "VERIFIED"
                  ? "Verified Students"
                  : "All Registered Students"}
              </h2>
              <span className="rounded bg-[#f0ece4] px-2 py-0.5 text-xs font-semibold text-[#474f5a] dark:bg-[#232b36] dark:text-[#cbd5e1]">
                {filtered.length}
              </span>
            </div>

            {/* Clean, straightforward Search & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#88909c]" />
                <Input
                  placeholder="Search student or register no..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {/* Project Links & Full Stack Submission Filter */}
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value as ProjectFilter)}
                className={`h-8 rounded-md border px-2 text-xs font-medium outline-none transition-colors ${
                  projectFilter !== "ALL"
                    ? "border-purple-500 bg-purple-50 text-purple-900 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-200"
                    : "border-[#d8d3c7] bg-white text-[#1c2024] dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
                }`}
                title="Filter by submitted project links and full-stack projects"
              >
                <option value="ALL">All Project Submissions</option>
                <option value="HAS_ANY_PROJECT">🚀 Any Project Submitted ({stats.hasAnyProjects})</option>
                <option value="HAS_PROJECTS">📁 General Projects ({stats.hasProjects})</option>
                <option value="HAS_FULLSTACK">⚡ Full Stack Projects ({stats.hasFullstack})</option>
                <option value="HAS_INHOUSE">🏛️ In-house Projects ({stats.hasInhouse})</option>
                <option value="PENDING_VERIFY">⏳ Needs Link Verification ({stats.pendingLinkVerification})</option>
                <option value="VERIFIED">✓ Verified Projects ({stats.verifiedProjects})</option>
                <option value="NO_PROJECTS">❌ No Project Links (0 files)</option>
              </select>

              {/* Document Submission Status Filter */}
              <select
                value={docFilter}
                onChange={(e) => {
                  const val = e.target.value as DocFilter;
                  setDocFilter(val);
                  if (val === "ALL" || val === "COMPLETE" || val === "NO_DOCS") {
                    setTopicFilter("ALL");
                  }
                }}
                className="h-8 rounded-md border border-[#d8d3c7] bg-white px-2 text-xs font-medium text-[#1c2024] outline-none dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
                title="Filter by document submission status"
              >
                <option value="ALL">All Document States</option>
                <option value="COMPLETE">✓ Docs Complete (All Submitted)</option>
                <option value="MISSING">⚠️ Missing Required Marksheets</option>
                <option value="NO_DOCS">❌ No Documents Uploaded (0 files)</option>
              </select>

              {/* Specific Missing Document Topic / Category Filter */}
              <select
                value={topicFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setTopicFilter(val);
                  if (val !== "ALL") {
                    setDocFilter("MISSING");
                  }
                }}
                className={`h-8 rounded-md border px-2 text-xs font-medium outline-none transition-colors ${
                  topicFilter !== "ALL"
                    ? "border-[#b45309] bg-[#fef3c7] text-[#92400e] dark:border-[#78350f] dark:bg-[#381e05] dark:text-[#fcd34d]"
                    : "border-[#d8d3c7] bg-white text-[#1c2024] dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
                }`}
                title="Filter by specific missing document topic"
              >
                <option value="ALL">All Missing Topics</option>
                <optgroup label="Mandatory Marksheets">
                  <option value="TENTH_MARKSHEET">Missing: 10th Marksheet</option>
                  <option value="TWELFTH_MARKSHEET">Missing: 12th Marksheet</option>
                  <option value="CGPA_MARKSHEET">Missing: CGPA Marksheet</option>
                </optgroup>
                <optgroup label="Semester Grade Reports">
                  <option value="SEM1_MARKSHEET">Missing: Semester 1 SGPA</option>
                  <option value="SEM2_MARKSHEET">Missing: Semester 2 SGPA</option>
                </optgroup>
                <optgroup label="Experience & Credentials">
                  <option value="INTERNSHIP">Missing: Internship Proof</option>
                  <option value="SKILL_CERT">Missing: Global Certifications</option>
                  <option value="COMPETITION">Missing: Hackathons Won</option>
                  <option value="INHOUSE_PROJECT">Missing: In-House UROP/SERI</option>
                  <option value="MEMBERSHIP">Missing: Professional Membership</option>
                  <option value="SHL">Missing: SHL Assessment</option>
                </optgroup>
              </select>

              {/* Evaluation Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-8 rounded-md border border-[#d8d3c7] bg-white px-2 text-xs text-[#1c2024] outline-none dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
                title="Filter by coordinator verification status"
              >
                <option value="ALL">All Evaluation States</option>
                <option value="PENDING">Pending Evaluation</option>
                <option value="VERIFIED">Verified Candidates</option>
              </select>

              {/* Sort Key */}
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-8 rounded-md border border-[#d8d3c7] bg-white px-2 text-xs text-[#1c2024] outline-none dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
              >
                <option value="rank">Sort by Rank</option>
                <option value="totalScore">Sort by Matrix Score</option>
                <option value="projectLinks">Sort by Project Links</option>
                <option value="missingDocs">Sort by Missing Documents</option>
                <option value="cgpa">Sort by CGPA</option>
                <option value="name">Sort by Student Name</option>
                <option value="registerNumber">Sort by Reg. Number</option>
              </select>

              {/* Export Filtered Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportFilteredToCsv}
                disabled={!filtered.length || exportBusy}
                className="h-8 text-xs border-[#b8ddc4] text-[#165b33] hover:bg-[#eaf4ed] dark:border-[#265335] dark:text-[#78d69f]"
                title="Download currently filtered students as official Excel (.xlsx)"
              >
                {exportBusy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Download className="mr-1 h-3 w-3" />
                )}
                <span>Export Excel ({filtered.length})</span>
              </Button>

              {/* Share Defaulters Notice Button */}
              <Button
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="h-8 text-xs bg-[#0284c7] hover:bg-[#0369a1] text-white"
                title="Share formatted defaulters notice"
              >
                <Share2 className="mr-1 h-3 w-3" />
                <span>Share Notice</span>
              </Button>
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
                  <th>Documents</th>
                  <th className="text-right">Matrix Score</th>
                  <th className="text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#5c6470]">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#165b33]" />
                      Loading student records…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#5c6470]">
                      {projectFilter === "HAS_PROJECTS"
                        ? "No students found who submitted general project links."
                        : projectFilter === "HAS_FULLSTACK"
                        ? "No students found who submitted full stack project links."
                        : projectFilter === "HAS_INHOUSE"
                        ? "No students found with in-house project links or documents."
                        : projectFilter === "PENDING_VERIFY"
                        ? "All submitted project links have already been verified! No pending link reviews."
                        : docFilter === "MISSING"
                        ? "No students found with missing documents. All candidates have uploaded required verification documents."
                        : docFilter === "COMPLETE"
                        ? "No students found who have completed all required document uploads yet."
                        : docFilter === "NO_DOCS"
                        ? "No students without uploaded documents found."
                        : "No students found matching your search."}
                    </td>
                  </tr>
                )}
                {filtered.map((s) => {
                  const docAudit = auditStudentDocuments(s.documents);
                  return (
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
                        <div className="text-[11px] text-[#5c6470] dark:text-[#94a3b8] flex items-center gap-1.5 flex-wrap">
                          <span>{s.email}</span>
                          {docAudit.missingCount > 0 && (
                            <span className="font-medium text-[#b45309] dark:text-[#fcd34d] inline-flex items-center gap-0.5">
                              · <AlertTriangle className="h-3 w-3 inline text-[#d97706]" /> {docAudit.summaryText}
                            </span>
                          )}
                        </div>

                        {/* Submitted Project Links Badges */}
                        {(() => {
                          const pLinks = (s.projectLinks || []).filter(
                            (l) => l.category === "PROJECT" || !l.category
                          );
                          const fsLinks = (s.projectLinks || []).filter(
                            (l) => l.category === "FULLSTACK_PROJECT"
                          );
                          const ihLinks = (s.projectLinks || []).filter(
                            (l) => l.category === "INHOUSE_PROJECT_LINK"
                          );
                          const hasLegacy = Boolean(s.proofUrls && s.proofUrls.length > 0);
                          const projCount = pLinks.length + (hasLegacy ? s.proofUrls.length : 0);
                          const allLinks = s.projectLinks || [];
                          const pendingLinks = allLinks.filter((l) => l.status === "PENDING");
                          const totalLinks = allLinks.length + (hasLegacy ? s.proofUrls.length : 0);

                          if (totalLinks === 0) return null;

                          return (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {projCount > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
                                  title={`${projCount} General Project link(s) submitted. Score awarded: ${s.scores.projects}/5`}
                                >
                                  📁 {projCount} Proj ({s.scores.projects}/5)
                                </span>
                              )}
                              {fsLinks.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300"
                                  title={`${fsLinks.length} Full-Stack Project link(s) submitted. Score awarded: ${s.scores.fullstack}/5`}
                                >
                                  ⚡ {fsLinks.length} Full-Stack ({s.scores.fullstack}/5)
                                </span>
                              )}
                              {ihLinks.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                                  title={`${ihLinks.length} In-House Project link(s) submitted. Score awarded: ${s.scores.inhouse}/5`}
                                >
                                  🏛️ {ihLinks.length} In-House ({s.scores.inhouse}/5)
                                </span>
                              )}
                              {pendingLinks.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300 animate-pulse"
                                  title={`${pendingLinks.length} project link(s) pending coordinator verification`}
                                >
                                  ⏳ {pendingLinks.length} Needs Review
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* CGPA (visible only to coordinators with the academic scope) */}
                      {canSeeAcademic && (
                        <td className="font-medium text-[#1c2024] dark:text-[#f0ede6]">
                          {s.cgpa.toFixed(2)}
                        </td>
                      )}

                      {/* Status — with WHO signed it off & which coordinators reviewed */}
                      <td>
                        {(() => {
                          const { finalVerifier, sectionReviewers } = getStudentReviewers(s);
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge
                                  variant={
                                    s.status === "VERIFIED"
                                      ? "success"
                                      : sectionReviewers.length > 0
                                        ? "warning"
                                        : "outline"
                                  }
                                >
                                  {s.status === "VERIFIED"
                                    ? "Verified"
                                    : sectionReviewers.length > 0
                                      ? "In Review"
                                      : "Pending"}
                                </Badge>
                                {(isGlobalActive || activeUnlocks[s.id]) && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300"
                                    title={
                                      isGlobalActive
                                        ? "All Students Globally Unlocked by Super Admin"
                                        : "Edit Access Granted by Super Admin"
                                    }
                                  >
                                    <Unlock className="h-2.5 w-2.5" /> {isGlobalActive ? "All Unlocked" : "Unlocked"}
                                  </span>
                                )}
                              </div>
                              {s.status === "VERIFIED" ? (
                                <>
                                  {finalVerifier && (
                                    <div
                                      className="text-[11px] font-medium leading-tight text-[#165b33] dark:text-[#78d69f]"
                                      title={s.verifiedAt ? `Signed off ${new Date(s.verifiedAt).toLocaleString()}` : "Verifier of record"}
                                    >
                                      ✓ by {finalVerifier}
                                    </div>
                                  )}
                                  {sectionReviewers.length > 0 && (
                                    <div
                                      className="text-[10px] leading-tight text-[#5c6470] dark:text-[#94a3b8]"
                                      title={`Section reviewers: ${sectionReviewers.join(", ")}`}
                                    >
                                      Reviewers: {sectionReviewers.slice(0, 2).join(", ")}
                                      {sectionReviewers.length > 2 ? ` +${sectionReviewers.length - 2}` : ""}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {sectionReviewers.length > 0 ? (
                                    <div
                                      className="text-[11px] leading-tight text-[#5c6470] dark:text-[#94a3b8]"
                                      title={`Coordinators who reviewed sections: ${sectionReviewers.join(", ")}`}
                                    >
                                      Reviewed: <span className="font-medium text-[#1c2024] dark:text-white">{sectionReviewers.slice(0, 2).join(", ")}{sectionReviewers.length > 2 ? ` +${sectionReviewers.length - 2}` : ""}</span>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-[#5c6470] dark:text-[#94a3b8]">
                                      Awaiting review
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Document Verification Status */}
                      <td>
                        {docAudit.isComplete ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-[#eaf4ed] px-2 py-0.5 text-xs font-semibold text-[#165b33] dark:bg-[#133822] dark:text-[#78d69f]"
                            title="All required marksheets uploaded"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Complete ({docAudit.uploadedCount}/{docAudit.requiredTotal})</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-[#fef3c7] px-2 py-0.5 text-xs font-semibold text-[#92400e] dark:bg-[#3d2f13] dark:text-[#fbbf24]"
                            title={`Missing required documents: ${docAudit.missingDocLabels.join(", ")}`}
                          >
                            <AlertTriangle className="h-3 w-3 text-[#d97706]" />
                            <span>{docAudit.summaryText}</span>
                          </span>
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
                            className={`h-7 px-2.5 text-xs font-semibold ${
                              (s.projectLinks || []).some((l) => l.status === "PENDING")
                                ? "bg-amber-600 text-white hover:bg-amber-700 shadow-xs"
                                : "bg-[#165b33] text-white hover:bg-[#124929]"
                            }`}
                            onClick={() => setSelectedId(s.id)}
                            title={
                              (s.projectLinks || []).some((l) => l.status === "PENDING")
                                ? "Review pending project links and award marks"
                                : "View details and enter score breakdown"
                            }
                          >
                            {(s.projectLinks || []).some((l) => l.status === "PENDING")
                              ? "Verify & Score"
                              : "Edit Score"}
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
                  );
                })}
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

      {/* OneDrive & Excel Live Sync Modal */}
      {oneDriveModalOpen && (
        <OneDriveSyncModal
          isOpen={oneDriveModalOpen}
          totalStudents={students.length}
          onClose={() => setOneDriveModalOpen(false)}
        />
      )}

      {/* Share / Missing Documents Defaulters Notice Modal */}
      {showShareModal && (
        <MissingDocsModal
          isOpen={showShareModal}
          students={students}
          initialTopic={topicFilter !== "ALL" ? topicFilter : "ALL_REQUIRED"}
          initialTab={modalInitialTab}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Global Unlock Modal for Super Admin (All Students at once) */}
      {globalUnlockModalOpen && (
        <GlobalUnlockModal
          isOpen={globalUnlockModalOpen}
          studentCount={students.length}
          onClose={() => setGlobalUnlockModalOpen(false)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
