import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { isSubmissionsLocked } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import { StudentSummaryCard, ScrapeCards } from "@/components/dashboard/read-only-cards";
import { DocumentUploader } from "@/components/student/document-uploader";
import { LinkManager } from "@/components/student/link-manager";
import { NotificationBell } from "@/components/student/notifications";
import { ChangePasswordCard } from "@/components/student/change-password";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "My submission | SRM Placement Portal",
};

export default async function MySubmissionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isEvaluator = user.role === "COORDINATOR" && user.evaluatorAssigned;
  const locked = !isEvaluator && (await isSubmissionsLocked());

  const row = await prisma.student.findUnique({
    where: { id: user.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  if (!row) redirect("/student/submit");

  const student = toDto(row);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-8 sm:px-6 sm:py-12">
      <div className="animate-rise flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
            Hi, <span className="text-gradient">{student.fullName.split(" ")[0]}</span>
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Your submission, documents, links and scraped coding profiles. Other students&apos;
            submissions stay private.
          </p>
        </div>
        <div className="flex gap-2">
          {user.role === "COORDINATOR" && user.evaluatorAssigned && (
            <Link href="/coordinator/dashboard">
              <Button variant="outline">Evaluation dashboard</Button>
            </Link>
          )}
          <Link href="/student/submit">
            <Button variant="outline" disabled={locked} title={locked ? "Submissions are closed by the coordinator" : undefined}>
              Update profile
            </Button>
          </Link>
        </div>
      </div>

      {/* Coordinator actions (document removed, password reset, …) surface here. */}
      <NotificationBell />

      {locked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-600">Submissions are closed</p>
            <p className="mt-0.5 text-muted-foreground">
              The coordinator has closed submissions — profile updates, document uploads and new
              links are disabled. Existing documents and scores are unaffected; contact your
              coordinator if something must be corrected.
            </p>
          </div>
        </div>
      )}

      <StudentSummaryCard s={student} />
      <ScrapeCards s={student} />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Proof documents</h2>
          <p className="text-sm text-muted-foreground">
            Upload marksheets, internship letters, certificates, competition proofs, memberships and
            SHL documents. Coordinators verify each file individually.
          </p>
        </div>
        <DocumentUploader locked={locked} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Project links</h2>
        </div>
        <LinkManager locked={locked} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Account security</h2>
        </div>
        <ChangePasswordCard />
      </section>
    </div>
  );
}
