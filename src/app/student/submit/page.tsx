import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { SubmitForm } from "@/components/student/submit-form";
import { getSessionUser } from "@/lib/auth";
import { isSubmissionsLocked } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Submit your profile",
};

export default async function StudentSubmitPage() {
  const user = await getSessionUser();
  const isEvaluator = user?.role === "COORDINATOR" && user.evaluatorAssigned;
  const locked = !isEvaluator && (await isSubmissionsLocked());

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-8 sm:px-6 sm:py-14">
      <div className="animate-rise">
        <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
          Your profile, <span className="text-gradient">verified</span>
        </h1>
        <p className="mt-2.5 max-w-xl text-muted-foreground">
          Enter your academic details and coding handles. GitHub and LeetCode are scraped live the
          moment you submit — documents and project links are added on your portal right after.
        </p>
      </div>

      {locked && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-600">Submissions are closed</p>
            <p className="mt-0.5 text-muted-foreground">
              The coordinator has closed new submissions. You can still view your portal, but
              profiles, documents and links can no longer be changed. Contact your coordinator if
              something must be corrected.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <SubmitForm locked={locked} />
      </div>
    </div>
  );
}
