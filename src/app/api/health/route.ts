import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — deployment diagnostic.
 *
 * Checks, in order: database reachable + tables exist, and storage driver
 * selection. Returns 200 with per-check details; check `db.ok`/`storage.ok`
 * in the JSON to pinpoint a broken deployment (e.g. missing tables → the
 * SQL from supabase/setup.sql has not been run yet).
 */
export async function GET() {
  const checks: {
    db?: { ok: boolean; provider?: string; error?: string };
    tables?: { ok: boolean; error?: string; hint?: string };
    storage?: { ok: boolean; driver: string; bucket: string };
  } = {};

  // Build stamp — compare against the latest commit on GitHub to spot a
  // stale deployment (e.g. "academic marks not calculating" is usually just
  // an old build still serving traffic).
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.APP_VERSION ??
    "local-dev";

  // 1. Database connectivity + schema presence.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true, provider: (process.env.DATABASE_URL ?? "").startsWith("postgres") ? "postgresql" : "sqlite" };
  } catch (e) {
    checks.db = { ok: false, error: (e as Error).message.slice(0, 300) };
    return NextResponse.json({ ok: false, checks }, { status: 200 });
  }

  try {
    await prisma.student.findFirst({ select: { id: true } });
    checks.tables = { ok: true };
  } catch (e) {
    checks.tables = {
      ok: false,
      error: (e as Error).message.slice(0, 300),
      hint: "Tables missing — run supabase/setup.sql in the Supabase SQL editor",
    };
  }

  // 2. Storage driver selection (no network call — config presence only).
  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  checks.storage = {
    ok: true,
    driver: hasSupabase ? "supabase" : "disk",
    bucket: "placement-documents",
  };

  const ok = checks.db?.ok === true && checks.tables?.ok === true;
  return NextResponse.json({ ok, version, checks }, { status: 200 });
}
