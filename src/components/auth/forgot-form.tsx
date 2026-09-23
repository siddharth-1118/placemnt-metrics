"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";

/**
 * Shared forgot-password request form — used on the dedicated
 * /forgot-password portal and embedded in the login page. After sending,
 * the student sees confirmation and is told to collect the new password
 * from a coordinator (no self-service password setting).
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, registerNumber }),
      });
      const body = await res.json();
      if (!res.ok) {
        const fe = body?.fieldErrors;
        setError(fe ? (Object.values(fe)[0] as string) : body?.error ?? "Could not send request");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 py-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <p className="text-lg font-semibold">Request sent</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Your coordinator has been notified. They will verify your identity and issue a new
          password — collect it from them (in person or via college email), then sign in.
        </p>
        <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onRequestReset} className="space-y-4" noValidate>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="fp-name">Full name</Label>
        <Input
          id="fp-name"
          placeholder="As submitted in your profile"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-email">Email</Label>
        <Input
          id="fp-email"
          type="email"
          autoComplete="email"
          placeholder="you@srmist.edu.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-reg">Register number</Label>
        <Input
          id="fp-reg"
          placeholder="RA…"
          value={registerNumber}
          onChange={(e) => setRegisterNumber(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Send reset request
      </Button>
    </form>
  );
}
