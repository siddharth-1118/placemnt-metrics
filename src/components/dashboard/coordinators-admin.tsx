"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check, KeyRound, Loader2, Mail, ShieldAlert, Trash2, UserPlus, X,
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

/**
 * Super-admin panel: create coordinator accounts by email and control what
 * each one can see and do —
 *   • View submissions — open the leaderboard and inspect student profiles.
 *   • Score & verify   — enter marks and verify documents/links (implies view).
 *   • Sections         — restrict them to specific rubric sections (e.g. only
 *                        GitHub, or only hackathon/extras documents). No
 *                        sections selected = full access to everything.
 * Nobody else can see this panel; the API enforces it too.
 */
export function CoordinatorsAdmin() {
  const [rows, setRows] = useState<CoordinatorDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [newScopes, setNewScopes] = useState<ScoreScope[]>([]);
  const [newCanScore, setNewCanScore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);

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

  async function create() {
    setError(null);
    setCreatedMsg(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/coordinators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          registerNumber: regNo.trim(),
          password,
          permissionScopes: newScopes,
          canScore: newScopes.length > 0 ? undefined : newCanScore,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not create the coordinator");
      setCreatedMsg(`${body.coordinator.fullName} (${body.coordinator.email}) can now sign in.`);
      setEmail(""); setFullName(""); setRegNo(""); setPassword("");
      setNewScopes([]); setNewCanScore(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
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
    // Gaining the first scope also grants Score & verify (server does this too);
    // clearing the last scope returns the coordinator to full access.
    setPerm(c, { permissionScopes: next });
  }

  async function remove(c: CoordinatorDto) {
    if (!window.confirm(`Delete coordinator account ${c.fullName} (${c.email})?\n\nThey will no longer be able to sign in. Student submissions are not affected.`)) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/coordinators", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not delete the coordinator");
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
          Create coordinator accounts by email and choose exactly what each one can see and do.
          <strong className="text-foreground/80"> View submissions</strong> opens the leaderboard and
          student profiles; <strong className="text-foreground/80">Score &amp; verify</strong> also
          allows entering marks and reviewing documents; the{" "}
          <strong className="text-foreground/80">section chips</strong> restrict a coordinator to
          specific rubric sections (e.g. only GitHub, or only hackathons &amp; certificates under
          Extras). Leaving every section unselected means full access.
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Create coordinator */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UserPlus className="h-4 w-4 text-primary" /> Add a coordinator
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Doe" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane.doe@srmist.edu.in" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Register no. / staff ID</Label>
              <Input value={regNo} onChange={(e) => setRegNo(e.target.value.toUpperCase())} placeholder="COORD-FACULTY-02" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Initial password (≥ 8 chars)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a temporary password" />
            </div>
          </div>

          {/* Section access for the new coordinator */}
          <div className="mt-3 space-y-1.5">
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

          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" onClick={create} disabled={creating || !email.trim() || !fullName.trim() || !regNo.trim() || password.length < 8}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Create coordinator
            </Button>
            {createdMsg && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <KeyRound className="h-3.5 w-3.5" /> {createdMsg}
              </span>
            )}
          </div>
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
                {c.awaitingClaim && <Badge variant="secondary">must sign in to claim password</Badge>}
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
                      title="Delete coordinator account"
                      onClick={() => remove(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
              {!c.hasPassword && !c.awaitingClaim && (
                <p className="mt-1 text-xs text-amber-600">No password set yet — they cannot sign in.</p>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-muted-foreground">No coordinator accounts yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
