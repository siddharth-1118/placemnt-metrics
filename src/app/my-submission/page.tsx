import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/dto";
import { StudentSummaryCard, ScrapeCards } from "@/components/dashboard/read-only-cards";
import { DocumentUploader } from "@/components/student/document-uploader";
import { LinkManager } from "@/components/student/link-manager";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "My submission | SRM Placement Portal",
};

export default async function MySubmissionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const row = await prisma.student.findUnique({
    where: { id: user.id },
    include: { scrapes: true, documents: true, projectLinks: true },
  });
  if (!row) redirect("/student/submit");

  const student = toDto(row);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
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
            <Button variant="outline">Update profile</Button>
          </Link>
        </div>
      </div>

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
        <DocumentUploader />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">Project links</h2>
        </div>
        <LinkManager />
      </section>
    </div>
  );
}
