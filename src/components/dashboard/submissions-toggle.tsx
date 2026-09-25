"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

/**
 * Coordinator kill-switch for the whole portal: when closed, students can no
 * longer submit or update profiles, upload documents, or add project links.
 * Evaluators are exempt so data can still be corrected during review.
 */
export function SubmissionsToggle() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b?.error ?? `Could not load setting (HTTP ${r.status})`);
        setLocked(Boolean(b.submissionsLocked));
      })
      .catch((e) => {
        setLocked(false);
        setError((e as Error).message || "Could not reach the server — is it running?");
      });
  }, []);

  async function toggle() {
    if (locked === null) return;
    const next = !locked;
    const verb = next ? "Close" : "Reopen";
    if (
      !window.confirm(
        next
          ? "Close submissions? Students will no longer be able to submit profiles, upload documents or add links until you reopen."
          : "Reopen submissions? Students can submit and edit again."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      try {
        res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: next }),
        });
      } catch {
        // fetch only rejects on network-level failures: server down, CORS, etc.
        throw new Error("Could not reach the server — it may have stopped. Refresh the page or restart the dev server.");
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Could not change the setting (HTTP ${res.status})`);
      setLocked(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={locked ? "border-amber-500/40" : undefined}>
      <CardContent className="flex flex-wrap items-center gap-3 pt-5">
        <span className="glass-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          {locked === null ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin text-muted-foreground" />
          ) : locked ? (
            <Lock className="h-4.5 w-4.5 text-amber-500" />
          ) : (
            <LockOpen className="h-4.5 w-4.5 text-primary" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {locked ? "Submissions are closed" : "Submissions are open"}
          </p>
          <p className="text-xs text-muted-foreground">
            {locked
              ? "Students cannot submit, edit profiles, upload documents or add links until reopened."
              : "Students can submit profiles and edit their documents and links freely."}
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Button
          variant={locked ? "default" : "outline"}
          onClick={toggle}
          disabled={busy || locked === null}
          className={locked ? "bg-amber-600 hover:bg-amber-600/90" : undefined}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {locked === null ? "…" : locked ? "Reopen submissions" : "Close submissions"}
        </Button>
      </CardContent>
    </Card>
  );
}
