import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, filterStudentDtoForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import type { StudentDto } from "@/lib/types";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ResetRequestsPanel } from "@/components/dashboard/reset-requests";
import { SubmissionsToggle } from "@/components/dashboard/submissions-toggle";
import { CoordinatorsAdmin } from "@/components/dashboard/coordinators-admin";
import { DatabaseBackupPanel } from "@/components/dashboard/backup-panel";
import { PortalArchivesPanel } from "@/components/dashboard/archives-panel";
import { GraduationCap, ShieldCheck, ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Evaluation Dashboard · SRM Placement Committee",
  description: "Official evaluation and scoring matrix for School of Computing faculty placement coordinators.",
};

export default async function CoordinatorDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Coordinators without any evaluation permission are kept out too.
  if (!user.canViewSubmissions) redirect("/my-submission");

  // Server-Side Rendering (SSR) pre-fetch: Load candidate records directly on the server
  // using a lightweight query (omitting massive scrape JSON blobs).
  // This produces an instantaneous 0-second page load with no spinner delay!
  let initialStudents: StudentDto[] | undefined = undefined;
  try {
    const rawStudents = await prisma.student.findMany({
      where: {
        NOT: {
          registerNumber: { startsWith: "COORD-" },
        },
      },
      orderBy: [{ totalScore: "desc" }, { registerNumber: "asc" }],
      include: {
        documents: {
          select: {
            id: true,
            category: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            note: true,
            status: true,
            reviewedAt: true,
            reviewNote: true,
            reviewedByName: true,
            createdAt: true,
          },
        },
        projectLinks: {
          select: {
            id: true,
            category: true,
            label: true,
            url: true,
            status: true,
            reviewedAt: true,
            reviewNote: true,
            reviewedByName: true,
            createdAt: true,
          },
        },
      },
    });

    initialStudents = rawStudents.map((s) =>
      filterStudentDtoForUser(toDto(s), user)
    );
  } catch (err) {
    console.warn("SSR students query failed, client will fetch:", err);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Institutional header */}
      <div className="mb-8 border-b border-white/10 pb-6 animate-rise">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300">
          <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
          <span>Faculty Evaluation Committee</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">AO1 Batch Placement Assessment Matrix</span>
        </div>

        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Batch Evaluation <span className="text-gradient">&amp; Leaderboard</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-300">
          Audit submitted candidate records against live-scraped GitHub &amp; LeetCode footprints.
          Verify uploaded proof documents, score against the 100-mark rubric caps, and export
          audited shortlists for placement drives.
          {!user.canScore && (
            <> You have <strong>view-only</strong> access — scoring is done by coordinators with score permission.</>
          )}
        </p>
      </div>

      {user.isSuperAdmin && (
        <div className="mb-6 space-y-4">
          <SubmissionsToggle />

          <details className="group rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c] shadow-sm">
            <summary className="flex cursor-pointer select-none items-center justify-between p-3.5 font-semibold text-xs text-[#1c2024] dark:text-white hover:bg-[#f6f5f2] dark:hover:bg-[#202936] rounded-md transition-colors">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#165b33] dark:text-[#78d69f]" />
                <span className="font-bold">Super Admin Tools</span>
                <span className="text-[#5c6470] dark:text-[#94a3b8] font-normal">
                  (Coordinator Assignments, Archives, Database Backups)
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-[#5c6470] transition-transform duration-200 group-open:rotate-180 dark:text-[#94a3b8]" />
            </summary>
            <div className="space-y-6 border-t border-[#e2ded5] p-5 dark:border-[#262f3c]">
              <CoordinatorsAdmin />
              <DatabaseBackupPanel />
              <PortalArchivesPanel />
            </div>
          </details>
        </div>
      )}

      {/* Main interactive dashboard with pre-loaded SSR students */}
      <Dashboard
        canScore={user.canScore}
        isSuperAdmin={user.isSuperAdmin}
        permissionScopes={user.permissionScopes}
        initialStudents={initialStudents}
      />

      {/* Password reset requests & audit log */}
      <div className="mt-12">
        <details className="group rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c] shadow-sm">
          <summary className="flex cursor-pointer select-none items-center justify-between p-3.5 font-semibold text-xs text-[#1c2024] dark:text-white hover:bg-[#f6f5f2] dark:hover:bg-[#202936] rounded-md transition-colors">
            <span className="font-bold">Password Reset Requests &amp; Account Recovery</span>
            <ChevronDown className="h-4 w-4 text-[#5c6470] transition-transform duration-200 group-open:rotate-180 dark:text-[#94a3b8]" />
          </summary>
          <div className="border-t border-[#e2ded5] p-5 dark:border-[#262f3c]">
            <ResetRequestsPanel canManage={user.canScore} />
          </div>
        </details>
      </div>
    </div>
  );
}
