import type { Metadata } from "next";
import { SubmitForm } from "@/components/student/submit-form";

export const metadata: Metadata = {
  title: "Submit your profile",
};

export default function StudentSubmitPage() {
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
      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}
