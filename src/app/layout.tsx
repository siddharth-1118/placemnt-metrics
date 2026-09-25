import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { GraduationCap, Compass, ClipboardCheck, LayoutDashboard } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";

export const metadata: Metadata = {
  title: {
    default: "SRM Placement Portal",
    template: "%s · SRM Placement Portal",
  },
  description:
    "School of Computing placement ranking system (AO1 batch) — verified coding profiles and coordinator evaluation.",
};

const NAV = [
  { href: "/student/submit", label: "Submit", icon: ClipboardCheck },
  { href: "/coordinator/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-submission", label: "My portal", icon: Compass },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        {/* Ambient backdrop: aurora fields + film grain (see globals.css) */}
        <div className="aurora" aria-hidden="true">
          <span className="aurora-ember" />
        </div>
        <div className="grain" aria-hidden="true" />

        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
          <div className="glass-strong mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-3 sm:px-4">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(262_95%_68%)] via-[hsl(258_90%_62%)] to-[hsl(320_85%_60%)] text-white shadow-[0_2px_14px_-2px_hsl(275_90%_60%/0.6)] transition-transform duration-300 group-hover:rotate-[-6deg]">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="text-[15px] font-semibold tracking-[-0.02em]">
                SRM
                <span className="ml-1.5 font-normal text-muted-foreground">Placement Portal</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-0.5 text-sm md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
                >
                  <item.icon className="h-3.5 w-3.5 opacity-70" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <UserMenu
              user={
                user
                  ? {
                      fullName: user.fullName,
                      role: user.role,
                      isSuperAdmin: user.isSuperAdmin,
                      evaluatorAssigned: user.canViewSubmissions,
                    }
                  : null
              }
            />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="px-3 pb-5 pt-2 sm:px-5">
          <div className="mx-auto max-w-6xl">
            <div className="glass rounded-2xl px-5 py-3.5 text-center text-xs text-muted-foreground">
              SRM Institute of Science and Technology · School of Computing · Placement Ranking
              System (AO1 Batch)
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
