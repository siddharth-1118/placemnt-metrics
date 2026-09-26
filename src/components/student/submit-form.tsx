"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserRound,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { Button, Input, Label, Badge } from "@/components/ui";
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

export function SubmitForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ student: StudentDto; message: string } | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    fullName: string;
    email: string;
    role: string;
    evaluatorAssigned: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((b) => {
        if (b?.user) {
          setSessionInfo({
            fullName: b.user.fullName,
            email: b.user.email,
            role: b.user.role,
            evaluatorAssigned: b.user.evaluatorAssigned,
          });
          setForm((f) => ({
            ...f,
            fullName: f.fullName || b.user.fullName,
            email: b.user.email,
          }));
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

  // Live estimated academic marks calculation according to official SRM rubric (out of 10.0)
  const estAcademicScore = useMemo(() => {
    const tenth = Number(form.tenthPercent);
    const twelfth = Number(form.twelfthPercent);
    const cgpa = Number(form.cgpa);

    let score = 0;
    if (!isNaN(tenth) && tenth >= 0 && tenth <= 100) {
      if (tenth >= 96) score += 2.5;
      else if (tenth >= 91) score += 2.0;
      else if (tenth >= 86) score += 1.5;
      else if (tenth >= 75) score += 1.0;
      else score += 0.5;
    }

    if (!isNaN(twelfth) && twelfth >= 0 && twelfth <= 100) {
      if (twelfth >= 96) score += 2.5;
      else if (twelfth >= 91) score += 2.0;
      else if (twelfth >= 86) score += 1.5;
      else if (twelfth >= 75) score += 1.0;
      else score += 0.5;
    }

    if (!isNaN(cgpa) && cgpa >= 0 && cgpa <= 10) {
      if (cgpa > 9.5) score += 5.0;
      else if (cgpa >= 9.1) score += 4.0;
      else if (cgpa >= 8.6) score += 3.0;
      else if (cgpa >= 7.5) score += 2.0;
      else score += 1.0;
    }

    return Math.min(10.0, Math.round(score * 10) / 10);
  }, [form.tenthPercent, form.twelfthPercent, form.cgpa]);

  function validate(): boolean {
    const errs: FieldErrors = {};
    if (!form.registerNumber.trim()) errs.registerNumber = "Register number is required";
    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = "Enter a valid email address";

    const tenth = Number(form.tenthPercent);
    if (!form.tenthPercent || isNaN(tenth) || tenth < 0 || tenth > 100)
      errs.tenthPercent = "Enter a valid 10th percentage (0–100)";

    const twelfth = Number(form.twelfthPercent);
    if (!form.twelfthPercent || isNaN(twelfth) || twelfth < 0 || twelfth > 100)
      errs.twelfthPercent = "Enter a valid 12th percentage (0–100)";

    const cgpa = Number(form.cgpa);
    if (!form.cgpa || isNaN(cgpa) || cgpa < 0 || cgpa > 10)
      errs.cgpa = "Enter a valid CGPA (0.00–10.00)";

    if (form.password) {
      if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
      if (form.password !== form.confirmPassword)
        errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    if (!validate()) {
      setTopError("Please fix the highlighted fields below.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerNumber: form.registerNumber.trim().toUpperCase(),
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
        setTopError(body?.error ?? "Registration submission failed.");
        return;
      }

      setResult({ student: body.student, message: body.message });
    } catch {
      setTopError("Network connection error. Could not submit profile.");
    } finally {
      setSubmitting(false);
    }
  }

  // Success view
  if (result) {
    return (
      <div className="rounded-md border border-[#b8ddc4] bg-white p-6 text-center shadow-sm dark:border-[#215736] dark:bg-[#1b222c] sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf4ed] text-[#165b33] dark:bg-[#133822] dark:text-[#78d69f]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-[#1c2024] dark:text-white">
          Registration Successful
        </h2>
        <p className="mt-1 text-xs text-[#5c6470] dark:text-[#94a3b8]">
          Your student profile has been submitted and your placement matrix score has been initialized.
        </p>

        <div className="mt-5 w-full rounded border border-[#e2ded5] bg-[#faf8f5] p-3.5 text-left text-xs dark:border-[#262f3c] dark:bg-[#161c24]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <span className="text-[#5c6470] dark:text-[#94a3b8]">Register Number</span>
              <p className="font-mono font-bold text-[#1c2024] dark:text-white">{result.student.registerNumber}</p>
            </div>
            <div>
              <span className="text-[#5c6470] dark:text-[#94a3b8]">Degree CGPA</span>
              <p className="font-bold text-[#1c2024] dark:text-white">{result.student.cgpa.toFixed(2)} / 10</p>
            </div>
            <div>
              <span className="text-[#5c6470] dark:text-[#94a3b8]">Academic Score</span>
              <p className="font-bold text-[#165b33] dark:text-[#78d69f]">
                {result.student.scores.academic.toFixed(1)} / 10.0 M
              </p>
            </div>
            <div>
              <span className="text-[#5c6470] dark:text-[#94a3b8]">Status</span>
              <p className="font-bold text-[#92540d] dark:text-[#f3b55c]">{result.student.status}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/my-submission">
            <Button className="h-8 gap-1.5 bg-[#165b33] text-xs font-semibold text-white hover:bg-[#124929]">
              <span>Go to Student Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResult(null);
              setForm(initialForm);
            }}
            className="h-8 text-xs"
          >
            Register Another Student
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left" noValidate>
      {topError && (
        <div className="flex items-center gap-2 rounded border border-[#f8c4c4] bg-[#fdeded] p-3 text-xs text-[#a82424] dark:border-[#5e2626] dark:bg-[#3d1818] dark:text-[#f38d8d]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      {sessionInfo && (
        <div className="flex items-center gap-2 rounded border border-[#e2ded5] bg-[#faf8f5] p-2.5 text-xs text-[#1c2024] dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#f0ede6]">
          <UserRound className="h-4 w-4 shrink-0 text-[#165b33] dark:text-[#78d69f]" />
          <span>
            Signed in as <strong>{sessionInfo.fullName}</strong> ({sessionInfo.email}).
          </span>
        </div>
      )}

      {/* 1. Student Identity */}
      <div className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
          1. Student Identity
        </h2>
        <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
          Academic identity records as enrolled with the university.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Register Number *" error={errors.registerNumber}>
            <Input
              placeholder="e.g. RA2211003010001"
              value={form.registerNumber}
              onChange={set("registerNumber")}
              className="font-mono uppercase text-xs h-8"
            />
          </Field>

          <Field label="Full Name *" error={errors.fullName}>
            <Input
              placeholder="e.g. Arjun Kumar"
              value={form.fullName}
              onChange={set("fullName")}
              className="text-xs h-8"
            />
          </Field>

          <Field label="SRM Student Email *" error={errors.email}>
            <Input
              type="email"
              placeholder="you@srmist.edu.in"
              value={form.email}
              onChange={set("email")}
              readOnly={!!sessionInfo}
              className={`text-xs h-8 ${sessionInfo ? "opacity-75 cursor-not-allowed" : ""}`}
            />
          </Field>

          <Field label="Faculty Advisor (Optional)" error={errors.facultyAdvisor}>
            <Input
              placeholder="e.g. Dr. Priya Sharma"
              value={form.facultyAdvisor}
              onChange={set("facultyAdvisor")}
              className="text-xs h-8"
            />
          </Field>
        </div>
      </div>

      {/* 2. Academic Scores */}
      <div className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2ded5] pb-2.5 dark:border-[#262f3c]">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
              2. Academic Records
            </h2>
            <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
              Evaluated strictly on the 10-mark official placement academic standard.
            </p>
          </div>
          <span className="rounded border border-[#b8ddc4] bg-[#eaf4ed] px-2 py-0.5 text-xs font-semibold text-[#165b33] dark:border-[#215736] dark:bg-[#133822] dark:text-[#78d69f]">
            Estimated Academic Score: {estAcademicScore} / 10.0 M
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field
            label="10th Percentage (%) *"
            error={errors.tenthPercent}
            hint="96–100: 2.5 | 91–95: 2.0 | 86–90: 1.5 | 75–85: 1.0"
          >
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              placeholder="e.g. 95.0"
              value={form.tenthPercent}
              onChange={set("tenthPercent")}
              className="text-xs h-8"
            />
          </Field>

          <Field
            label="12th Percentage (%) *"
            error={errors.twelfthPercent}
            hint="96–100: 2.5 | 91–95: 2.0 | 86–90: 1.5 | 75–85: 1.0"
          >
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              placeholder="e.g. 94.0"
              value={form.twelfthPercent}
              onChange={set("twelfthPercent")}
              className="text-xs h-8"
            />
          </Field>

          <Field
            label="Current CGPA *"
            error={errors.cgpa}
            hint=">9.5: 5.0 | 9.1–9.5: 4.0 | 8.6–9.0: 3.0 | 7.5–8.5: 2.0"
          >
            <Input
              type="number"
              step="0.01"
              min={0}
              max={10}
              placeholder="e.g. 9.20"
              value={form.cgpa}
              onChange={set("cgpa")}
              className="text-xs h-8"
            />
          </Field>
        </div>
      </div>

      {/* 3. Coding Profiles */}
      <div className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
          3. Coding Footprint (Optional)
        </h2>
        <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
          Public handles will be audited for repository commits and problem solving.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="GitHub Profile URL"
            error={errors.githubUrl}
            hint="e.g. https://github.com/username"
          >
            <Input
              placeholder="https://github.com/your-username"
              value={form.githubUrl}
              onChange={set("githubUrl")}
              className="font-mono text-xs h-8"
            />
          </Field>

          <Field
            label="LeetCode Profile URL"
            error={errors.leetcodeUrl}
            hint="e.g. https://leetcode.com/u/username"
          >
            <Input
              placeholder="https://leetcode.com/u/your-username"
              value={form.leetcodeUrl}
              onChange={set("leetcodeUrl")}
              className="font-mono text-xs h-8"
            />
          </Field>
        </div>
      </div>

      {/* 4. Password */}
      <div className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
          4. Portal Security &amp; Password
        </h2>
        <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
          Create a password to access your dashboard and upload certificates.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Password" error={errors.password} hint="At least 8 characters">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.password}
                onChange={set("password")}
                className="pr-9 text-xs h-8"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#88909c] hover:text-[#1c2024]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm Password" error={errors.confirmPassword} hint="Re-enter your password">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              className="text-xs h-8"
            />
          </Field>
        </div>
      </div>

      {/* Submit Button & Login Link */}
      <div className="space-y-3 rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#165b33] text-white hover:bg-[#124929] h-9 text-xs font-semibold shadow-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Submitting &amp; Calculating Matrix Score…</span>
            </>
          ) : (
            <span>Submit Profile &amp; Calculate Placement Score</span>
          )}
        </Button>

        <div className="text-center text-xs text-[#5c6470] dark:text-[#94a3b8]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#165b33] hover:underline dark:text-[#78d69f]">
            Login
          </Link>
        </div>
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
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-[#1c2024] dark:text-[#f0ede6]">{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-[#a82424] dark:text-[#f38d8d]">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-[#5c6470] dark:text-[#94a3b8]">{hint}</p>
      ) : null}
    </div>
  );
}
