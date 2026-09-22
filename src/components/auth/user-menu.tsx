"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui";

export function UserMenu({
  user,
}: {
  user: { fullName: string; role: string; evaluatorAssigned: boolean } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
      ? user.evaluatorAssigned
        ? "Evaluator"
        : "Coordinator"
      : "Student";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs sm:inline-flex">
        <UserRound className="h-3.5 w-3.5" />
        {user.fullName} · {roleLabel}
      </span>
      <Link
        href="/my-submission"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        My portal
      </Link>
      {user.role === "COORDINATOR" && user.evaluatorAssigned && (
        <Link
          href="/coordinator/dashboard"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Dashboard
        </Link>
      )}
      <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </Button>
    </div>
  );
}
