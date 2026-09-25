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
  awaitingClaim: boolean;
}

/**
 * Coordinator panel for password resets. Approving a request (or using the
 * direct tool) deletes the student's old password — the student then signs in
 * with their registered email and ANY password they choose, which becomes
 * their permanent password. The coordinator never handles passwords.
 */
export function ResetRequestsPanel({ canManage = true }: { canManage?: boolean }) {
  const [requests, setRequests] = useState<ResetRequestDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Direct approval (no request needed)
  const [directEmail, setDirectEmail] = useState("");
  const [directBusy, setDirectBusy] = useState(false);
  const [directDone, setDirectDone] = useState<string | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);

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

  async function act(id: string, action: "approve" | "deny") {
    if (!canManage) return;
    setError(null);
    const r = requests?.find((x) => x.id === id);
    if (
      action === "approve" &&
      !window.confirm(
        `Approve password reset for ${r?.fullName ?? "this student"}?\n\nTheir old password will be cleared. They then sign in with their email + any password they choose — that becomes their permanent password.`
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch("/api/auth/forgot/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Action failed");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function directApprove() {
    if (!canManage) return;
    setDirectError(null);
    setDirectDone(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directEmail.trim())) {
      setDirectError("Enter the student's registered email");
      return;
    }
    if (
      !window.confirm(
        `Clear the password for ${directEmail.trim()}?\n\nThey then sign in with their email + any password they choose — that becomes their permanent password.`
      )
    ) {
      return;
    }
    setDirectBusy(true);
    try {
      const res = await fetch("/api/auth/forgot/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: directEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Reset failed");
      setDirectDone(body.account.fullName);
      setDirectEmail("");
    } catch (e) {
      setDirectError((e as Error).message);
    } finally {
      setDirectBusy(false);
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
            <KeyRound className="h-4 w-4 text-primary" /> Password reset approvals
          </div>
          {pending.length > 0 && <Badge variant="warning">{pending.length} pending</Badge>}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          You never touch passwords. Approving <strong>clears the student&apos;s old password</strong>{" "}
          — their next sign-in with their registered email + <em>any password they choose</em>{" "}
          stores that as their permanent password.
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Direct approval — for students who never filed a request */}
        <div className={canManage ? "rounded-xl border border-primary/30 bg-primary/5 p-3.5" : "hidden"}>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UserRoundSearch className="h-4 w-4 text-primary" /> Reset any account directly
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No request needed — for students who lost access and couldn&apos;t file one.
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
            <Button onClick={directApprove} disabled={directBusy} className="shrink-0">
              {directBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Approve reset
            </Button>
          </div>
          {directError && <p className="mt-2 text-xs text-destructive">{directError}</p>}
          {directDone && (
            <p className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
              Approved for <strong>{directDone}</strong> — they can now sign in with their email +
              any password they choose.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs text-muted-foreground">
            Requests from students
            <span className="ml-2 font-normal">(failed self-reset attempts show as “denied” for audit)</span>
          </Label>
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
                  {r.status === "RESOLVED" && (
                    <Badge variant="success">
                      {r.note?.includes("self-reset") ? "self-reset" : "approved"}
                    </Badge>
                  )}
                  {r.status === "DENIED" && <Badge variant="destructive">denied</Badge>}
                  {r.awaitingClaim && r.status === "RESOLVED" && (
                    <Badge variant="warning">awaiting claim — student signs in with any password</Badge>
                  )}
                </div>
                {r.accountName && r.accountName !== r.fullName && (
                  <p className="mt-1 text-xs text-muted-foreground">Account name: {r.accountName}</p>
                )}
                {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                {r.status === "PENDING" && canManage && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" disabled={busyId === r.id} onClick={() => act(r.id, "approve")}>
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => act(r.id, "deny")}>
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
