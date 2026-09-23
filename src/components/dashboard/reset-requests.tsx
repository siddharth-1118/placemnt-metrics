"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, KeyRound, Loader2, UserRoundSearch, X } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";

interface ResetRequestDto {
  id: string;
  fullName: string;
  email: string;
  registerNumber: string;
  status: string;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  matchesAccount: boolean;
  accountName: string | null;
}

/**
 * Coordinator panel for student password-reset requests. Resolve issues a
 * fresh temporary password — shown ONCE so the coordinator can hand it to
 * the student through a verified channel.
 */
export function ResetRequestsPanel() {
  const [requests, setRequests] = useState<ResetRequestDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; password: string } | null>(null);

  // Direct access reset (no request needed)
  const [directEmail, setDirectEmail] = useState("");
  const [directBusy, setDirectBusy] = useState(false);
  const [directResult, setDirectResult] = useState<{ name: string; password: string } | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);

  async function directReset() {
    setDirectError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directEmail.trim())) {
      setDirectError("Enter the student's registered email");
      return;
    }
    if (!window.confirm(`Issue a new password for ${directEmail.trim()}? The student should be present or reachable to receive it.`)) return;
    setDirectBusy(true);
    try {
      const res = await fetch("/api/auth/forgot/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: directEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Reset failed");
      setDirectResult({ name: body.account.fullName, password: body.tempPassword });
      setDirectEmail("");
    } catch (e) {
      setDirectError((e as Error).message);
    } finally {
      setDirectBusy(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/forgot/manage", { cache: "no-store" });
      if (res.ok) {
        const b = await res.json();
        setRequests(b.requests ?? []);
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "resolve" | "deny") {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/auth/forgot/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Action failed");
      if (action === "resolve") {
        setIssued({ id, password: body.tempPassword });
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (requests === null) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reset requests…
        </CardContent>
      </Card>
    );
  }

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Password reset requests
          </div>
          {pending.length > 0 && <Badge variant="warning">{pending.length} pending</Badge>}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {issued && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
            <p className="font-medium">Temporary password issued</p>
            <p className="mt-1 break-all font-mono text-xs">{issued.password}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Show this once to the student — they should change it after signing in. It will not
              be shown again.
            </p>
          </div>
        )}

        {/* Direct access reset — for students who never filed a request */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UserRoundSearch className="h-4 w-4 text-primary" /> Reset any account directly
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            For students who lost access and never sent a request — issue a fresh password right
            here; they&apos;ll also get a portal notification.
          </p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="student@srmist.edu.in"
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              className="flex-1"
              aria-label="Account email"
            />
            <Button onClick={directReset} disabled={directBusy} className="shrink-0">
              {directBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Issue password
            </Button>
          </div>
          {directError && <p className="mt-2 text-xs text-destructive">{directError}</p>}
          {directResult && (
            <div className="mt-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
              <p className="font-medium">New password for {directResult.name}</p>
              <p className="mt-1 break-all font-mono text-xs">{directResult.password}</p>
              <p className="mt-1 text-xs text-muted-foreground">Show it once to the student — it will not be shown again.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs text-muted-foreground">Requests from students</Label>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reset requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg border bg-accent/20 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.fullName}</span>
                  <span className="text-xs text-muted-foreground">{r.email}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{r.registerNumber}</span>
                  {!r.matchesAccount && r.status === "PENDING" && (
                    <Badge variant="destructive">
                      <AlertTriangle className="mr-1 h-3 w-3" /> details mismatch
                    </Badge>
                  )}
                  {r.status === "RESOLVED" && <Badge variant="success">resolved</Badge>}
                  {r.status === "DENIED" && <Badge variant="destructive">denied</Badge>}
                </div>
                {r.accountName && r.accountName !== r.fullName && (
                  <p className="mt-1 text-xs text-muted-foreground">Account name: {r.accountName}</p>
                )}
                {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                {r.status === "PENDING" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "resolve")}
                    >
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Issue new password
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "deny")}
                    >
                      <X className="h-3.5 w-3.5" /> Deny
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
