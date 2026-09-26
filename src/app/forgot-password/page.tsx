import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogIn, ShieldCheck, UserRoundCheck, Users, GraduationCap, ChevronDown } from "lucide-react";
import { SelfResetForm } from "@/components/auth/self-reset-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export const metadata: Metadata = {
  title: "Password Recovery · SRM Placement Portal",
  description: "Instant self-verification reset or coordinator issuance for candidate account security.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      {/* Header badge */}
      <div className="mb-4 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300">
          <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
          <span>SRM Candidate Account Security</span>
        </div>
      </div>

      {/* Primary path: instant self-reset */}
      <Card className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-2 shadow-2xl backdrop-blur-2xl animate-rise">
        <div className="rounded-2xl border border-white/10 bg-[#0d1222]/90 p-6">
          <div className="mb-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
              <UserRoundCheck className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-lg font-bold tracking-tight text-white">
              Instant Self-Verification Reset
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Verify your identity using your exact submitted marks (10th %, 12th %, or CGPA).
              Instant access without waiting.
            </p>
          </div>

          <SelfResetForm />
        </div>
      </Card>

      {/* Fallback: coordinator-issued reset */}
      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
            <Users className="h-4 w-4" />
          </span>
          <span className="flex-1">
            Cannot recall exact submitted marks?
            <span className="block font-normal text-slate-400">
              Request a manual reset from your placement coordinator
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <Card className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1222]/95 p-4">
          <CardContent className="p-2">
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </details>

      <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-200">
          <ShieldCheck className="h-4 w-4 text-indigo-400" /> Tamper-Proof Cryptographic Verification
        </p>
        Submitted percentages are audited against encrypted records. All attempts are rate-limited
        and visible in the coordinator security dashboard.
      </div>

      <p className="mt-5 text-center text-xs text-slate-400">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          <LogIn className="h-3 w-3" /> Back to sign in
        </Link>
      </p>

      <span className="hidden">
        <KeyRound />
      </span>
    </div>
  );
}
