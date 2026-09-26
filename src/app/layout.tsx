import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import {
  GraduationCap,
  ShieldCheck,
  Award,
  BookOpen,
  Mail,
  MapPin,
  FileCheck2,
} from "lucide-react";

export const metadata: Metadata = {
  title: {
    default: "SRM Placement Matrix Portal · School of Computing",
    template: "%s · SRM Placement Matrix",
  },
  description:
    "Official placement evaluation and matrix calculation portal for SRM Institute of Science and Technology, School of Computing.",
};export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Degrade gracefully: a session read can only fail when the database is
  // unreachable or not yet migrated (missing permission columns). Throwing
  // here would take down EVERY route — including /login, which the user needs
  // to reach — so render signed-out chrome instead.
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-[#faf8f5] text-[#1c2024] transition-colors duration-150 dark:bg-[#151921] dark:text-[#f0ede6] antialiased">
        <ThemeProvider>
          {/* Institutional Top Navigation Bar */}
          <Navbar
            user={
              user
                ? {
                    fullName: user.fullName,
                    role: user.role,
                    evaluatorAssigned: user.evaluatorAssigned,
                  }
                : null
            }
          />

          {/* Main Content Area */}
          <main className="flex-1">{children}</main>

          {/* Institutional University Footer */}
          <footer className="mt-16 border-t border-[#e2ded5] bg-[#f4f1ea] transition-colors dark:border-[#262f3c] dark:bg-[#13171e]">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
                {/* Institution brand & info */}
                <div className="space-y-3 lg:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#165b33] text-white shadow-sm">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1c2024] dark:text-white">
                        SRM Institute of Science and Technology
                      </h3>
                      <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                        School of Computing · Placement Administration Cell
                      </p>
                    </div>
                  </div>
                  <p className="max-w-md text-xs leading-relaxed text-[#5c6470] dark:text-[#94a3b8]">
                    Official Placement Matrix Calculation and Verification System for SRM School of Computing.
                    Evaluates students transparently across 13 administrative criteria totaling 100 Marks.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="inline-flex items-center gap-1 rounded border border-[#d6cfc0] bg-white px-2 py-0.5 font-medium text-[#1c2024] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#f0ede6]">
                      <Award className="h-3 w-3 text-[#165b33] dark:text-[#3da36a]" /> NAAC A++
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-[#d6cfc0] bg-white px-2 py-0.5 font-medium text-[#1c2024] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#f0ede6]">
                      <ShieldCheck className="h-3 w-3 text-[#165b33] dark:text-[#3da36a]" /> NIRF Ranked
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-[#d6cfc0] bg-white px-2 py-0.5 font-medium text-[#1c2024] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#f0ede6]">
                      <FileCheck2 className="h-3 w-3 text-[#165b33] dark:text-[#3da36a]" /> 100-Mark Rubric
                    </span>
                  </div>
                </div>

                {/* Quick links */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1c2024] dark:text-[#f0ede6]">
                    Navigation
                  </h4>
                  <ul className="mt-3 space-y-1.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                    <li>
                      <Link href="/" className="hover:text-[#165b33] dark:hover:text-white">
                        Home
                      </Link>
                    </li>
                    <li>
                      <Link href="/#matrix" className="hover:text-[#165b33] dark:hover:text-white">
                        Placement Matrix Rubric
                      </Link>
                    </li>
                    <li>
                      <Link href="/student/submit" className="hover:text-[#165b33] dark:hover:text-white">
                        Student Registration
                      </Link>
                    </li>
                    <li>
                      <Link href="/login" className="hover:text-[#165b33] dark:hover:text-white">
                        Portal Login
                      </Link>
                    </li>
                    <li>
                      <Link href="/my-submission" className="hover:text-[#165b33] dark:hover:text-white">
                        Student Dashboard
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Rubric metrics summary */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1c2024] dark:text-[#f0ede6]">
                    Placement Matrix (100 M)
                  </h4>
                  <ul className="mt-3 space-y-1.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                    <li className="flex items-center justify-between">
                      <span>Academics (10th/12th/CGPA)</span>
                      <span className="font-semibold text-[#1c2024] dark:text-[#f0ede6]">10 M</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>GitHub &amp; Contributions</span>
                      <span className="font-semibold text-[#1c2024] dark:text-[#f0ede6]">15 M</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Coding Practice (LeetCode/GFG)</span>
                      <span className="font-semibold text-[#1c2024] dark:text-[#f0ede6]">10 M</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Internships &amp; Research</span>
                      <span className="font-semibold text-[#1c2024] dark:text-[#f0ede6]">10 M</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Projects &amp; Inhouse (UROP/SERI)</span>
                      <span className="font-semibold text-[#1c2024] dark:text-[#f0ede6]">18 M</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Certs, Hackathons &amp; SHL</span>
                      <span className="font-semibold text-[#1c2024] dark:text-[#f0ede6]">37 M</span>
                    </li>
                  </ul>
                </div>

                {/* Campus & Office */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1c2024] dark:text-[#f0ede6]">
                    Campus &amp; Contact
                  </h4>
                  <div className="mt-3 space-y-2 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#165b33] dark:text-[#3da36a]" />
                      <span>
                        SRM Nagar, Kattankulathur, Chengalpattu Dist., Tamil Nadu — 603203
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[#165b33] dark:text-[#3da36a]" />
                      <span>placement.computing@srmist.edu.in</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#165b33] dark:text-[#3da36a]" />
                      <span>School of Computing Placement Office</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[#ded9ce] pt-5 text-xs text-[#6b7280] dark:border-[#262f3c] dark:text-[#94a3b8] sm:flex-row">
                <p>
                  &copy; {new Date().getFullYear()} SRM Institute of Science and Technology. All rights reserved.
                </p>
                <div className="flex items-center gap-3">
                  <span>Placement Matrix Calculation Portal</span>
                  <span>&middot;</span>
                  <span>Batches 2022&ndash;2026 &amp; 2023&ndash;2027</span>
                </div>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
