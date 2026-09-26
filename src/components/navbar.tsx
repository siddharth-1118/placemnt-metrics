"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  Menu,
  X,
  LogIn,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-provider";

interface NavbarProps {
  user: {
    fullName: string;
    role: string;
    evaluatorAssigned: boolean;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
      setMobileOpen(false);
    }
  }

  const isStudent = user?.role === "STUDENT";
  const isCoordinator = user?.role === "COORDINATOR";

  type NavLink = {
    href: string;
    label: string;
  };

  let navLinks: NavLink[] = [];

  if (isCoordinator) {
    navLinks = [
      { href: "/coordinator/dashboard", label: "Dashboard" },
      { href: "/coordinator/dashboard#students", label: "Students" },
      { href: "/#matrix", label: "Placement Matrix" },
      { href: "/coordinator/dashboard#scores", label: "Scores" },
      { href: "/coordinator/dashboard#reports", label: "Reports" },
    ];
  } else if (isStudent) {
    navLinks = [
      { href: "/my-submission", label: "Dashboard" },
      { href: "/#matrix", label: "Placement Matrix" },
      { href: "/my-submission#score", label: "My Score" },
      { href: "/my-submission#profile", label: "Profile" },
    ];
  } else {
    navLinks = [
      { href: "/", label: "Home" },
      { href: "/#matrix", label: "Placement Matrix" },
      { href: "/student/submit", label: "Register" },
      { href: "/login", label: "Login" },
    ];
  }

  const roleLabel = isCoordinator
    ? user.evaluatorAssigned
      ? "Evaluator"
      : "Coordinator"
    : isStudent
    ? "Student"
    : "Guest";

  return (
    <header className="sticky top-0 z-50 border-b border-[#ded9ce] bg-white transition-colors dark:border-[#262f3c] dark:bg-[#161c24]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Institution Branding */}
        <Link
          href="/"
          className="flex items-center gap-2.5 transition hover:opacity-90"
          onClick={() => setMobileOpen(false)}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#165b33] text-white">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm font-bold tracking-tight text-[#1c2024] dark:text-white">
                SRM
              </span>
              <span className="text-[11px] font-medium text-[#5c6470] dark:text-[#94a3b8]">
                School of Computing
              </span>
            </div>
            <span className="text-[11px] text-[#71717a] dark:text-[#a1a1aa] leading-tight">
              Placement Matrix Portal
            </span>
          </div>
        </Link>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden items-center space-x-1 md:flex">
          {navLinks.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && !item.href.includes("#") && pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-[#eaf4ed] text-[#165b33] font-semibold dark:bg-[#153422] dark:text-[#78d69f]"
                    : "text-[#474f5a] hover:bg-[#f2efe9] hover:text-[#1c2024] dark:text-[#cbd5e1] dark:hover:bg-[#232b36] dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: User Profile & Actions */}
        <div className="hidden items-center gap-2.5 md:flex">
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded border border-[#ded9ce] bg-[#f9f8f5] px-2.5 py-1 text-xs dark:border-[#2a3341] dark:bg-[#1b222c]">
                <div className="flex flex-col text-left">
                  <span className="max-w-[130px] truncate text-xs font-semibold text-[#1c2024] dark:text-white">
                    {user.fullName}
                  </span>
                  <span className="text-[10px] text-[#6b7280] dark:text-[#94a3b8]">
                    {roleLabel}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
                className="h-8 gap-1.5 text-xs text-[#a82424] hover:bg-[#fdeded] hover:border-[#f7bebe] dark:hover:bg-[#3d1818]"
              >
                <LogOut className="h-3 w-3" />
                <span>Logout</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  <LogIn className="mr-1 h-3 w-3" />
                  Login
                </Button>
              </Link>
              <Link href="/student/submit">
                <Button
                  size="sm"
                  className="h-8 gap-1 px-3 text-xs bg-[#165b33] text-white hover:bg-[#124929]"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>Register</span>
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger & Theme Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#ded9ce] bg-white text-[#1c2024] transition hover:bg-[#f2efe9] dark:border-[#2a3341] dark:bg-[#1b222c] dark:text-[#f0ede6] focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-[#ded9ce] bg-white p-3.5 shadow-md dark:border-[#262f3c] dark:bg-[#161c24] md:hidden">
          {user && (
            <div className="mb-2.5 flex items-center justify-between border-b border-[#ded9ce] pb-2.5 dark:border-[#262f3c]">
              <div>
                <p className="text-xs font-bold text-[#1c2024] dark:text-white">{user.fullName}</p>
                <p className="text-[11px] text-[#6b7280] dark:text-[#94a3b8]">{roleLabel}</p>
              </div>
            </div>
          )}

          <nav className="flex flex-col space-y-1">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-[#eaf4ed] text-[#165b33] font-semibold dark:bg-[#153422] dark:text-[#78d69f]"
                      : "text-[#474f5a] hover:bg-[#f2efe9] dark:text-[#cbd5e1] dark:hover:bg-[#232b36]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 border-t border-[#ded9ce] pt-2.5 dark:border-[#262f3c]">
            {user ? (
              <Button
                variant="outline"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full justify-center gap-1.5 text-xs text-[#a82424]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full justify-center text-xs">
                    Login
                  </Button>
                </Link>
                <Link href="/student/submit" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full justify-center bg-[#165b33] text-xs text-white hover:bg-[#124929]">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
