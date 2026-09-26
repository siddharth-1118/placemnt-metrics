import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import { ScrapeCards } from "@/components/dashboard/read-only-cards";
import { DocumentUploader } from "@/components/student/document-uploader";
import { LinkManager } from "@/components/student/link-manager";
import { NotificationBell } from "@/components/student/notifications";
import { ChangePasswordCard } from "@/components/student/change-password";
import { Button, Badge } from "@/components/ui";
import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { SCORE_CAPS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Student Dashboard · Placement Matrix Portal",
};

export default async function MySubmissionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const row = await prisma.student.findUnique({
    where: { id: user.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  if (!row) redirect("/student/submit");

  const student = toDto(row);
  const isVerified = student.status === "VERIFIED";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* 1. Header: Student Dashboard */}
      <div className="flex flex-col justify-between gap-3 border-b border-[#e2ded5] pb-4 dark:border-[#262f3c] sm:flex-row sm:items-center">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5c6470] dark:text-[#94a3b8]">
            Student Dashboard
          </span>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1c2024] dark:text-white">
            Welcome, {student.fullName}
          </h1>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Registration Number: <span className="font-mono font-medium text-[#1c2024] dark:text-white">{student.registerNumber}</span> · SRM School of Computing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user.role === "COORDINATOR" && user.evaluatorAssigned && (
            <Link href="/coordinator/dashboard">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Coordinator Dashboard</span>
              </Button>
            </Link>
          )}
          <Link href="/student/submit">
            <Button variant="outline" size="sm" className="text-xs h-8">
              <span>Edit Profile</span>
            </Button>
          </Link>
          <NotificationBell />
        </div>
      </div>

      {/* 2. Key Information: Placement Matrix Score & Status */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Placement Matrix Score */}
        <div className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c] sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
              My Placement Matrix Score
            </span>
            {student.rank !== null ? (
              <Badge variant="success">
                Batch Rank: #{student.rank}
              </Badge>
            ) : (
              <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                Rank pending review
              </span>
            )}
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#165b33] dark:text-[#78d69f]">
              {student.scores.total.toFixed(1)}
            </span>
            <span className="text-sm font-semibold text-[#5c6470] dark:text-[#94a3b8]">
              / 100 Marks
            </span>
          </div>

          <p className="mt-1 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Calculated across verified academic marks, coding footprint, internships, and certified projects under official SRM criteria.
          </p>
        </div>

        {/* Verification Status & Eligibility */}
        <div className="flex flex-col justify-between rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
              My Eligibility
            </span>
            <div className="mt-2 flex items-center gap-2">
              {isVerified ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-[#165b33] dark:text-[#78d69f]" />
                  <div>
                    <span className="text-xs font-bold text-[#165b33] dark:text-[#78d69f]">
                      Verified &amp; Eligible
                    </span>
                    <p className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                      Audited by coordinator
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-[#92540d] dark:text-[#f3b55c]" />
                  <div>
                    <span className="text-xs font-bold text-[#92540d] dark:text-[#f3b55c]">
                      Pending Review
                    </span>
                    <p className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                      Awaiting coordinator audit
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {student.coordinatorNote && (
            <div className="mt-2 rounded border border-[#e2ded5] bg-[#faf8f5] p-2 text-[11px] text-[#5c6470] dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#94a3b8]">
              <strong className="text-[#1c2024] dark:text-white">Note:</strong> {student.coordinatorNote}
            </div>
          )}
        </div>
      </div>

      {/* 3. My Profile & Placement Matrix Breakdown Table */}
      <div className="rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div className="border-b border-[#e2ded5] p-4 dark:border-[#262f3c]">
          <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">
            Placement Matrix Score Breakdown
          </h2>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Detailed breakdown based on SRM School of Computing official 100-mark rubric.
          </p>
        </div>

        {/* Academic Profile Quick Stats */}
        <div className="grid grid-cols-2 gap-2 border-b border-[#e2ded5] bg-[#faf8f5] p-3 text-xs sm:grid-cols-4 dark:border-[#262f3c] dark:bg-[#161c24]">
          <div>
            <span className="text-[#5c6470] dark:text-[#94a3b8]">10th Standard:</span>
            <p className="font-semibold text-[#1c2024] dark:text-white">{student.tenthPercent.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-[#5c6470] dark:text-[#94a3b8]">12th Standard:</span>
            <p className="font-semibold text-[#1c2024] dark:text-white">{student.twelfthPercent.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-[#5c6470] dark:text-[#94a3b8]">Degree CGPA:</span>
            <p className="font-semibold text-[#1c2024] dark:text-white">{student.cgpa.toFixed(2)} / 10</p>
          </div>
          <div>
            <span className="text-[#5c6470] dark:text-[#94a3b8]">Faculty Advisor:</span>
            <p className="font-semibold text-[#1c2024] dark:text-white">{student.facultyAdvisor || "Assigned by Dept."}</p>
          </div>
        </div>

        {/* Clean Table of the 6 Matrix Components */}
        <div className="overflow-x-auto">
          <table className="portal-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Evaluation Area</th>
                <th className="text-center w-24">Max Marks</th>
                <th className="text-center w-24">Awarded</th>
                <th>Description / Verified Components</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-stone-400 font-medium">1</td>
                <td className="font-semibold text-stone-900 dark:text-white">Academic Performance</td>
                <td className="text-center text-stone-600 dark:text-stone-300">10 M</td>
                <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.academic.toFixed(1)}
                </td>
                <td className="text-stone-600 dark:text-stone-300 text-[11px]">
                  10th % (2.5) + 12th % (2.5) + CGPA (5.0)
                </td>
              </tr>
              <tr>
                <td className="text-stone-400 font-medium">2</td>
                <td className="font-semibold text-stone-900 dark:text-white">GitHub Profile &amp; Collabs</td>
                <td className="text-center text-stone-600 dark:text-stone-300">15 M</td>
                <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.github.toFixed(1)}
                </td>
                <td className="text-stone-600 dark:text-stone-300 text-[11px]">
                  1y Contributions &amp; Repos (5) + Monthly (2) + Community (3) + Collabs (5)
                </td>
              </tr>
              <tr>
                <td className="text-stone-400 font-medium">3</td>
                <td className="font-semibold text-stone-900 dark:text-white">Coding Practice Platform</td>
                <td className="text-center text-stone-600 dark:text-stone-300">10 M</td>
                <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.coding.toFixed(1)}
                </td>
                <td className="text-stone-600 dark:text-stone-300 text-[11px]">
                  LeetCode / GFG Badges (5) + Medium/Hard Solved (5)
                </td>
              </tr>
              <tr>
                <td className="text-stone-400 font-medium">4</td>
                <td className="font-semibold text-stone-900 dark:text-white">Internships &amp; Research</td>
                <td className="text-center text-stone-600 dark:text-stone-300">10 M</td>
                <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.internship.toFixed(1)}
                </td>
                <td className="text-stone-600 dark:text-stone-300 text-[11px]">
                  DRDO/ISRO/IIT/NIT/Research (5) | F500 (4) | Small (3) | &lt;3 Mo (2)
                </td>
              </tr>
              <tr>
                <td className="text-stone-400 font-medium">5</td>
                <td className="font-semibold text-stone-900 dark:text-white">Projects &amp; Inhouse</td>
                <td className="text-center text-stone-600 dark:text-stone-300">18 M</td>
                <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.projects.toFixed(1)}
                </td>
                <td className="text-stone-600 dark:text-stone-300 text-[11px]">
                  Projects Done (5) + FSD Project (5) + Inhouse UROP/SERI (8)
                </td>
              </tr>
              <tr>
                <td className="text-stone-400 font-medium">6</td>
                <td className="font-semibold text-stone-900 dark:text-white">Certs, Hackathons &amp; SHL</td>
                <td className="text-center text-stone-600 dark:text-stone-300">37 M</td>
                <td className="text-center font-bold text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.extras.toFixed(1)}
                </td>
                <td className="text-stone-600 dark:text-stone-300 text-[11px]">
                  Global Certs (15) + Hackathons (10) + SHL/NCET (10) + Professional Memberships (2)
                </td>
              </tr>
              <tr className="bg-[#faf8f5] font-bold dark:bg-[#161c24]">
                <td colSpan={2} className="text-stone-900 dark:text-white">
                  Total Placement Matrix Score
                </td>
                <td className="text-center text-stone-900 dark:text-white">100 M</td>
                <td className="text-center text-[#165b33] dark:text-[#78d69f]">
                  {student.scores.total.toFixed(1)} M
                </td>
                <td className="text-xs text-stone-500">
                  {isVerified ? "Audited & Verified" : "Pending Coordinator Review"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Live Scraped Profiles Diagnostics */}
      <ScrapeCards s={student} />

      {/* 5. Documents & Project Links Verification */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DocumentUploader
          studentId={student.id}
          uploadToken={student.id}
          initialDocs={student.documents}
        />
        <LinkManager
          studentId={student.id}
          initialLinks={student.projectLinks}
        />
      </div>

      {/* 6. Account Password Security */}
      <ChangePasswordCard />
    </div>
  );
}
