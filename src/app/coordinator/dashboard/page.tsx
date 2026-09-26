import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ResetRequestsPanel } from "@/components/dashboard/reset-requests";
import { SubmissionsToggle } from "@/components/dashboard/submissions-toggle";
import { CoordinatorsAdmin } from "@/components/dashboard/coordinators-admin";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Evaluation Dashboard · SRM Placement Committee",
  description: "Official evaluation and scoring matrix for School of Computing faculty placement coordinators.",
};

export default async function CoordinatorDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Coordinators without any evaluation permission are kept out too.
  if (!user.canViewSubmissions) redirect("/my-submission");

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
        <div className="mb-6 space-y-6">
          <SubmissionsToggle />
          <CoordinatorsAdmin />
        </div>
      )}

      {/* Main interactive dashboard */}
      <Dashboard canScore={user.canScore} isSuperAdmin={user.isSuperAdmin} permissionScopes={user.permissionScopes} />

      {/* Password reset requests & audit log */}
      <div className="mt-12">
        <ResetRequestsPanel canManage={user.canScore} />
      </div>
    </div>
  );
}
