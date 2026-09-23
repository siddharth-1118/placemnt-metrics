import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-3 py-10 sm:px-4 sm:py-20">
      <Card className="glass-strong animate-rise rounded-3xl p-1">
        <CardHeader className="p-6 pb-4">
          <span className="glass-inset mb-3 flex h-11 w-11 items-center justify-center rounded-2xl">
            <KeyRound className="h-5 w-5 text-primary" />
          </span>
          <CardTitle className="text-xl tracking-[-0.02em]">Reset your password</CardTitle>
          <CardDescription>
            Send a reset request to the placement coordinators. Only coordinators can issue new
            passwords — that keeps every account verified and safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          <ForgotPasswordForm />

          <div className="rounded-xl border border-border/70 bg-accent/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> How it works
            </p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Submit this form with your exact registered details.</li>
              <li>A coordinator verifies your identity.</li>
              <li>They issue a new password and hand it to you personally.</li>
              <li>Sign in with it — then change it from the submit form anytime.</li>
            </ol>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Remembered it after all?{" "}
            <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <LogIn className="h-3 w-3" /> Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
