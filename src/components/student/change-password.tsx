"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";

/**
 * Self-service password rotation for the signed-in user — e.g. replacing the
 * temporary password a coordinator issued with one the student chooses.
 * Requires the current password, so a stolen session can't take over.
 */
export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.fieldErrors?.currentPassword ?? body?.error ?? "Could not update password");
        return;
      }
      setOkMsg(body.message ?? "Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Change password
          </div>
          <p className="text-xs text-muted-foreground">
            Using a temporary password from a coordinator? Replace it with your own here.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {okMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {okMsg}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-current" className="text-xs">Current password</Label>
              <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-next" className="text-xs">New password</Label>
              <Input id="cp-next" type="password" autoComplete="new-password" placeholder="Min 8 characters" value={next} onChange={(e) => setNext(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm" className="text-xs">Confirm new</Label>
              <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          </div>

          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
