"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

/**
 * Instant self-reset: the student proves identity with the exact marks on
 * their submission and chooses their own new password. Nothing is sent to
 * the coordinator (unless they fail, in which case the fallback applies).
 */
export function SelfResetForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", registerNumber: "", tenthPercent: "", twelfthPercent: "", cgpa: "", newPassword: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFieldErrors((er) => ({ ...er, [field]: "" }));
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setFieldErrors({ confirm: "Passwords do not match" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/self-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          registerNumber: form.registerNumber.trim().toUpperCase(),
          tenthPercent: Number(form.tenthPercent),
          twelfthPercent: Number(form.twelfthPercent),
          cgpa: Number(form.cgpa),
          newPassword: form.newPassword,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFieldErrors(body?.fieldErrors ?? {});
        setError(body?.error ?? "Reset failed");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 py-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="text-lg font-semibold">Password updated</p>
        <p className="text-sm text-muted-foreground">
          Taking you to sign in… use your email and the new password.
        </p>
        <Button className="w-full" onClick={() => router.push("/login")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="sr-email">Registered email</Label>
        <Input id="sr-email" type="email" autoComplete="email" placeholder="you@srmist.edu.in" value={form.email} onChange={set("email")} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-reg">Register number</Label>
        <Input id="sr-reg" placeholder="RA…" value={form.registerNumber} onChange={set("registerNumber")} required />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="sr-tenth" className="text-xs">10th %</Label>
          <Input id="sr-tenth" type="number" step="0.01" min={0} max={100} placeholder="92.4" value={form.tenthPercent} onChange={set("tenthPercent")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sr-twelfth" className="text-xs">12th %</Label>
          <Input id="sr-twelfth" type="number" step="0.01" min={0} max={100} placeholder="94.8" value={form.twelfthPercent} onChange={set("twelfthPercent")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sr-cgpa" className="text-xs">CGPA</Label>
          <Input id="sr-cgpa" type="number" step="0.01" min={0} max={10} placeholder="9.12" value={form.cgpa} onChange={set("cgpa")} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-new">New password</Label>
        <Input id="sr-new" type="password" autoComplete="new-password" placeholder="Min 8 characters" value={form.newPassword} onChange={set("newPassword")} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-confirm">Confirm new password</Label>
        <Input id="sr-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required />
        {fieldErrors.confirm && <p className="text-xs text-destructive">{fieldErrors.confirm}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Verify &amp; set new password
      </Button>
    </form>
  );
}
