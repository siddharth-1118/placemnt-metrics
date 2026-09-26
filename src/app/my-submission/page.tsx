import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { isSubmissionsLocked } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import { ScrapeCards } from "@/components/dashboard/read-only-cards";
import { DocumentUploader } from "@/components/student/document-uploader";
import { LinkManager } from "@/components/student/link-manager";
import { NotificationBell } from "@/components/student/notifications";
import { ChangePasswordCard } from "@/components/student/change-password";
import { Button, Badge } from "@/components/ui";
import { CheckCircle2, Clock, LayoutDashboard } from "lucide-react";
import { SCORE_CAPS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Student Dashboard · Placement Matrix Portal",
};

/** One row of the breakdown table. */
function ScoreRow({
  n,
  label,
  cap,
  awarded,
  description,
  muted = false,
  bold = false,
}: {
  n: string;
  label: string;
  cap: string;
  awarded: string;
  description: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "bg-[#faf8f5] font-bold dark:bg-[#161c24]" : undefined}>
      <td className="font-medium text-stone-400">{n}</td>
      <td className={`font-semibold text-stone-900 dark:text-white${muted ? " font-medium" : ""}`}>
        {label}
      </td>
      <td className="text-center text-stone-600 dark:text-stone-300">{cap}</td>
      <td className={`text-center font-bold text-[#165b33] dark:text-[#78d69f]${muted ? " text-stone-600 dark:text-stone-300" : ""}`}>
        {awarded}
      </td>
      <td className="text-[11px] text-stone-600 dark:text-stone-300">{description}</td>
    </tr>
  );
}

export default async function MySubmissionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isEvaluator = user.canViewSubmissions;
  const locked = !isEvaluator && (await isSubmissionsLocked());

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
            Registration Number:{" "}
            <span className="font-mono font-medium text-[#1c2024] dark:text-white">
              {student.registerNumber}
            </span>{" "}
            · SRM School of Computing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEvaluator && (
            <Link href="/coordinator/dashboard">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Coordinator Dashboard</span>
              </Button>
            </Link>
          )}
          <Link href="/student/submit">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              disabled={locked}
              title={locked ? "Submissions are closed by the coordinator" : undefined}
            >
              <span>Edit Profile</span>
            </Button>
          </Link>
          <NotificationBell />
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-600">Submissions are closed</p>
            <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
              The coordinator has closed submissions — profile updates, document uploads and new
              links are disabled. Existing documents and scores are unaffected; contact your
              coordinator if something must be corrected.
            </p>
          </div>
        </div>
      )}

      {/* 2. Key Information: Placement Matrix Score & Status */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Placement Matrix Score */}
        <div className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c] sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1c2024] dark:text-white">
              My Placement Matrix Score
            </span>
            {student.rank !== null ? (
              <Badge variant="success">Batch Rank: #{student.rank}</Badge>
            ) : (
              <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">Rank pending review</span>
            )}
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#165b33] dark:text-[#78d69f]">
              {student.scores.total.toFixed(1)}
            </span>
            <span className="text-sm font-semibold text-[#5c6470] dark:text-[#94a3b8]">/ 100 Marks</span>
          </div>

          <p className="mt-1 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Calculated across verified academic marks, coding footprint, internships, and certified
            projects under official SRM criteria.
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
                    <p className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">Audited by coordinator</p>
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
            <p className="font-semibold text-[#1c2024] dark:text-white">
              {student.facultyAdvisor || "Assigned by Dept."}
            </p>
          </div>
        </div>

        {/* Clean Table of the 11 Matrix Components */}
        <div className="overflow-x-auto">
          <table className="portal-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Evaluation Area</th>
                <th className="w-24 text-center">Max Marks</th>
                <th className="w-24 text-center">Awarded</th>
                <th>Description / Verified Components</th>
              </tr>
            </thead>
            <tbody>
              <ScoreRow
                n="1"
                label="Academic Performance"
                cap={`${SCORE_CAPS.academic} M`}
                awarded={student.scores.academic.toFixed(1)}
                description="Auto: 10th % (2.5) + 12th % (2.5) + CGPA (5.0) band-based"
              />
              <ScoreRow
                n="2"
                label="GitHub Profile &amp; Collabs"
                cap={`${SCORE_CAPS.github} M`}
                awarded={student.scores.github.toFixed(1)}
                description="Auto: Contributions (5) + Monthly (2) + Community (3) + Collabs (5)"
              />
              <ScoreRow
                n="3"
                label="Coding Practice Platform"
                cap={`${SCORE_CAPS.coding} M`}
                awarded={student.scores.coding.toFixed(1)}
                description="Auto: LeetCode badges (5) + Medium/Hard solved (5)"
              />
              <ScoreRow
                n="4"
                label="Internships &amp; Research"
                cap={`${SCORE_CAPS.internship} M`}
                awarded={student.scores.internship.toFixed(1)}
                description="DRDO/ISRO/IIT/Research (5) | F500 (4) | Small (3) | &lt;3 Mo (2) | Paid (+1)"
              />
              <ScoreRow
                n="5"
                label="Skills &amp; Global Certifications"
                cap={`${SCORE_CAPS.certifications} M`}
                awarded={student.scores.certifications.toFixed(1)}
                description="Global cert (5) · NPTEL (2) · Coursera (1) · max 5 courses"
              />
              <ScoreRow
                n="6"
                label="Projects Done"
                cap={`${SCORE_CAPS.projects} M`}
                awarded={student.scores.projects.toFixed(1)}
                description="IIT/NIT/DRDO-class (5) · app (3) · mini (1–2) · max 3 projects"
              />
              <ScoreRow
                n="7"
                label="Full-stack Development"
                cap={`${SCORE_CAPS.fullstack} M`}
                awarded={student.scores.fullstack.toFixed(1)}
                description="One FSD project (frontend+backend+DB) = 5"
              />
              <ScoreRow
                n="8"
                label="Hackathons &amp; Competitions"
                cap={`${SCORE_CAPS.hackathons} M`}
                awarded={student.scores.hackathons.toFixed(1)}
                description="1st (5) · 2nd (4) · 3rd (3) · participated (1) · max 4 entries"
              />
              <ScoreRow
                n="9"
                label="In-house Projects (UROP/SERI)"
                cap={`${SCORE_CAPS.inhouse} M`}
                awarded={student.scores.inhouse.toFixed(1)}
                description="UROP/SERI/special lab 4 each · max 2 projects"
              />
              <ScoreRow
                n="10"
                label="Professional Memberships"
                cap={`${SCORE_CAPS.membership} M`}
                awarded={student.scores.membership.toFixed(1)}
                description="Valid IEEE/IET/ACM/CSI/ISTE membership = 2"
              />
              <ScoreRow
                n="11"
                label="SHL / Talent Discovery / NCET"
                cap={`${SCORE_CAPS.shl} M`}
                awarded={student.scores.shl.toFixed(1)}
                description="Assessment score bands 90–100→10 · … · &lt;25→0"
              />
              <ScoreRow
                n=""
                label="Total Placement Matrix Score"
                cap="100 M"
                awarded={`${student.scores.total.toFixed(1)} M`}
                description={isVerified ? "Audited &amp; Verified" : "Pending Coordinator Review"}
                bold
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Live Scraped Profiles Diagnostics */}
      <ScrapeCards s={student} />

      {/* 5. Documents — one section per category */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Proof documents — one section per category</h2>
          <p className="text-sm text-[#5c6470] dark:text-[#94a3b8]">
            Marksheets, internships, skills &amp; global certifications, hackathons &amp;
            competitions, in-house projects, professional memberships and SHL — each in its own
            section, each verified by its assigned coordinator.
          </p>
        </div>
        <DocumentUploader locked={locked} />
      </section>

      {/* 6. Project links */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Project &amp; in-house links</h2>
        </div>
        <LinkManager locked={locked} />
      </section>

      {/* 7. Account Password Security */}
      <ChangePasswordCard />
    </div>
  );
}
