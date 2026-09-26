import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/migrate";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/setup — one-shot schema self-healing for the deployed app.
 *
 * When the database is missing any of the permission / scope / score columns,
 * EVERY page throws "Application error: a server-side exception" because the
 * root layout resolves the session (which selects those columns). This
 * endpoint applies the same idempotent statements as
 * supabase/additions-v3.sql — no SQL editor needed:
 *
 *     https://placement-metrics.vercel.app/api/setup?token=<SETUP_TOKEN>
 *
 * Guarded by the SETUP_TOKEN environment variable (set it in Vercel →
 * Project → Settings → Environment Variables, any long random string).
 * When SETUP_TOKEN is unset the endpoint reports "disabled" and changes
 * nothing, so it is safe to deploy.
 *
 * Never destructive: it only ADDs missing columns, creates the super admin
 * when the account is absent, promotes sv3824, and expands legacy scope
 * keys. Scores and passwords are never touched.
 */
function unauthorized(reason: string) {
  return NextResponse.json({ ok: false, error: reason }, { status: 403 });
}

async function run(req: Request) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Setup endpoint is disabled — set the SETUP_TOKEN environment variable in Vercel to enable it.",
      },
      { status: 503 }
    );
  }
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token !== expected) return unauthorized("Invalid token");

  const result = await ensureSchema();

  // Post-fix sanity probe: can we select the columns the app needs?
  let probe: { ok: boolean; error?: string } = { ok: false };
  try {
    await prisma.student.findFirst({
      select: { id: true, isSuperAdmin: true, permissionScopes: true, scoreShl: true },
    });
    probe = { ok: true };
  } catch (e) {
    probe = { ok: false, error: (e as Error).message.slice(0, 300) };
  }

  return NextResponse.json({
    ok: result.ok && probe.ok,
    addedColumns: result.addedColumns,
    adminCreated: result.adminCreated,
    adminPromoted: result.adminPromoted,
    scopesMigrated: result.scopesMigrated,
    error: result.error,
    probe,
    hint: result.ok
      ? "Schema is ready. Open the app and sign in again — no redeploy needed."
      : "Some statements failed — check `error` above (most often the DATABASE_URL points at the wrong database).",
  });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
