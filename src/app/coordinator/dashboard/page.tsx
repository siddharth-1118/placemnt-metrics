import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ResetRequestsPanel } from "@/components/dashboard/reset-requests";
import { SubmissionsToggle } from "@/components/dashboard/submissions-toggle";
import { CoordinatorsAdmin } from "@/components/dashboard/coordinators-admin";

export const metadata: Metadata = {
  title: "Coordinator dashboard",
};

export default async function CoordinatorDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Coordinators without any evaluation permission are kept out too.
  if (!user.canViewSubmissions) redirect("/my-submission");

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-6 sm:py-12">
      <div className="animate-rise mb-7">
        <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
          Evaluation <span className="text-gradient">dashboard</span>
        </h1>
        <p className="mt-2.5 max-w-2xl text-muted-foreground">
          Every submission next to its live-scraped GitHub &amp; LeetCode evidence. Verify
          documents, score against the caps, and the leaderboard reorders itself.
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
      <Dashboard canScore={user.canScore} isSuperAdmin={user.isSuperAdmin} permissionScopes={user.permissionScopes} />
      <div className="mt-8">
        <ResetRequestsPanel canManage={user.canScore} />
      </div>
    </div>
  );
}
