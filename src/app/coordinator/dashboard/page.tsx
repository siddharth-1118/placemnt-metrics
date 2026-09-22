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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Coordinator dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Review submissions against live scraped GitHub &amp; LeetCode data, then score and rank the batch.
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
