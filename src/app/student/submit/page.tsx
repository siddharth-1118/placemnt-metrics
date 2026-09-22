import type { Metadata } from "next";
import { SubmitForm } from "@/components/student/submit-form";

export const metadata: Metadata = {
  title: "Submit your profile",
};

export default function StudentSubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Student submission</h1>
      <p className="mt-2 text-muted-foreground">
        Enter your academic details and coding profile links. Your GitHub and LeetCode profiles
        will be scraped and verified automatically.
      </p>
      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}
