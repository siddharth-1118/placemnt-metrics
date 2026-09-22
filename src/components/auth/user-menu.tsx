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
      ? user.evaluatorAssigned
        ? "Evaluator"
        : "Coordinator"
      : "Student";

  return (
    <div className="flex items-center gap-1.5">
      <span className="glass-inset hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex">
        <UserRound className="h-3.5 w-3.5 opacity-60" />
        {user.fullName} · {roleLabel}
      </span>
      <Link
        href="/my-submission"
        className="rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
      >
        My portal
      </Link>
      {user.role === "COORDINATOR" && user.evaluatorAssigned && (
        <Link
          href="/coordinator/dashboard"
          className="rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
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
