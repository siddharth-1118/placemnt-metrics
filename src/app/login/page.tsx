import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login · Placement Matrix Portal",
  description: "Sign in to access your student placement score or coordinator dashboard.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      {/* Simple Back to Home link */}
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Main Login Card */}
      <div className="rounded-md border border-[#ded9ce] bg-white p-6 shadow-sm dark:border-[#262f3c] dark:bg-[#1b222c] sm:p-7">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-[#165b33] text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#1c2024] dark:text-white">
            Placement Matrix Portal
          </h1>
          <p className="mt-1 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Login to continue
          </p>
        </div>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
