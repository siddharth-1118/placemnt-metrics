"use client";

import Link from "next/link";
import {
  GraduationCap,
  LogIn,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { SRM_OFFICIAL_METRICS } from "@/lib/types";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* 1. Main Welcome Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded border border-[#d6cfc0] bg-white px-3 py-1 text-xs font-semibold text-[#1c2024] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#f0ede6]">
          <GraduationCap className="h-3.5 w-3.5 text-[#165b33] dark:text-[#78d69f]" />
          <span>SRM Institute of Science and Technology · School of Computing</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[#1c2024] dark:text-white sm:text-4xl">
          Placement Matrix Portal
        </h1>

        <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-[#5c6470] dark:text-[#94a3b8]">
          Official placement evaluation and matrix calculation system for Batches 2022–2026 &amp; 2023–2027.
        </p>

        {/* 2. Two Clear Actions: Login & Register */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 max-w-xl mx-auto">
          {/* Option A: Login */}
          <div className="flex flex-col justify-between rounded-md border border-[#e2ded5] bg-white p-5 text-left dark:border-[#262f3c] dark:bg-[#1b222c]">
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded bg-[#eaf4ed] text-[#165b33] dark:bg-[#153422] dark:text-[#78d69f]">
                <LogIn className="h-4 w-4" />
              </div>
              <h2 className="mt-3 text-sm font-bold text-[#1c2024] dark:text-white">
                Student &amp; Coordinator Login
              </h2>
              <p className="mt-1 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                Access your placement scores, uploaded documents, or coordinator evaluation dashboard.
              </p>
            </div>

            <div className="mt-5">
              <Link
                href="/login"
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#165b33] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#124929]"
              >
                <span>Login</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <p className="mt-2 text-center text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                Already registered? <Link href="/login" className="font-semibold text-[#165b33] hover:underline dark:text-[#78d69f]">Login</Link>
              </p>
            </div>
          </div>

          {/* Option B: Register */}
          <div className="flex flex-col justify-between rounded-md border border-[#e2ded5] bg-white p-5 text-left dark:border-[#262f3c] dark:bg-[#1b222c]">
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded bg-[#f0ece4] text-[#474f5a] dark:bg-[#232b36] dark:text-[#cbd5e1]">
                <UserPlus className="h-4 w-4" />
              </div>
              <h2 className="mt-3 text-sm font-bold text-[#1c2024] dark:text-white">
                New Student Registration
              </h2>
              <p className="mt-1 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                Submit your academic marks, GitHub, and LeetCode handles to calculate your placement matrix score.
              </p>
            </div>

            <div className="mt-5">
              <Link
                href="/student/submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#165b33] bg-white px-4 py-2 text-xs font-semibold text-[#165b33] transition hover:bg-[#eaf4ed] dark:border-[#20683f] dark:bg-[#1b222c] dark:text-[#78d69f] dark:hover:bg-[#153422]"
              >
                <span>Register</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <p className="mt-2 text-center text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                New here? <Link href="/student/submit" className="font-semibold text-[#165b33] hover:underline dark:text-[#78d69f]">Create an account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Placement Matrix Overview (Simple College Reference Table) */}
      <div id="matrix" className="mt-14 rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div className="border-b border-[#e2ded5] p-4 dark:border-[#262f3c]">
          <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">
            Placement Matrix Evaluation Standard (100 Marks)
          </h2>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Official evaluation criteria for School of Computing batches (2022–2026 &amp; 2023–2027).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="portal-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Evaluation Metric</th>
                <th className="text-center w-24">Marks</th>
                <th>Evaluation Criteria &amp; Mark Split-Up</th>
              </tr>
            </thead>
            <tbody>
              {SRM_OFFICIAL_METRICS.map((metric, idx) => (
                <tr key={metric.id}>
                  <td className="text-stone-400 font-medium">{idx + 1}</td>
                  <td className="font-semibold text-stone-900 dark:text-white">
                    {metric.name}
                  </td>
                  <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                    {metric.allottedMarks} M
                  </td>
                  <td className="text-stone-600 dark:text-stone-300">
                    {metric.splitUp}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#faf8f5] font-bold dark:bg-[#161c24]">
                <td colSpan={2} className="text-stone-900 dark:text-white">
                  Total Placement Matrix Score
                </td>
                <td className="text-center font-extrabold text-[#165b33] dark:text-[#78d69f]">
                  100.0 M
                </td>
                <td className="text-stone-500 font-normal text-xs">
                  Calculated from 13 verified academic, coding, project &amp; internship components
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
