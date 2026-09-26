import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { SubmitForm } from "@/components/student/submit-form";

export const metadata: Metadata = {
  title: "Student Registration · Placement Matrix Portal",
  description: "Register your student profile to calculate and track your placement matrix score.",
};

export default function StudentSubmitPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      {/* Back to Home link */}
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="border-b border-[#e2ded5] pb-4 dark:border-[#262f3c]">
        <div className="inline-flex items-center gap-1.5 rounded border border-[#d6cfc0] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#1c2024] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#f0ede6]">
          <GraduationCap className="h-3.5 w-3.5 text-[#165b33] dark:text-[#78d69f]" />
          <span>SRM School of Computing · Student Portal</span>
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-[#1c2024] dark:text-white sm:text-2xl">
          Student Registration &amp; Profile
        </h1>
        <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
          Submit your academic details and coding profiles to calculate your placement matrix score.
        </p>
      </div>

      {/* Main Form */}
      <div className="mt-5">
        <SubmitForm />
      </div>
    </div>
  );
}
