"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Code2, Github, Loader2, UserRound } from "lucide-react";
import { Button, Input, Label, Badge, Card, CardContent } from "@/components/ui";
import type { StudentDto } from "@/lib/types";

type FieldErrors = Record<string, string>;

const initialForm = {
  registerNumber: "",
  fullName: "",
  email: "",
  facultyAdvisor: "",
  tenthPercent: "",
  twelfthPercent: "",
  cgpa: "",
  githubUrl: "",
  leetcodeUrl: "",
  password: "",
  confirmPassword: "",
};

export function SubmitForm({ locked = false }: { locked?: boolean }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ student: StudentDto; message: string } | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ fullName: string; email: string; role: string; evaluatorAssigned: boolean } | null>(null);

  // Prefill identity for signed-in users (each email has its own portal —
  // coordinators submitting as candidates land here with their email locked).
  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((b) => {
        if (b?.user) {
          setSessionInfo({ fullName: b.user.fullName, email: b.user.email, role: b.user.role, evaluatorAssigned: b.user.evaluatorAssigned });
          setForm((f) => ({ ...f, fullName: f.fullName || b.user.fullName, email: b.user.email }));
        }
      })
      .catch(() => undefined);
  }, []);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((er) => ({ ...er, [field]: "" }));
    };
  }

  function validate(): FieldErrors {
    const er: FieldErrors = {};
    if (!/^[A-Za-z0-9-]{4,20}$/.test(form.registerNumber.trim()))
      er.registerNumber = "4–20 letters/digits/hyphens (e.g. RA2211003010001)";
    if (form.fullName.trim().length < 3) er.fullName = "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = "Enter a valid email";
    const tenth = Number(form.tenthPercent);
    const twelfth = Number(form.twelfthPercent);
    const cgpa = Number(form.cgpa);
    if (form.tenthPercent === "" || Number.isNaN(tenth) || tenth < 0 || tenth > 100)
      er.tenthPercent = "0–100";
    if (form.twelfthPercent === "" || Number.isNaN(twelfth) || twelfth < 0 || twelfth > 100)
      er.twelfthPercent = "0–100";
    if (form.cgpa === "" || Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) er.cgpa = "0–10";
    if (form.githubUrl && !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9-]{1,39}\/?$/.test(form.githubUrl.trim()))
      er.githubUrl = "Use https://github.com/<username>";
    if (form.leetcodeUrl && !/^https?:\/\/(www\.)?leetcode\.com\/(u\/)?[A-Za-z0-9_-]{1,39}\/?$/.test(form.leetcodeUrl.trim()))
      er.leetcodeUrl = "Use https://leetcode.com/u/<username>";
    if (form.password && form.password.length < 8) er.password = "At least 8 characters";
    if (form.password !== form.confirmPassword) er.confirmPassword = "Passwords do not match";
    return er;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) {
      setTopError("Submissions are closed by the coordinator — your changes cannot be saved right now.");
      return;
    }
    setTopError(null);
    const er = validate();
    setErrors(er);
    if (Object.values(er).some(Boolean)) return;      setSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerNumber: form.registerNumber.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          facultyAdvisor: form.facultyAdvisor.trim() || undefined,
          tenthPercent: Number(form.tenthPercent),
          twelfthPercent: Number(form.twelfthPercent),
          cgpa: Number(form.cgpa),
          githubUrl: form.githubUrl.trim() || undefined,
          leetcodeUrl: form.leetcodeUrl.trim() || undefined,
          password: form.password || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.fieldErrors) setErrors(body.fieldErrors);
        setTopError(body?.error ?? "Submission failed");
        return;
      }
      setResult({ student: body.student, message: body.message });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setTopError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const gh = result.student.scrapes.find((s) => s.platform === "GITHUB");
    const lc = result.student.scrapes.find((s) => s.platform === "LEETCODE");
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Submission received, {result.student.fullName.split(" ")[0]}!</h2>
              <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Scrape jobs:</span>
                {gh ? (
                  <Badge variant={gh.status === "FAILED" ? "destructive" : gh.status === "SUCCESS" ? "success" : "warning"}>
                    GitHub · {gh.status.toLowerCase()}
                  </Badge>
                ) : (
                  <Badge variant="secondary">GitHub · not provided</Badge>
                )}
                {lc ? (
                  <Badge variant={lc.status === "FAILED" ? "destructive" : lc.status === "SUCCESS" ? "success" : "warning"}>
                    LeetCode · {lc.status.toLowerCase()}
                  </Badge>
                ) : (
                  <Badge variant="secondary">LeetCode · not provided</Badge>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Coordinators will review your submission and scraped profiles on the dashboard. You can
                resubmit this form with the same register number to update your details.
              </p>
              <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setResult(null); setForm(initialForm); }}>
                    Submit another
                  </Button>
                <Link href="/my-submission">
                  <Button size="sm" variant="ghost">Go to my portal — upload documents →</Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {topError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {topError}
        </div>
      )}

      {sessionInfo && (
        <div className="glass flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm">
          <UserRound className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Signed in as <strong>{sessionInfo.fullName}</strong> ({sessionInfo.email})
            {sessionInfo.role === "COORDINATOR" && (
              <> — coordinator account, submitting a <strong>placement profile</strong>. Your login and dashboard access stay unchanged.</>
            )}
            . This submission is linked to your email’s own portal.
          </span>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Academic details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Register Number *" error={errors.registerNumber}>
            <Input placeholder="RA2211003010001" value={form.registerNumber} onChange={set("registerNumber")} />
          </Field>
          <Field label="Full Name *" error={errors.fullName}>
            <Input placeholder="Arjun Kumar" value={form.fullName} onChange={set("fullName")} />
          </Field>
          <Field label="Email *" error={errors.email}>
            <Input type="email" placeholder="ak1234@srmist.edu.in" value={form.email} onChange={set("email")} readOnly={!!sessionInfo} />
          </Field>
          <Field label="Faculty Advisor" error={errors.facultyAdvisor}>
            <Input placeholder="Dr. Priya Sharma" value={form.facultyAdvisor} onChange={set("facultyAdvisor")} />
          </Field>
          <Field label="10th % *" error={errors.tenthPercent}>
            <Input type="number" step="0.01" min={0} max={100} placeholder="92.4" value={form.tenthPercent} onChange={set("tenthPercent")} />
          </Field>
          <Field label="12th % *" error={errors.twelfthPercent}>
            <Input type="number" step="0.01" min={0} max={100} placeholder="94.8" value={form.twelfthPercent} onChange={set("twelfthPercent")} />
          </Field>
          <Field label="CGPA (out of 10) *" error={errors.cgpa}>
            <Input type="number" step="0.01" min={0} max={10} placeholder="9.12" value={form.cgpa} onChange={set("cgpa")} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coding profiles</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub Profile Link" error={errors.githubUrl} hint="Scraped automatically: repos, stars, contributions">
            <div className="relative">
              <Github className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="https://github.com/username" value={form.githubUrl} onChange={set("githubUrl")} />
            </div>
          </Field>
          <Field label="LeetCode Profile Link" error={errors.leetcodeUrl} hint="Scraped automatically: solved counts, contest rating">
            <div className="relative">
              <Code2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="https://leetcode.com/u/username" value={form.leetcodeUrl} onChange={set("leetcodeUrl")} />
            </div>
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Documents &amp; project links — after you submit
        </h2>
        <div className="glass rounded-xl px-4 py-3.5 text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1">
            <li><strong className="text-foreground">Upload documents</strong> (PDF/JPG, ≤10 MB): 10th &amp; 12th marksheets, CGPA marksheet, internship proof, skill &amp; global certifications, competitions/hackathons, in-house projects, professional memberships, SHL talent discovery program.</li>
            <li><strong className="text-foreground">Add project links</strong> — unlimited: projects, full-stack projects, deployed in-house projects (links can replace documents for in-house projects &amp; memberships).</li>
            <li>Coordinators verify every document and link individually on their dashboard.</li>
          </ul>
          <p className="mt-2">
            Right after submitting, you&apos;ll land on your own portal where you can upload and manage all of this.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Account (optional)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            error={errors.password}
            hint="Set one to sign in and view your submission later"
          >
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={set("password")}
            />
          </Field>
          <Field label="Confirm password" error={errors.confirmPassword}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:gap-3">
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting || locked}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : locked ? (
            "Submissions closed"
          ) : (
            "Submit for verification"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Submitting triggers automatic scraping of your GitHub &amp; LeetCode profiles.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
