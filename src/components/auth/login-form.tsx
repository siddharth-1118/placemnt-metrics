"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2, LogIn } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";

type Mode = "login" | "forgot";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Forgot-password request fields
  const [fpName, setFpName] = useState("");
  const [fpEmail, setFpEmail] = useState("");
  const [fpReg, setFpReg] = useState("");
  const [fpSent, setFpSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Sign in failed");
        return;
      }
      // Coordinators assigned to evaluation → dashboard; everyone else → own submission.
      const u = body.user;
      router.push(u.role === "COORDINATOR" && u.evaluatorAssigned ? "/coordinator/dashboard" : "/my-submission");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fpName, email: fpEmail, registerNumber: fpReg }),
      });
      const body = await res.json();
      if (!res.ok) {
        const fe = body?.fieldErrors;
        setError(fe ? Object.values(fe)[0] as string : body?.error ?? "Could not send request");
        return;
      }
      setFpSent(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <Card>
        <CardContent className="pt-5">
          {fpSent ? (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium">Request sent</p>
              <p className="text-sm text-muted-foreground">
                Your coordinator will verify your details and issue a new password — collect it
                from them, then sign in here.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setMode("login"); setFpSent(false); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={onRequestReset} className="space-y-4" noValidate>
              <div>
                <p className="font-medium">Reset your password</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Send a request to the placement coordinators. They verify your identity and hand
                  you a new password in person or via college email.
                </p>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="fp-name">Full name</Label>
                <Input id="fp-name" placeholder="As submitted in your profile" value={fpName} onChange={(e) => setFpName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" placeholder="you@srmist.edu.in" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-reg">Register number</Label>
                <Input id="fp-reg" placeholder="RA…" value={fpReg} onChange={(e) => setFpReg(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Send request
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => { setMode("login"); setError(null); }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@srmist.edu.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in
      </Button>
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => { setMode("forgot"); setError(null); }}
      >
        Forgot password? Ask a coordinator to reset it
      </button>
    </form>
  );
}
