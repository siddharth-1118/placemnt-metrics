"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check, KeyRound, Loader2, Mail, Search, ShieldAlert, ShieldOff, UserPlus, X,
} from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { SCORE_SCOPE_KEYS, SCORE_SCOPE_LABELS, type ScoreScope } from "@/lib/scopes";

interface CoordinatorDto {
  id: string;
  email: string;
  fullName: string;
  registerNumber: string;
  isSuperAdmin: boolean;
  canViewSubmissions: boolean;
  canScore: boolean;
  permissionScopes: ScoreScope[];
  hasPassword: boolean;
  awaitingClaim: boolean;
  createdAt: string;
}

interface Candidate {
  id: string;
  email: string;
  fullName: string;
  registerNumber: string;
}

/**
 * Super-admin panel: assign coordinators from students who already submitted
 * (they keep their own email + password — no initial passwords), and control
 * what each one can see and do —
 *   • View submissions — open the leaderboard and inspect student profiles.
 *   • Score & verify   — enter marks and verify documents/links (implies view).
 *   • Sections         — restrict them to specific rubric sections (e.g. only
 *                        GitHub, or only hackathon documents under Extras).
 *                        No sections selected = full access.
 * Revoking returns the account to a normal student; their submission is kept.
 */
export function CoordinatorsAdmin() {
  const [rows, setRows] = useState<CoordinatorDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Assignment form
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [newScopes, setNewScopes] = useState<ScoreScope[]>([]);
  const [newCanScore, setNewCanScore] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/coordinators", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to load coordinators");
      setRows(body.coordinators);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced candidate search
  useEffect(() => {
    if (!query.trim()) {
      setCandidates(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/coordinators?search=${encodeURIComponent(query.trim())}`,
          { cache: "no-store" }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? "Search failed");
        setCandidates(body.candidates);
      } catch (e) {
        setError((e as Error).message);
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function assign() {
    if (!picked) return;
    setError(null);
    setAssignMsg(null);
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/coordinators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: picked.email,
          permissionScopes: newScopes,
          canScore: newScopes.length > 0 ? undefined : newCanScore,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not assign the coordinator");
      setAssignMsg(`${body.coordinator.fullName} can now sign in as a coordinator with their existing password.`);
      setPicked(null);
      setQuery("");
      setCandidates(null);
      setNewScopes([]);
      setNewCanScore(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  }

  async function setPerm(
    c: CoordinatorDto,
    patch: { canViewSubmissions?: boolean; canScore?: boolean; permissionScopes?: ScoreScope[] }
  ) {
    setError(null);
    // Optimistic update; the server normalizes implications (score ⇒ view).
    setRows((rs) => rs?.map((r) => (r.id === c.id ? { ...r, ...patch } : r)) ?? rs);
    try {
      const res = await fetch("/api/admin/coordinators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, ...patch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not update permissions");
      setRows((rs) => rs?.map((r) => (r.id === c.id ? body.coordinator : r)) ?? rs);
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  /** Toggle one section scope for a coordinator. */
  function toggleScope(c: CoordinatorDto, scope: ScoreScope) {
    const has = c.permissionScopes.includes(scope);
    const next = has
      ? c.permissionScopes.filter((s) => s !== scope)
      : [...c.permissionScopes, scope];
    setPerm(c, { permissionScopes: next });
  }

  async function revoke(c: CoordinatorDto) {
    if (!window.confirm(`Revoke coordinator access for ${c.fullName} (${c.email})?\n\nThey return to a normal student account — their submission and password are kept.`)) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/coordinators", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not revoke access");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function Toggle({
    on, label, hint, onClick, disabled,
  }: { on: boolean; label: string; hint: string; onClick: () => void; disabled?: boolean }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={hint}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-colors disabled:opacity-50 ${
          on
            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
            : "bg-white/5 text-muted-foreground ring-white/15 hover:bg-white/10"
        }`}
      >
        {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {label}
      </button>
    );
  }

  function ScopeChips({
    scopes, onToggle, disabled,
  }: { scopes: ScoreScope[]; onToggle: (s: ScoreScope) => void; disabled?: boolean }) {
    const full = scopes.length === 0;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {full ? (
          <span
            title="No section restrictions — this coordinator can view and score every section"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/30"
          >
            <Check className="h-3 w-3" /> All sections (full access)
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Sections:</span>
        )}
        {SCORE_SCOPE_KEYS.map((s) => {
          const on = scopes.includes(s);
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(s)}
              title={`${SCORE_SCOPE_LABELS[s]} — click to ${on ? "remove" : "grant"}`}
              className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset transition-colors disabled:opacity-50 ${
                on
                  ? "bg-emerald-500/15 font-semibold text-emerald-300 ring-emerald-400/30"
                  : "bg-white/5 text-muted-foreground ring-white/15 hover:bg-white/10"
              }`}
            >
              {SCORE_SCOPE_LABELS[s]}
            </button>
          );
        })}
      </div>
    );
  }

  if (rows === null) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading coordinators…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 text-primary" /> Coordinator management
          <Badge variant="warning">super admin</Badge>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Assign coordinators from students who already submitted — they sign in with the
          email and password they registered with (no passwords are created or shared).
          <strong className="text-foreground/80"> View submissions</strong> opens the leaderboard;
          <strong className="text-foreground/80"> Score &amp; verify</strong> also allows marks and
          document review; the <strong className="text-foreground/80">section chips</strong> restrict
          a coordinator to specific rubric sections (e.g. only GitHub, or only hackathons under
          Extras). Leaving every section unselected means full access.
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Assign coordinator */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UserPlus className="h-4 w-4 text-primary" /> Assign a coordinator
          </p>

          {!picked ? (
            <div className="mt-2.5">
              <Label className="text-xs">Find a student by email, name or register number</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Type at least 2 characters…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {searching && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                </p>
              )}
              {candidates !== null && !searching && (
                <ul className="mt-1.5 space-y-1">
                  {candidates.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(s);
                          setQuery("");
                          setCandidates(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span className="font-medium">{s.fullName}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{s.registerNumber}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {s.email}
                        </span>
                      </button>
                    </li>
                  ))}
                  {candidates.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      No matching students — only students who submitted an application can be assigned.
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-2.5 space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{picked.fullName}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{picked.registerNumber}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> {picked.email}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7"
                  onClick={() => setPicked(null)}
                >
                  <X className="h-3.5 w-3.5" /> Change
                </Button>
              </div>

              {/* Section access for the new coordinator */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Sections they can view &amp; score{" "}
                  <span className="font-normal text-muted-foreground">
                    (none selected = full access)
                  </span>
                </Label>
                <ScopeChips
                  scopes={newScopes}
                  onToggle={(s) =>
                    setNewScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
                  }
                />
                {newScopes.length === 0 && (
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={newCanScore}
                      onChange={(e) => setNewCanScore(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    />
                    Also allow scoring &amp; verification of every section (full scorer)
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={assign} disabled={assigning}>
                  {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Assign as coordinator
                </Button>
                {assignMsg && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <KeyRound className="h-3.5 w-3.5" /> {assignMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coordinator list */}
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id} className="rounded-lg border bg-accent/20 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.fullName}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> {c.email}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{c.registerNumber}</span>
                {c.isSuperAdmin && <Badge variant="warning">super admin</Badge>}
                <div className="ml-auto flex items-center gap-1.5">
                  <Toggle
                    on={c.canViewSubmissions}
                    label="View submissions"
                    hint="May open the evaluation dashboard and inspect student submissions"
                    disabled={c.isSuperAdmin}
                    onClick={() => setPerm(c, { canViewSubmissions: !c.canViewSubmissions })}
                  />
                  <Toggle
                    on={c.canScore}
                    label="Score & verify"
                    hint="May enter scores and verify documents & links (implies view)"
                    disabled={c.isSuperAdmin}
                    onClick={() => setPerm(c, { canScore: !c.canScore })}
                  />
                  {!c.isSuperAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Revoke coordinator access — the account returns to a normal student"
                      onClick={() => revoke(c)}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {!c.isSuperAdmin && (
                <div className="mt-2">
                  <ScopeChips
                    scopes={c.permissionScopes}
                    disabled={!c.canViewSubmissions}
                    onToggle={(s) => toggleScope(c, s)}
                  />
                </div>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-muted-foreground">No coordinator accounts yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
