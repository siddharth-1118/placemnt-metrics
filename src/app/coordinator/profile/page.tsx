import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Eye,
  GraduationCap,
  KeyRound,
  Mail,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCORE_SCOPE_LABELS, scopesAreFull } from "@/lib/scopes";
import { ChangePasswordCard } from "@/components/student/change-password";
import { Badge, Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "My Profile",
};

/**
 * Coordinator self-profile — the account page for faculty coordinators and
 * the super admin: who they are, what they may view & score, which rubric
 * sections are assigned to them, and password management. Read-only except
 * for the password (self-service rotation), since roles and scopes are
 * managed exclusively by the super admin.
 */
export default async function CoordinatorProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Students already have their own dashboard/profile at /my-submission.
  if (user.role !== "COORDINATOR") redirect("/my-submission");

  // Fresh row for the fields the session doesn't carry.
  const row = await prisma.student.findUnique({
    where: { id: user.id },
    select: { createdAt: true, tenthPercent: true, twelfthPercent: true, cgpa: true },
  });
  const hasOwnSubmission =
    !!row && (row.tenthPercent > 0 || row.twelfthPercent > 0 || row.cgpa > 0);

  const fullAccess = scopesAreFull(user.permissionScopes);
  const roleLabel = user.isSuperAdmin
    ? "Super Admin"
    : user.canScore
      ? "Evaluator"
      : "Coordinator";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[#e2ded5] pb-4 dark:border-[#262f3c] sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#165b33] text-lg font-bold text-white">
            {user.fullName.charAt(0).toUpperCase()}
          </span>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5c6470] dark:text-[#94a3b8]">
              My Profile
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#1c2024] dark:text-white">
              {user.fullName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={user.isSuperAdmin ? "success" : "secondary"}>
                {user.isSuperAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                {roleLabel}
              </Badge>
              {user.canScore && <Badge variant="success">Can score &amp; verify</Badge>}
              {!user.canViewSubmissions && <Badge variant="warning">No evaluation access</Badge>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/coordinator/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
          {hasOwnSubmission && (
            <Link href="/my-submission">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <GraduationCap className="h-3.5 w-3.5" />
                <span>My Submission</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Account details */}
      <div className="rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div className="border-b border-[#e2ded5] p-4 dark:border-[#262f3c]">
          <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">Account details</h2>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Your identity on the placement portal. Name, email and role are managed by the
            super admin / placement cell.
          </p>
        </div>
        <div className="grid gap-x-6 gap-y-4 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c6470] dark:text-[#94a3b8]">
              Full name
            </p>
            <p className="mt-0.5 font-semibold text-[#1c2024] dark:text-white">{user.fullName}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5c6470] dark:text-[#94a3b8]">
              <Mail className="h-3 w-3" /> Email
            </p>
            <p className="mt-0.5 font-semibold text-[#1c2024] dark:text-white">{user.email}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c6470] dark:text-[#94a3b8]">
              Register number
            </p>
            <p className="mt-0.5 font-mono font-semibold text-[#1c2024] dark:text-white">
              {user.registerNumber}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5c6470] dark:text-[#94a3b8]">
              <CalendarDays className="h-3 w-3" /> Member since
            </p>
            <p className="mt-0.5 font-semibold text-[#1c2024] dark:text-white">
              {row?.createdAt
                ? new Date(row.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Evaluation permissions */}
      <div className="rounded-md border border-[#e2ded5] bg-white dark:border-[#262f3c] dark:bg-[#1b222c]">
        <div className="border-b border-[#e2ded5] p-4 dark:border-[#262f3c]">
          <h2 className="text-sm font-bold text-[#1c2024] dark:text-white">
            Evaluation permissions
          </h2>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            What you can view and score on the coordinator dashboard. Assigned by the super
            admin — request changes there.
          </p>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold ${
                user.canViewSubmissions
                  ? "border-[#b8ddc4] bg-[#eaf4ed] text-[#165b33] dark:border-[#265335] dark:bg-[#133822] dark:text-[#78d69f]"
                  : "border-[#e2ded5] bg-[#faf8f5] text-[#5c6470] dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#94a3b8]"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {user.canViewSubmissions ? "View submissions — granted" : "View submissions — not granted"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold ${
                user.canScore
                  ? "border-[#b8ddc4] bg-[#eaf4ed] text-[#165b33] dark:border-[#265335] dark:bg-[#133822] dark:text-[#78d69f]"
                  : "border-[#e2ded5] bg-[#faf8f5] text-[#5c6470] dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#94a3b8]"
              }`}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {user.canScore ? "Score & verify — granted" : "Score & verify — not granted"}
            </span>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5c6470] dark:text-[#94a3b8]">
              <PencilLine className="h-3 w-3" /> Assigned rubric sections
            </p>
            {fullAccess ? (
              <p className="mt-1.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
                <span className="font-semibold text-[#165b33] dark:text-[#78d69f]">
                  All sections
                </span>{" "}
                — unrestricted access to every rubric section and its evidence.
              </p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {user.permissionScopes.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-[#d6cfc0] bg-[#faf8f5] px-2 py-0.5 text-xs font-medium text-[#1c2024] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#f0ede6]"
                  >
                    {SCORE_SCOPE_LABELS[s]}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
              Academic, GitHub and LeetCode scores are calculated automatically from the
              student&apos;s marks and live profile scrapes — coordinators enter the remaining
              sections assigned above.
            </p>
          </div>
        </div>
      </div>

      {/* Password — same self-service card students use */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.015em]">
            <KeyRound className="h-4 w-4 text-[#165b33]" />
            Account security
          </h2>
          <p className="text-sm text-[#5c6470] dark:text-[#94a3b8]">
            Replace a temporary password with your own. Your session stays signed in.
          </p>
        </div>
        <ChangePasswordCard />
      </section>
    </div>
  );
}
