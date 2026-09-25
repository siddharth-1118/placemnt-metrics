"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, RefreshCw, Save, ShieldCheck, Trash2, UserRound, X, Loader2,
} from "lucide-react";
import { Button, Input, Label, Badge, Card, CardContent } from "@/components/ui";
import { GithubCard } from "@/components/dashboard/github-card";
import { LeetcodeCard } from "@/components/dashboard/leetcode-card";
import { VerificationPanel } from "@/components/dashboard/verification-panel";
import { SCORE_CAPS, type ScoreBreakdown, type StudentDto } from "@/lib/types";
import { hasScopeClient, type ScoreScope } from "@/lib/scopes";
import { fmtPct, fmtNumber, timeAgo } from "@/lib/utils";

const SECTION_SCOPE_OF: Record<keyof ScoreBreakdown, ScoreScope> = {
  academic: "ACADEMIC",
  github: "GITHUB",
  coding: "CODING",
  projects: "PROJECTS",
  internship: "INTERNSHIP",
  extras: "EXTRAS",
};

const SCORE_FIELDS: { key: keyof ScoreBreakdown & string; label: string; cap: number; hint: string }[] = [
  { key: "academic", label: "Academic marks", cap: SCORE_CAPS.academic, hint: "Auto-filled from 10th/12th/CGPA" },
  { key: "github", label: "GitHub profile", cap: SCORE_CAPS.github, hint: "Repos · contributions · stars · languages" },
  { key: "coding", label: "Coding platforms", cap: SCORE_CAPS.coding, hint: "LeetCode solved · difficulty mix · contest rating" },
  { key: "projects", label: "Projects", cap: SCORE_CAPS.projects, hint: "Score after verifying project links" },
  { key: "internship", label: "Internships", cap: SCORE_CAPS.internship, hint: "Score after verifying internship documents" },
  { key: "extras", label: "Extras & certifications", cap: SCORE_CAPS.extras, hint: "Certs, competitions, memberships, SHL — after document verification" },
];

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
  permissionScopes = [],
  onClose,
  onChanged,
}: {
  studentId: string;
  canScore?: boolean;
  /** Sections this coordinator may view & score; empty = all. */
  permissionScopes?: ScoreScope[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scores, setScores] = useState<ScoreBreakdown>({ academic: 0, github: 0, coding: 0, projects: 0, internship: 0, extras: 0 });
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
        setScores({
          academic: body.student.scores.academic,
          github: body.student.scores.github,
          coding: body.student.scores.coding,
          projects: body.student.scores.projects,
          internship: body.student.scores.internship,
          extras: body.student.scores.extras,
        });
        setNote(body.student.coordinatorNote ?? "");
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

  /** Server strips out-of-scope evidence; hide its score fields client-side too. */
  const scoreFieldAllowed = (key: keyof ScoreBreakdown) =>
    hasScopeClient({ isSuperAdmin: false, permissionScopes }, SECTION_SCOPE_OF[key]);
  const rows = useMemo(
    () =>
      student
        ? diffRows(student, {
            github: scoreFieldAllowed("github"),
            coding: scoreFieldAllowed("coding"),
          })
        : [],
    [student, permissionScopes]
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
        }
      } catch {
        /* ignore transient errors */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [pendingScrapes, studentId]);

  async function save(verify?: boolean) {
    if (!student) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send only the sections this coordinator may score — the server
          // rejects out-of-scope writes, so restricted fields stay untouched.
          scores: Object.fromEntries(
            Object.entries({
              academic: Number(scores.academic),
              github: Number(scores.github),
              coding: Number(scores.coding),
              projects: Number(scores.projects),
              internship: Number(scores.internship),
              extras: Number(scores.extras),
            }).filter(([k]) => scoreFieldAllowed(k as keyof ScoreBreakdown))
          ),
          coordinatorNote: note || undefined,
          ...(verify === undefined ? {} : { verify }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to save scores");
      setStudent(body.student);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[hsl(230_35%_14%/0.45)] p-2 backdrop-blur-[6px] sm:p-4" role="dialog" aria-modal="true">
      <div className="glass-strong my-2 w-full max-w-4xl animate-rise rounded-2xl sm:my-6 sm:rounded-3xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-t-3xl px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(262_95%_68%)] to-[hsl(320_85%_60%)] text-sm font-bold text-white shadow-[0_2px_10px_-2px_hsl(275_90%_60%/0.6)]">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">
              {student ? student.fullName : loading ? "Loading…" : "Student"}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {student ? `${student.registerNumber} · ${student.email}` : ""}
              {student?.facultyAdvisor ? ` · FA: ${student.facultyAdvisor}` : ""}
            </p>
          </div>
          {student && (
            <Badge variant={student.status === "VERIFIED" ? "success" : "warning"}>
              {student.status === "VERIFIED" ? <ShieldCheck className="h-3 w-3" /> : null}
              {student.status}
            </Badge>
          )}
          {student && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Delete profile permanently"
              disabled={deleting}
              onClick={deleteProfile}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
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
                  <div className="glass-inset overflow-x-auto rounded-xl scrollbar-thin">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="glass-inset text-left text-xs uppercase tracking-[0.07em] text-muted-foreground">
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
                  const canSeeGithub = scoreFieldAllowed("github");
                  const canSeeCoding = scoreFieldAllowed("coding");
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
                    documents={student.documents}
                    links={student.projectLinks}
                    canScore={canScore}
                    onChanged={async () => {
                      const res = await fetch(`/api/students/${studentId}`, { cache: "no-store" });
                      if (res.ok) setStudent((await res.json()).student);
                    }}
                  />
                </section>
              )}

              {/* Score entry panel */}
              <section className={canScore ? undefined : "hidden"}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Score entry (out of 100)
                </h3>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SCORE_FIELDS.filter((f) => scoreFieldAllowed(f.key)).map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-xs">
                          {f.label} <span className="text-muted-foreground">/ {f.cap}</span>
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={f.cap}
                          step="0.5"
                          value={String(scores[f.key])}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 0 : Math.min(f.cap, Math.max(0, Number(e.target.value)));
                            setScores((s) => ({ ...s, [f.key]: v }));
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-2xl font-bold tabular-nums">{total.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 100</span>
                      </div>
                      {student.rank !== null && (
                        <Badge variant="secondary">Rank #{student.rank}</Badge>
                      )}
                    </div>
                    <Input
                      placeholder="Coordinator note (optional)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="h-9 w-full"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => save(false)} disabled={saving || !canScore}>
                        Save as pending
                      </Button>
                      <Button className="w-full sm:w-auto" onClick={() => save(true)} disabled={saving || !canScore}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Save &amp; verify
                      </Button>
                      {savedFlash && <Badge variant="success">Saved — ranks updated</Badge>}
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
