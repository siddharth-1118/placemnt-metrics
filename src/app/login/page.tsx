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
      <Card>
        <CardHeader>
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <LogIn className="h-5 w-5 text-primary" />
          </span>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription className="text-muted-foreground">
            Students can view their own submission; coordinators assigned to the evaluation task
            can open the ranking dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-xs text-muted-foreground">
            Haven&apos;t submitted yet?{" "}
            <Link href="/student/submit" className="text-primary hover:underline">
              Submit your profile first
            </Link>{" "}
            and set a password at the bottom of the form.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
