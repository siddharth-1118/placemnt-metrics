"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui";

export function UserMenu({
  user,
}: {
  user: {
    fullName: string;
    role: string;
    isSuperAdmin?: boolean;
    evaluatorAssigned: boolean;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_2px_8px_-2px_hsl(245_65%_40%/0.5),inset_0_1px_0_hsl(0_0%_100%/0.25)] transition-all hover:brightness-[1.06] active:scale-[0.98]"
      >
        Sign in
      </Link>
    );
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const roleLabel =
    user.role === "COORDINATOR"
      ? user.isSuperAdmin
        ? "Super admin"
        : user.evaluatorAssigned
          ? "Evaluator"
          : "Coordinator"
      : "Student";

  return (
    <div className="flex items-center gap-1.5">
      <span className="glass-inset hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium lg:inline-flex">
        <UserRound className="h-3.5 w-3.5 opacity-60" />
        <span className="max-w-[140px] truncate">{user.fullName}</span>
        <span className="text-muted-foreground">· {roleLabel}</span>
      </span>
      {/* Icons-only on small screens to keep the pill header on one line. */}
      <Link
        href="/my-submission"
        aria-label="My portal"
        title="My portal"
        className="rounded-xl px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground sm:px-3"
      >
        <span className="hidden sm:inline">My portal</span>
        <span className="sm:hidden">Portal</span>
      </Link>
      {user.role === "COORDINATOR" && user.evaluatorAssigned && (
        <Link
          href="/coordinator/dashboard"
          aria-label="Dashboard"
          title="Dashboard"
          className="rounded-xl px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground sm:px-3"
        >
          Dashboard
        </Link>
      )}
      <Button variant="ghost" size="sm" onClick={signOut} disabled={busy} title="Sign out">
        <LogOut className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
