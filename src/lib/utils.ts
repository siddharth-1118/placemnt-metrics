import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract a GitHub login from a profile URL (accepts bare logins too). */
export function parseGithubLogin(url: string): string | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/?$/i);
  return m ? m[1] : null;
}

/** Extract a LeetCode username from a profile URL (accepts bare handles too). */
export function parseLeetcodeUser(url: string): string | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/(?:u\/)?([A-Za-z0-9_-]{1,39})\/?$/i);
  return m ? m[1] : null;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
