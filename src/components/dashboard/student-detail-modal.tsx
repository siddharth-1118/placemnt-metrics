"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Code2, ExternalLink, Github, GraduationCap, Mail, RefreshCw, Save, ShieldCheck, Trash2, UserRound, X, Loader2,
} from "lucide-react";
import { Button, Input, Label, Badge, Card, CardContent } from "@/components/ui";
import { GithubCard } from "@/components/dashboard/github-card";
import { LeetcodeCard } from "@/components/dashboard/leetcode-card";
import { VerificationPanel } from "@/components/dashboard/verification-panel";
import { SCORE_CAPS, SRM_OFFICIAL_METRICS, type ScoreAuditEntry, type ScoreBreakdown, type StudentDto } from "@/lib/types";
import {
  canWriteScoreField,
  docCategoryScope,
  hasScopeClient,
  isSharedScoreField,
  linkCategoryScope,
  scopesAreFull,
  type ScoreScope,
} from "@/lib/scopes";
import { fmtPct, fmtNumber, timeAgo } from "@/lib/utils";

const SCORE_FIELDS: { key: keyof ScoreBreakdown & string; label: string; cap: number; hint: string }[] = [
  { key: "academic", label: "Academic (10th+12th+CGPA)", cap: SCORE_CAPS.academic, hint: "Bands: 10th & 12th 2.5 each · CGPA up to 5" },
  { key: "github", label: "GitHub profile", cap: SCORE_CAPS.github, hint: "Contributions 5 · frequency 2 · community 3 · collabs 5" },
  { key: "coding", label: "Coding platforms", cap: SCORE_CAPS.coding, hint: "Badges 5 · medium & hard solved 5" },
  { key: "internship", label: "Internship experience", cap: SCORE_CAPS.internship, hint: "DRDO/ISRO/IIT/research 5 · Fortune 500 4 · <3mo 2 · paid 1" },
  { key: "certifications", label: "Skills & global certifications", cap: SCORE_CAPS.certifications, hint: "Global 5 · NPTEL 2 · Coursera 1 · max 5 courses" },
  { key: "projects", label: "Projects done", cap: SCORE_CAPS.projects, hint: "IIT/NIT/DRDO-class 5 · app 3 · mini 1–2 · max 3" },
  { key: "fullstack", label: "Full-stack experience", cap: SCORE_CAPS.fullstack, hint: "One FSD project (FE+BE+DB) = 5" },
  { key: "hackathons", label: "Competitions & hackathons", cap: SCORE_CAPS.hackathons, hint: "1st 5 · 2nd 4 · 3rd 3 · participated 1 · max 4" },
  { key: "inhouse", label: "In-house projects", cap: SCORE_CAPS.inhouse, hint: "UROP/SERI/special lab 4 each · max 2" },
  { key: "membership", label: "Professional membership", cap: SCORE_CAPS.membership, hint: "Valid IEEE/IET/ACM/CSI/ISTE = 2" },
  { key: "shl", label: "SHL / Talent Discovery / NCET", cap: SCORE_CAPS.shl, hint: "Score bands: 90–100→10 … <25→0" },
];

interface RubricBreakdownItem {
  fieldKey: keyof ScoreBreakdown;
  label: string;
  cap: number;
  docCategories: string[];
  linkCategories: string[];
}

const RUBRIC_BREAKDOWN_CONFIG: RubricBreakdownItem[] = [
  {
    fieldKey: "academic",
    label: "1. Academic Performance (10th/12th/CGPA)",
    cap: SCORE_CAPS.academic,
    docCategories: ["TENTH_MARKSHEET", "TWELFTH_MARKSHEET", "CGPA_MARKSHEET", "SEM1_MARKSHEET", "SEM2_MARKSHEET"],
    linkCategories: [],
  },
  {
    fieldKey: "github",
    label: "2. GitHub Footprint & Repositories",
    cap: SCORE_CAPS.github,
    docCategories: [],
    linkCategories: [],
  },
  {
    fieldKey: "coding",
    label: "3. Coding Platforms (LeetCode)",
    cap: SCORE_CAPS.coding,
    docCategories: [],
    linkCategories: [],
  },
  {
    fieldKey: "internship",
    label: "4. Internship Experience",
    cap: SCORE_CAPS.internship,
    docCategories: ["INTERNSHIP"],
    linkCategories: [],
  },
  {
    fieldKey: "certifications",
    label: "5. Skills & Global Certifications",
    cap: SCORE_CAPS.certifications,
    docCategories: ["SKILL_CERT"],
    linkCategories: [],
  },
  {
    fieldKey: "projects",
    label: "6. Projects Portfolio",
    cap: SCORE_CAPS.projects,
    docCategories: [],
    linkCategories: ["PROJECT"],
  },
  {
    fieldKey: "fullstack",
    label: "7. Full-Stack Development Experience",
    cap: SCORE_CAPS.fullstack,
    docCategories: [],
    linkCategories: ["FULLSTACK_PROJECT"],
  },
  {
    fieldKey: "hackathons",
    label: "8. Competitions & Hackathons",
    cap: SCORE_CAPS.hackathons,
    docCategories: ["COMPETITION"],
    linkCategories: [],
  },
  {
    fieldKey: "inhouse",
    label: "9. In-House / Laboratory Projects",
    cap: SCORE_CAPS.inhouse,
    docCategories: ["INHOUSE_PROJECT"],
    linkCategories: ["INHOUSE_PROJECT_LINK"],
  },
  {
    fieldKey: "membership",
    label: "10. Professional Memberships",
    cap: SCORE_CAPS.membership,
    docCategories: ["MEMBERSHIP"],
    linkCategories: [],
  },
  {
    fieldKey: "shl",
    label: "11. SHL Assessment / Talent Discovery",
    cap: SCORE_CAPS.shl,
    docCategories: ["SHL"],
    linkCategories: [],
  },
];

/** The three system-calculated components (super-admin overridable). */
type AutoScoreField = "academic" | "github" | "coding";
const AUTO_SCORE_FIELDS: AutoScoreField[] = ["academic", "github", "coding"];
const isAutoField = (k: keyof ScoreBreakdown): k is AutoScoreField =>
  AUTO_SCORE_FIELDS.includes(k as AutoScoreField);

/** Extract the editable score state from a student DTO (auto + manual fields). */
function scoresOf(s: StudentDto): ScoreBreakdown {
  return {
    academic: s.scores.academic,
    github: s.scores.github,
    coding: s.scores.coding,
    internship: s.scores.internship,
    certifications: s.scores.certifications,
    projects: s.scores.projects,
    fullstack: s.scores.fullstack,
    hackathons: s.scores.hackathons,
    inhouse: s.scores.inhouse,
    membership: s.scores.membership,
    shl: s.scores.shl,
  };
}

function diffRows(s: StudentDto, show: { github: boolean; coding: boolean }) {
  const gh = s.scrapes.find((x) => x.platform === "GITHUB");
  const lc = s.scrapes.find((x) => x.platform === "LEETCODE");
  const ghData = gh?.data && "publicRepos" in gh.data ? gh.data : null;
  const lcData = lc?.data && "solvedTotal" in lc.data ? lc.data : null;
  const rows: { label: string; submitted: string; scraped: string; match: boolean | null }[] = [];

  if (s.githubUrl && show.github) {
    const submittedLogin = (s.githubUrl.match(/github\.com\/([^/]+)/i)?.[1] ?? "").replace(/\/$/, "");
    rows.push({
      label: "GitHub username",
      submitted: submittedLogin || "—",
      scraped: ghData ? `@${ghData.login}` : gh?.status === "FAILED" ? "scrape failed" : "pending…",
      match: ghData ? submittedLogin.toLowerCase() === ghData.login.toLowerCase() : null,
    });
    rows.push({
      label: "Public repos",
      submitted: "—",
      scraped: ghData ? String(ghData.publicRepos) : "—",
      match: null,
    });
    rows.push({
      label: "Contributions (1y)",
      submitted: "—",
      scraped: ghData ? String(ghData.contributionsLastYear) : "—",
      match: null,
    });
    rows.push({
      label: "Stars earned",
      submitted: "—",
      scraped: ghData ? String(ghData.totalStars) : "—",
      match: null,
    });
  }
  if (s.leetcodeUrl && show.coding) {
    const submittedUser = (s.leetcodeUrl.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i)?.[1] ?? "");
    rows.push({
      label: "LeetCode username",
      submitted: submittedUser || "—",
      scraped: lcData ? `@${lcData.username}` : lc?.status === "FAILED" ? "scrape failed" : "pending…",
      match: lcData ? submittedUser.toLowerCase() === lcData.username.toLowerCase() : null,
    });
    rows.push({
      label: "Problems solved",
      submitted: "—",
      scraped: lcData ? `${lcData.solvedTotal} (E${lcData.solvedEasy} / M${lcData.solvedMedium} / H${lcData.solvedHard})` : "—",
      match: null,
    });
    rows.push({
      label: "Contest rating",
      submitted: "—",
      scraped: lcData?.contestRating !== null && lcData ? String(Math.round(lcData.contestRating)) : "—",
      match: null,
    });
    rows.push({
      label: "Global ranking",
      submitted: "—",
      scraped: lcData?.ranking !== null && lcData ? `#${fmtNumber(lcData.ranking)}` : "—",
      match: null,
    });
  }
  return rows;
}

export function StudentDetailModal({
  studentId,
  canScore = true,
  /** Super admin — may view everything regardless of scopes. */
  isSuperAdmin = false,
  permissionScopes = [],
  onClose,
  onChanged,
}: {
  studentId: string;
  canScore?: boolean;
  isSuperAdmin?: boolean;
  /** Sections this coordinator may view & score; empty = all. */
  permissionScopes?: ScoreScope[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scores, setScores] = useState<ScoreBreakdown>({
    academic: 0, github: 0, coding: 0, internship: 0, certifications: 0,
    projects: 0, fullstack: 0, hackathons: 0, inhouse: 0, membership: 0, shl: 0,
  });
  /** Sections edited since the last save — ONLY these are sent on save, so a
   *  stale modal can never silently revert another coordinator's fresh marks. */
  const [dirty, setDirty] = useState<Set<keyof ScoreBreakdown>>(new Set());
  /** Auto components the super admin asked to reset back to calculated values. */
  const [autoReset, setAutoReset] = useState<Set<"academic" | "github" | "coding">>(new Set());
  /** True when the coordinator note was edited — only then is it sent. */
  const [noteDirty, setNoteDirty] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rescraping, setRescraping] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/students/${studentId}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Failed to load student");
        if (!alive) return;
        setStudent(body.student);
        setScores(scoresOf(body.student));
        setDirty(new Set());
        setAutoReset(new Set());
        setNote(body.student.coordinatorNote ?? "");
        setNoteDirty(false);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [studentId]);

  const total = useMemo(
    () =>
      Math.min(
        100,
        Object.values(scores).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
      ),
    [scores]
  );

  const viewer = useMemo(
    () => ({ isSuperAdmin, permissionScopes }),
    [isSuperAdmin, permissionScopes]
  );

  /**
   * Turning the whole submission green is reserved for ALL-SECTION (full
   * access) reviewers. Scoped coordinators still verify their own sections
   * and enter their own marks — they just cannot give the final sign-off.
   */
  const canFinalVerify = isSuperAdmin || scopesAreFull(permissionScopes);

  /** Newest score-audit entry per rubric field → who set this section last. */
  const lastByField = useMemo(() => {
    const m = new Map<string, ScoreAuditEntry>();
    for (const e of student?.scoreAudit ?? []) if (!m.has(e.field)) m.set(e.field, e);
    return m;
  }, [student]);

  /** Reviewers: who contributed reviews to sections, and who signed off overall. */
  const reviewersInfo = useMemo(() => {
    if (!student) return { finalVerifier: null, sectionReviewers: [], allReviewers: [] };
    const finalVerifier = student.status === "VERIFIED" ? student.verifiedByName : null;
    const reviewers = new Set<string>();
    for (const a of student.scoreAudit ?? []) {
      if (a.action !== "auto" && a.byName) {
        reviewers.add(a.byName);
      }
    }
    for (const d of student.documents ?? []) {
      if (d.reviewedByName) reviewers.add(d.reviewedByName);
    }
    for (const l of student.projectLinks ?? []) {
      if (l.reviewedByName) reviewers.add(l.reviewedByName);
    }
    const allReviewers = Array.from(reviewers);
    const sectionReviewers = allReviewers.filter((name) => name !== finalVerifier);
    return { finalVerifier, sectionReviewers, allReviewers };
  }, [student]);

  const pendingDocsCount = useMemo(
    () => student?.documents.filter((d) => d.status === "PENDING").length ?? 0,
    [student]
  );
  const pendingLinksCount = useMemo(
    () => student?.projectLinks.filter((l) => l.status === "PENDING").length ?? 0,
    [student]
  );
  const totalPendingReviews = pendingDocsCount + pendingLinksCount;

  /** Server strips out-of-scope evidence; hide its score fields client-side too. */
  const scoreFieldAllowed = (key: keyof ScoreBreakdown) =>
    isSuperAdmin || canWriteScoreField(viewer, key);

  /** Academic/GitHub/Coding are auto-calculated — everyone may VIEW them. */
  const canViewSection = (scope: ScoreScope) => hasScopeClient(viewer, scope);

  /** Is this specific document/link in one of my sections? */
  const itemAllowed = (category: string, kind: "doc" | "link") =>
    hasScopeClient(
      viewer,
      kind === "doc" ? docCategoryScope(category) : linkCategoryScope(category)
    );
  const rows = useMemo(
    () =>
      student
        ? diffRows(student, {
            github: canViewSection("GITHUB"),
            coding: canViewSection("CODING"),
          })
        : [],
    [student, viewer]
  );

  // Poll while any scrape job is still running/pending.
  const pendingScrapes = student?.scrapes.some((s) => s.status === "RUNNING" || s.status === "PENDING") ?? false;
  useEffect(() => {
    if (!pendingScrapes) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/students/${studentId}`, { cache: "no-store" });
        if (res.ok) {
          const body = await res.json();
          setStudent(body.student);
          // Sync the auto inputs with fresh scrape results — unless the super
          // admin is mid-edit (or resetting) one of them right now.
          setScores((prev) =>
            AUTO_SCORE_FIELDS.every((k) => !dirty.has(k))
              ? {
                  ...prev,
                  academic: body.student.scores.academic,
                  github: body.student.scores.github,
                  coding: body.student.scores.coding,
                }
              : prev
          );
        }
      } catch {
        /* ignore transient errors */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [pendingScrapes, studentId, dirty]);

  async function save(verify?: boolean) {
    if (!student) return;
    if (verify === true && totalPendingReviews > 0) {
      setError(
        `Cannot mark candidate as verified: ${totalPendingReviews} evidence item(s) are still pending coordinator review. All documents and links must be verified or rejected first.`
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send ONLY the sections this coordinator actually edited (plus
          // permission filtering): the server merges partial updates, so
          // sections another coordinator saved meanwhile are never reverted
          // by a stale modal snapshot.
          scores: Object.fromEntries(
            Object.entries({
              // Auto components: only the super admin may send these (each
              // becomes a persistent manual override on the server).
              academic: Number(scores.academic),
              github: Number(scores.github),
              coding: Number(scores.coding),
              internship: Number(scores.internship),
              certifications: Number(scores.certifications),
              projects: Number(scores.projects),
              fullstack: Number(scores.fullstack),
              hackathons: Number(scores.hackathons),
              inhouse: Number(scores.inhouse),
              membership: Number(scores.membership),
              shl: Number(scores.shl),
            }).filter(([k]) => {
              const key = k as keyof ScoreBreakdown;
              if (!dirty.has(key)) return false;
              if (isAutoField(key)) return isSuperAdmin && !autoReset.has(key);
              return scoreFieldAllowed(key);
            })
          ),
          ...(isSuperAdmin && autoReset.size > 0 ? { autoReset: [...autoReset] } : {}),
          coordinatorNote: noteDirty ? note : undefined,
          ...(verify === undefined ? {} : { verify }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to save scores");
      setStudent(body.student);
      // Adopt the server-confirmed values (clamped caps, auto recalcs) and
      // clear the dirty set so a second Save can't re-send stale edits.
      setScores(scoresOf(body.student));
      setDirty(new Set());
      setAutoReset(new Set());
      setNote(body.student.coordinatorNote ?? "");
      setNoteDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function rescrape(platform?: "GITHUB" | "LEETCODE") {
    if (!student) return;
    setRescraping(true);
    try {
      await fetch(`/api/students/${student.id}/rescrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(platform ? { platform } : {}),
      });
      const res = await fetch(`/api/students/${student.id}`, { cache: "no-store" });
      if (res.ok) setStudent((await res.json()).student);
      onChanged();
    } finally {
      setRescraping(false);
    }
  }

  async function deleteProfile() {
    if (!student) return;
    const ok = window.confirm(
      `Permanently delete ${student.fullName} (${student.registerNumber})?\n\n` +
        "This removes their profile, scraped data, all uploaded documents and score. " +
        "It cannot be undone."
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      onClose();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="my-2 w-full max-w-4xl overflow-hidden rounded-md border border-[#ded9ce] bg-white shadow-lg dark:border-[#262f3c] dark:bg-[#1b222c] sm:my-6">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#ded9ce] bg-[#faf8f5] px-5 py-3 dark:border-[#262f3c] dark:bg-[#161c24]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#165b33] text-xs font-bold text-white">
            {student ? student.fullName.charAt(0).toUpperCase() : <UserRound className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-[#1c2024] dark:text-white">
              {student ? student.fullName : loading ? "Loading Student Records…" : "Student Details"}
            </h2>
            <p className="truncate font-mono text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
              {student ? `${student.registerNumber} · ${student.email}` : ""}
              {student?.facultyAdvisor ? ` · FA: ${student.facultyAdvisor}` : ""}
            </p>
            {student && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                {student.status === "VERIFIED" ? (
                  <p className="flex flex-wrap items-center gap-1 text-[#165b33] dark:text-[#78d69f]" title="Official verifier of record">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Final Sign-off by <strong>{student.verifiedByName || "Coordinator"}</strong>
                      {student.verifiedAt ? ` · ${timeAgo(student.verifiedAt)}` : ""}
                    </span>
                    {reviewersInfo.sectionReviewers.length > 0 && (
                      <span className="text-[#5c6470] dark:text-[#94a3b8]">
                        · Section evaluators: <strong className="text-[#1c2024] dark:text-white">{reviewersInfo.sectionReviewers.join(", ")}</strong>
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="flex flex-wrap items-center gap-1 text-[#92540d] dark:text-[#f3b55c]">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Status: <strong>Pending Final Sign-off</strong></span>
                    {reviewersInfo.allReviewers.length > 0 ? (
                      <span className="text-[#5c6470] dark:text-[#94a3b8]">
                        · Evaluated so far by: <strong className="text-[#1c2024] dark:text-white">{reviewersInfo.allReviewers.join(", ")}</strong>
                      </span>
                    ) : (
                      <span className="text-[#5c6470] dark:text-[#94a3b8]">· Awaiting coordinator reviews</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
          {student && (
            <Badge variant={student.status === "VERIFIED" ? "success" : "warning"}>
              {student.status === "VERIFIED" ? <ShieldCheck className="h-3 w-3" /> : null}
              {student.status}
            </Badge>
          )}
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="h-7 w-7 text-[#5c6470] hover:text-[#1c2024] dark:hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-6 p-3 sm:p-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading student details…
            </div>
          )}

          {student && (
            <>
              {/* Full student profile */}
              <section className="rounded-xl border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Student profile
                  </h3>
                </div>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Identity */}
                  <div className="space-y-1.5 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity</p>
                    <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {student.email}</p>
                    <p className="font-mono text-xs text-muted-foreground">{student.registerNumber}</p>
                    {student.facultyAdvisor && (
                      <p className="text-muted-foreground">FA: <span className="text-foreground">{student.facultyAdvisor}</span></p>
                    )}
                  </div>
                  {/* Academic marks — visible with the ACADEMIC scope */}
                  {canViewSection("ACADEMIC") && (
                    <div className="space-y-1.5 text-sm">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <GraduationCap className="h-3.5 w-3.5" /> Academic marks
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">10th</span>
                        <span className="font-semibold tabular-nums">{fmtPct(student.tenthPercent)}</span>
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">12th</span>
                        <span className="font-semibold tabular-nums">{fmtPct(student.twelfthPercent)}</span>
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">CGPA</span>
                        <span className="font-semibold tabular-nums">
                          {student.cgpa.toFixed(2)}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            (S1 {student.sgpaSem1.toFixed(2)} + S2 {student.sgpaSem2.toFixed(2)}) ÷ 2
                          </span>
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-3 border-t pt-1.5">
                        <span className="text-muted-foreground">Auto score</span>
                        <Badge variant="secondary">
                          {student.scores.academic.toFixed(1)} / {SCORE_CAPS.academic}
                        </Badge>
                      </p>
                    </div>
                  )}
                  {/* Profile links */}
                  <div className="space-y-1.5 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profiles</p>
                    {canViewSection("GITHUB") &&
                      (student.githubUrl ? (
                        <a href={student.githubUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-primary hover:underline">
                          <Github className="h-3.5 w-3.5" /> GitHub profile <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-muted-foreground">GitHub — not provided</p>
                      ))}
                    {canViewSection("CODING") &&
                      (student.leetcodeUrl ? (
                        <a href={student.leetcodeUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-primary hover:underline">
                          <Code2 className="h-3.5 w-3.5" /> LeetCode profile <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-muted-foreground">LeetCode — not provided</p>
                      ))}
                    <p className="text-xs text-muted-foreground">Submitted {timeAgo(student.createdAt)}</p>
                  </div>
                </div>
              </section>

              {/* Submitted vs scraped comparison */}
              {rows.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Submitted vs scraped
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => rescrape()} disabled={rescraping}>
                      {rescraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Re-scrape
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 scrollbar-thin">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="border-b border-slate-200 bg-slate-100/80 text-left text-xs uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Field</th>
                          <th className="px-3 py-2 font-medium">Submitted</th>
                          <th className="px-3 py-2 font-medium">Scraped (live)</th>
                          <th className="px-3 py-2 font-medium">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.label} className="border-t">
                            <td className="px-3 py-2 font-medium">{r.label}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.submitted}</td>
                            <td className="px-3 py-2">{r.scraped}</td>
                            <td className="px-3 py-2">
                              {r.match === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : r.match ? (
                                <Badge variant="success">match</Badge>
                              ) : (
                                <Badge variant="destructive">mismatch</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {student.scrapes.some((s) => s.error) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {student.scrapes
                        .filter((s) => s.error)
                        .map((s) => `${s.platform}: ${s.error} (${timeAgo(s.finishedAt)})`)
                        .join(" · ")}
                    </p>
                  )}
                </section>
              )}

              {/* Profile cards */}
              <section className="grid gap-4 lg:grid-cols-2">
                {(() => {
                  const gh = student.scrapes.find((s) => s.platform === "GITHUB");
                  const lc = student.scrapes.find((s) => s.platform === "LEETCODE");
                  const ghData = gh?.data && "publicRepos" in gh.data ? gh.data : null;
                  const lcData = lc?.data && "solvedTotal" in lc.data ? lc.data : null;
                  const canSeeGithub = canViewSection("GITHUB");
                  const canSeeCoding = canViewSection("CODING");
                  return (
                    <>
                      {canSeeGithub &&
                        (ghData ? (
                          <GithubCard data={ghData} />
                        ) : (
                          <Card>
                            <CardContent className="pt-5">
                              <p className="text-sm text-muted-foreground">
                                {gh?.status === "RUNNING" || gh?.status === "PENDING"
                                  ? "GitHub scrape in progress…"
                                  : student.githubUrl
                                    ? `GitHub scrape failed: ${gh?.error ?? "unknown error"}`
                                    : "No GitHub profile provided."}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      {canSeeCoding &&
                        (lcData ? (
                          <LeetcodeCard data={lcData} />
                        ) : (
                          <Card>
                            <CardContent className="pt-5">
                              <p className="text-sm text-muted-foreground">
                                {lc?.status === "RUNNING" || lc?.status === "PENDING"
                                  ? "LeetCode scrape in progress…"
                                  : student.leetcodeUrl
                                    ? `LeetCode scrape failed: ${lc?.error ?? "unknown error"}`
                                    : "No LeetCode profile provided."}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                    </>
                  );
                })()}
              </section>

              {/* Proof links (legacy free-form) */}
              {student.proofUrls.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Other proof links (student-submitted)
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {student.proofUrls.map((p, i) => (
                      <li key={i} className="rounded-lg border px-3 py-2 text-sm">
                        <span className="font-medium">{p.label}</span>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="ml-2 break-all text-xs text-primary hover:underline"
                        >
                          {p.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Document & link verification */}
              {(student.documents.length > 0 || student.projectLinks.length > 0) && (
                <section className="rounded-xl border p-4">
                  <VerificationPanel
                    documents={student.documents.filter((d) => itemAllowed(d.category, "doc"))}
                    links={student.projectLinks.filter((l) => itemAllowed(l.category, "link"))}
                    canScore={canScore}
                    onChanged={async () => {
                      const res = await fetch(`/api/students/${studentId}`, { cache: "no-store" });
                      if (res.ok) setStudent((await res.json()).student);
                    }}
                  />
                </section>
              )}

              {/* Score entry panel */}
              <section className={canScore ? "space-y-3" : "hidden"}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Score entry (out of 100) · SRM 2022-2026 &amp; 2023-2027 Rubric
                  </h3>
                </div>
                <p className="rounded-lg border bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Auto-calculated:</span>{" "}
                  Academic {student.scores.academic.toFixed(1)}/{SCORE_CAPS.academic} (10th/12th/CGPA bands) · GitHub{" "}
                  {student.scores.github.toFixed(1)}/{SCORE_CAPS.github} (live scrape) · Coding{" "}
                  {student.scores.coding.toFixed(1)}/{SCORE_CAPS.coding} (live scrape). Enter the
                  section marks below; totals and ranks update on save.
                </p>

                {/* Official Metrics Reference Accordion */}
                <details className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900/50 dark:bg-blue-950/30">
                  <summary className="cursor-pointer font-bold text-blue-700 dark:text-blue-400 hover:underline">
                    View Official SRM 13-Point Placement Metrics Criteria &amp; Split-Up (100 Marks Total)
                  </summary>
                  <div className="mt-3 divide-y divide-slate-200 border-t border-blue-200 pt-2 dark:divide-slate-800 dark:border-blue-900/50">
                    {SRM_OFFICIAL_METRICS.map((m, idx) => (
                      <div key={m.id} className="py-2 text-[11px] grid grid-cols-1 sm:grid-cols-12 gap-1 items-start">
                        <div className="sm:col-span-4 font-semibold text-slate-900 dark:text-white">
                          {idx + 1}. {m.name}
                        </div>
                        <div className="sm:col-span-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {m.allottedMarks} Marks
                        </div>
                        <div className="sm:col-span-6 text-slate-600 dark:text-slate-400">
                          {m.splitUp}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Section Verification & Evaluator Breakdown (All 11 Criteria) */}
                <div className="rounded-xl border border-[#ded9ce] bg-[#faf8f5] p-3.5 text-xs dark:border-[#262f3c] dark:bg-[#161c24]">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#ded9ce] dark:border-[#262f3c]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#165b33] dark:text-[#78d69f]" />
                      <span className="font-bold text-[#1c2024] dark:text-white">
                        Section Verification &amp; Evaluator Breakdown (All 11 Criteria)
                      </span>
                    </div>
                    <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                      {student.documents.length} document(s) · {student.projectLinks.length} project link(s)
                    </span>
                  </div>

                  <div className="mt-2.5 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#ded9ce] text-[11px] font-semibold text-[#5c6470] dark:border-[#262f3c] dark:text-[#94a3b8]">
                          <th className="pb-1.5 font-semibold">Rubric Section</th>
                          <th className="pb-1.5 font-semibold">Marks Awarded</th>
                          <th className="pb-1.5 font-semibold">Score Evaluator</th>
                          <th className="pb-1.5 font-semibold">Proof &amp; Reviewers</th>
                          <th className="pb-1.5 text-right font-semibold">Section Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e8e4db] dark:divide-[#232b36]">
                        {RUBRIC_BREAKDOWN_CONFIG.map((sec) => {
                          const isAuto = isAutoField(sec.fieldKey);
                          const last = lastByField.get(sec.fieldKey);
                          const scoreVal = scores[sec.fieldKey] ?? 0;

                          const secDocs = student.documents.filter((d) => sec.docCategories.includes(d.category));
                          const secLinks = student.projectLinks.filter((l) => sec.linkCategories.includes(l.category));

                          const pDocs = secDocs.filter((d) => d.status === "PENDING").length;
                          const vDocs = secDocs.filter((d) => d.status === "VERIFIED").length;
                          const rDocs = secDocs.filter((d) => d.status === "REJECTED").length;

                          const pLinks = secLinks.filter((l) => l.status === "PENDING").length;
                          const vLinks = secLinks.filter((l) => l.status === "VERIFIED").length;
                          const rLinks = secLinks.filter((l) => l.status === "REJECTED").length;

                          const totalPending = pDocs + pLinks;
                          const totalVerified = vDocs + vLinks;
                          const totalRejected = rDocs + rLinks;
                          const totalEvidence = secDocs.length + secLinks.length;

                          const proofReviewers = Array.from(
                            new Set(
                              secDocs
                                .map((d) => d.reviewedByName)
                                .concat(secLinks.map((l) => l.reviewedByName))
                                .filter(Boolean) as string[]
                            )
                          );

                          return (
                            <tr key={sec.fieldKey} className="py-2">
                              <td className="py-2 pr-2 font-medium text-[#1c2024] dark:text-white">
                                <div>{sec.label}</div>
                                <div className="font-mono text-[10px] text-[#5c6470] dark:text-[#94a3b8]">
                                  Cap: {sec.cap} Marks
                                </div>
                              </td>
                              <td className="py-2 pr-2 font-mono font-bold text-[#1c2024] dark:text-white">
                                {scoreVal.toFixed(1)}{" "}
                                <span className="text-[11px] font-normal text-muted-foreground">/ {sec.cap}</span>
                              </td>
                              <td className="py-2 pr-2 text-[11px]">
                                {isAuto ? (
                                  last?.action === "override" ? (
                                    <span className="text-amber-700 dark:text-amber-400">
                                      Overridden by {last.byName} ({timeAgo(last.at)})
                                    </span>
                                  ) : (
                                    <span className="text-sky-700 dark:text-sky-400">
                                      System calculated ({sec.fieldKey === "academic" ? "Marks bands" : "Live scrape"})
                                    </span>
                                  )
                                ) : last ? (
                                  <span className="text-[#165b33] dark:text-[#78d69f]">
                                    {last.action === "entered" ? "Entered by" : "Updated by"} <strong>{last.byName}</strong>
                                    <span className="text-muted-foreground"> · {timeAgo(last.at)}</span>
                                  </span>
                                ) : (
                                  <span className="text-stone-400 dark:text-stone-600">Pending score entry</span>
                                )}
                              </td>
                              <td className="py-2 pr-2 text-[11px]">
                                {totalEvidence > 0 ? (
                                  <div>
                                    <div className="flex flex-wrap gap-1">
                                      {vDocs + vLinks > 0 && (
                                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                          {vDocs + vLinks} verified
                                        </span>
                                      )}
                                      {pDocs + pLinks > 0 && (
                                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                                          {pDocs + pLinks} pending
                                        </span>
                                      )}
                                      {rDocs + rLinks > 0 && (
                                        <span className="text-rose-700 dark:text-rose-400 font-medium">
                                          {rDocs + rLinks} rejected
                                        </span>
                                      )}
                                    </div>
                                    {proofReviewers.length > 0 && (
                                      <div className="text-[10px] text-muted-foreground">
                                        Proof reviewed by: <strong>{proofReviewers.join(", ")}</strong>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">
                                    {isAuto ? "Live platform evidence" : "No files/links attached"}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-right">
                                {totalPending > 0 ? (
                                  <Badge
                                    variant="warning"
                                    className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                                  >
                                    Pending Review ({totalPending})
                                  </Badge>
                                ) : totalVerified > 0 ? (
                                  <Badge variant="success" className="text-[10px]">
                                    Verified
                                  </Badge>
                                ) : totalRejected > 0 ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Rejected
                                  </Badge>
                                ) : isAuto ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Auto Scored
                                  </Badge>
                                ) : scoreVal > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-emerald-700 border-emerald-300 dark:text-emerald-400"
                                  >
                                    Scored ({scoreVal.toFixed(1)})
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-stone-400 border-stone-200 dark:border-stone-800"
                                  >
                                    Unreviewed
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Evaluator-only: who entered which marks, newest first */}
                {student.scoreAudit.length > 0 && (
                  <details
                    className="rounded-xl border border-[#e2ded5] bg-[#faf8f5] p-3 text-xs dark:border-[#262f3c] dark:bg-[#161c24]"
                    title="Evaluator-only audit trail"
                  >
                    <summary className="cursor-pointer font-semibold text-[#165b33] dark:text-[#78d69f]">
                      Marks audit — who entered which marks ({student.scoreAudit.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {student.scoreAudit.slice(0, 15).map((e, i) => (
                        <li key={`${e.field}-${e.at}-${i}`} className="flex flex-wrap items-center gap-2">
                          <span className="w-44 truncate font-medium text-[#1c2024] dark:text-white">
                            {SCORE_FIELDS.find((f) => f.key === e.field)?.label ?? e.field}
                          </span>
                          <span className="font-mono font-semibold">{e.value.toFixed(1)}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              e.action === "entered"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : e.action === "override"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : e.action === "reset"
                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                                    : "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {e.action}
                          </span>
                          <span className="text-muted-foreground">
                            {e.action === "auto" ? "system" : e.byName} · {timeAgo(e.at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {student.scoreAudit.length > 15 && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Showing the 15 most recent of {student.scoreAudit.length} entries.
                      </p>
                    )}
                  </details>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SCORE_FIELDS.filter((f) => isSuperAdmin || scoreFieldAllowed(f.key)).map((f) => {
                      const isAuto = isAutoField(f.key);
                      const overridden = isAuto ? (student.autoOverrides?.[f.key as AutoScoreField] ?? false) : false;
                      const isResetting = isAuto ? autoReset.has(f.key as AutoScoreField) : false;
                      const touched = isAuto && (overridden || dirty.has(f.key)) && !isResetting;
                      const last = lastByField.get(f.key);
                      return (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-xs">
                          {f.label} <span className="text-muted-foreground">/ {f.cap}</span>
                          {isAuto && !isSuperAdmin && (
                            <span
                              className="ml-1.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600"
                              title="Calculated automatically from marks bands / live profile scrapes — read-only"
                            >
                              auto
                            </span>
                          )}
                          {touched && (
                            <span
                              className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                              title="Manual override — survives rescrapes and recalculations until reset"
                            >
                              override
                            </span>
                          )}
                          {isSharedScoreField({ isSuperAdmin: false, permissionScopes }, f.key) && (
                            <span
                              className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                              title="This score is shared with coordinators of the other sections covered by it — coordinate before changing it"
                            >
                              shared score
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={f.cap}
                          step="0.5"
                          disabled={isAuto && !isSuperAdmin}
                          title={isAuto && !isSuperAdmin ? "Calculated automatically — only the super admin can change this" : undefined}
                          value={String(scores[f.key])}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 0 : Math.min(f.cap, Math.max(0, Number(e.target.value)));
                            setScores((s) => ({ ...s, [f.key]: v }));
                            setDirty((d) => new Set(d).add(f.key));
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                        {last && (
                          <p
                            className="text-[10px] text-muted-foreground"
                            title="Evaluator-only: last recorded score change for this section"
                          >
                            {last.action === "entered"
                              ? "Entered by"
                              : last.action === "override"
                                ? "Overridden by"
                                : last.action === "reset"
                                  ? "Reset to auto by"
                                  : "Last auto-recalculated"}{" "}
                            {last.action === "auto" ? "" : last.byName}
                            {last.action === "auto" ? "· system" : ""} · {last.value.toFixed(1)} M · {timeAgo(last.at)}
                          </p>
                        )}
                        {isAuto && isSuperAdmin && touched && (
                          <button
                            type="button"
                            className="text-[10px] font-medium text-muted-foreground underline hover:text-foreground"
                            onClick={() => {
                              setAutoReset((s) => new Set(s).add(f.key as AutoScoreField));
                              setDirty((d) => {
                                const n = new Set(d);
                                n.delete(f.key as AutoScoreField);
                                return n;
                              });
                            }}
                          >
                            Reset to auto-calculated
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{total.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 100</span>
                      </div>
                      {student.rank !== null && (
                        <Badge variant="secondary">Rank #{student.rank}</Badge>
                      )}
                    </div>
                    <Input
                      placeholder="Coordinator note (optional)"
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setNoteDirty(true);
                      }}
                      className="h-9 w-full"
                    />
                    <div className="flex flex-col gap-2.5">
                      {canFinalVerify && totalPendingReviews > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div>
                            <p className="font-semibold">Verification Gating Active</p>
                            <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                              Candidate has {pendingDocsCount > 0 ? `${pendingDocsCount} pending document(s)` : ""}
                              {pendingDocsCount > 0 && pendingLinksCount > 0 ? " and " : ""}
                              {pendingLinksCount > 0 ? `${pendingLinksCount} pending project link(s)` : ""} requiring coordinator review.
                              All evidence must be verified or rejected by section coordinators before final approval can be granted.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {canFinalVerify ? (
                          <>
                            <Button
                              variant="outline"
                              className="w-full sm:w-auto text-xs h-8"
                              onClick={() => save(false)}
                              disabled={saving || !canScore}
                              title="Clear the verification state"
                            >
                              Save as Pending
                            </Button>
                            <Button
                              className="w-full gap-1.5 bg-[#165b33] hover:bg-[#124929] px-4 text-xs font-semibold text-white shadow-sm sm:w-auto h-8"
                              onClick={() => save(true)}
                              disabled={saving || !canScore || totalPendingReviews > 0}
                              title={
                                totalPendingReviews > 0
                                  ? `Cannot verify: ${totalPendingReviews} item(s) pending coordinator review`
                                  : "Mark the whole submission verified (turns status green)"
                              }
                            >
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                              Save &amp; Verify Candidate
                            </Button>
                          </>
                        ) : (
                          <Button
                            className="w-full gap-1.5 bg-[#165b33] hover:bg-[#124929] px-4 text-xs font-semibold text-white shadow-sm sm:w-auto h-8"
                            onClick={() => save()}
                            disabled={saving || !canScore}
                            title="Save your section scores — final verification is reserved for all-sections coordinators"
                          >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save Scores
                          </Button>
                        )}
                        {savedFlash && <Badge variant="success">Saved — records updated</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
