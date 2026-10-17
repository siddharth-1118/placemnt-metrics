import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogIn, ShieldCheck, Users } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";
import { Card, CardContent } from "@/components/ui";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Password Recovery · SRM Placement Portal",
  description: "Request a coordinator-issued password reset for your candidate account.",
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

      {/* Single path: coordinator-issued reset (instant self-reset removed) */}
      <Card className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-2 shadow-2xl backdrop-blur-2xl animate-rise">
        <div className="rounded-2xl border border-white/10 bg-[#0d1222]/90 p-6">
          <div className="mb-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-lg font-bold tracking-tight text-white">
              Request a password reset
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Your placement coordinator verifies your identity and issues a new password —
              collect it from them in person or via college email. Nothing changes until they
              approve your request.
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </Card>

      <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-200">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Coordinator-verified only
        </p>
        Passwords are never reset without a coordinator approving your request. Every request and
        approval is recorded in the coordinator security dashboard.
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
