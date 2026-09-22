import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:py-24">
      <Card className="glass-strong animate-rise rounded-3xl p-1">
        <CardHeader className="p-6 pb-4">
          <span className="glass-inset mb-3 flex h-11 w-11 items-center justify-center rounded-2xl">
            <LogIn className="h-5 w-5 text-primary" />
          </span>
          <CardTitle className="text-xl tracking-[-0.02em]">Welcome back</CardTitle>
          <CardDescription>
            Students see their own submission; assigned coordinators open the ranking dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <LoginForm />
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Haven&apos;t submitted yet?{" "}
            <Link href="/student/submit" className="font-medium text-primary hover:underline">
              Submit your profile first
            </Link>{" "}
            and set a password at the bottom of the form.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
