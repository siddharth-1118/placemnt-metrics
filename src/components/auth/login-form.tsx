"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function performLogin(targetEmail: string, targetPass: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim().toLowerCase(), password: targetPass }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Invalid email or password. Please try again.");
        return;
      }
      const u = body.user;
      if (u.role === "COORDINATOR" && u.evaluatorAssigned) {
        router.push("/coordinator/dashboard");
      } else {
        router.push("/my-submission");
      }
      router.refresh();
    } catch {
      setError("Network connection error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(email, password);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded border border-[#f8c4c4] bg-[#fdeded] p-2.5 text-xs text-[#a82424] dark:border-[#5e2626] dark:bg-[#3d1818] dark:text-[#f38d8d]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {/* Email / Register Number Field */}
        <div className="space-y-1 text-left">
          <Label htmlFor="email">
            Email / Register Number
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="student@srmist.edu.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-xs h-9"
            required
          />
        </div>

        {/* Password Field */}
        <div className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-[#165b33] hover:underline dark:text-[#78d69f]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-9 text-xs h-9"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#88909c] hover:text-[#1c2024] dark:hover:text-[#f0ede6]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Login Button */}
        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-[#165b33] text-white hover:bg-[#124929] h-9 text-xs font-semibold shadow-sm"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Logging in…</span>
            </>
          ) : (
            <span>Login</span>
          )}
        </Button>

        {/* Don't have an account link */}
        <div className="border-t border-[#e2ded5] pt-3 text-center text-xs text-[#5c6470] dark:border-[#262f3c] dark:text-[#94a3b8]">
          <span>Don&apos;t have an account? </span>
          <Link
            href="/student/submit"
            className="font-semibold text-[#165b33] hover:underline dark:text-[#78d69f]"
          >
            Register
          </Link>
        </div>
      </form>

      {/* Quick Testing Access Helper */}
      <details className="rounded border border-[#e2ded5] bg-[#faf8f5] p-2.5 text-left text-xs dark:border-[#262f3c] dark:bg-[#161c24]">
        <summary className="cursor-pointer font-medium text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white">
          Quick Demo Credentials
        </summary>
        <div className="mt-2.5 grid grid-cols-1 gap-1.5 pt-2 border-t border-[#e2ded5] dark:border-[#262f3c]">
          <button
            type="button"
            onClick={() => {
              setEmail("coordinator@srmist.edu.in");
              setPassword("evaluator123");
              performLogin("coordinator@srmist.edu.in", "evaluator123");
            }}
            disabled={busy}
            className="flex items-center justify-between rounded border border-[#ded9ce] bg-white p-2 text-left hover:bg-[#f2efe9] dark:border-[#323d4c] dark:bg-[#1b222c]"
          >
            <div>
              <p className="text-xs font-semibold text-[#1c2024] dark:text-white">Dr. Ramesh (Coordinator)</p>
              <p className="text-[10px] text-[#5c6470] dark:text-[#94a3b8]">coordinator@srmist.edu.in</p>
            </div>
            <span className="text-[11px] font-semibold text-[#165b33] dark:text-[#78d69f]">Login &rarr;</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEmail("student@srmist.edu.in");
              setPassword("student123");
              performLogin("student@srmist.edu.in", "student123");
            }}
            disabled={busy}
            className="flex items-center justify-between rounded border border-[#ded9ce] bg-white p-2 text-left hover:bg-[#f2efe9] dark:border-[#323d4c] dark:bg-[#1b222c]"
          >
            <div>
              <p className="text-xs font-semibold text-[#1c2024] dark:text-white">Arjun Kumar (Student)</p>
              <p className="text-[10px] text-[#5c6470] dark:text-[#94a3b8]">student@srmist.edu.in</p>
            </div>
            <span className="text-[11px] font-semibold text-[#165b33] dark:text-[#78d69f]">Login &rarr;</span>
          </button>
        </div>
      </details>
    </div>
  );
}
