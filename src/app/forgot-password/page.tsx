import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogIn, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import { SelfResetForm } from "@/components/auth/self-reset-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-3 py-10 sm:px-4 sm:py-16">
      {/* Primary path: instant self-reset — nothing is sent to anyone */}
      <Card className="glass-strong animate-rise rounded-3xl p-1">
        <CardHeader className="p-6 pb-4">
          <span className="glass-inset mb-3 flex h-11 w-11 items-center justify-center rounded-2xl">
            <UserRoundCheck className="h-5 w-5 text-primary" />
          </span>
          <CardTitle className="text-xl tracking-[-0.02em]">Reset instantly</CardTitle>
          <CardDescription>
            Prove your identity with the exact marks you submitted — no waiting, nothing is sent
            to anyone. You pick the new password yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <SelfResetForm />
        </CardContent>
      </Card>

      {/* Fallback: coordinator-issued reset */}
      <details className="group mt-5">
        <summary className="glass flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors hover:brightness-110">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <Users className="h-4 w-4 text-primary" />
          </span>
          <span className="flex-1">
            Can&apos;t verify your marks? Ask a coordinator instead
            <span className="block text-xs font-normal text-muted-foreground">
              They verify you personally and issue a new password
            </span>
          </span>
          <span className="text-muted-foreground transition-transform group-open:rotate-180">▾</span>
        </summary>
        <Card className="glass-strong mt-2 rounded-2xl p-1">
          <CardContent className="pt-5">
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </details>

      <div className="mt-5 rounded-2xl border border-border/70 bg-accent/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Why this is safe
        </p>
        Your marks are checked against your own submission with exact precision, attempts are
        rate-limited, and every attempt is audited. Coordinators see failed attempts in their
        panel.
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Remembered it after all?{" "}
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <LogIn className="h-3 w-3" /> Back to sign in
        </Link>
      </p>

      {/* Keep the import used for the shared fallback icon set */}
      <span className="hidden"><KeyRound /></span>
    </div>
  );
}
