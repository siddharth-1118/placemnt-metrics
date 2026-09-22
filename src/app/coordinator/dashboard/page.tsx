import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Coordinator dashboard",
};

export default async function CoordinatorDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Coordinators who are not assigned to the evaluation task are kept out too.
  if (user.role !== "COORDINATOR" || !user.evaluatorAssigned) redirect("/my-submission");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="animate-rise mb-7">
        <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
          Evaluation <span className="text-gradient">dashboard</span>
        </h1>
        <p className="mt-2.5 max-w-2xl text-muted-foreground">
          Every submission next to its live-scraped GitHub &amp; LeetCode evidence. Verify
          documents, score against the caps, and the leaderboard reorders itself.
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
