import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { GraduationCap } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";

export const metadata: Metadata = {
  title: {
    default: "SRM Placement Ranking Portal",
    template: "%s · SRM Placement Portal",
  },
  description:
    "School of Computing placement ranking system (AO1 batch) — verified coding profiles and coordinator evaluation.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-4.5 w-4.5" />
              </span>
              <span>
                SRM <span className="text-muted-foreground font-normal">Placement Portal</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/student/submit"
                className="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Student
              </Link>
              <Link
                href="/coordinator/dashboard"
                className="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Coordinator
              </Link>
              <UserMenu
                user={
                  user
                    ? { fullName: user.fullName, role: user.role, evaluatorAssigned: user.evaluatorAssigned }
                    : null
                }
              />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-4">
          <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground sm:px-6">
            SRM Institute of Science and Technology · School of Computing · Placement Ranking System (AO1 Batch)
          </div>
        </footer>
      </body>
    </html>
  );
}
