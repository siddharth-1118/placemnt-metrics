import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getArchiveManifest, capturePortalArchive, ensureDailyArchive } from "@/lib/auto-archive";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/archives — List all historical portal snapshots.
 * Super Admin only. Also verifies daily snapshot on check.
 */
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  await ensureDailyArchive();
  const archives = await getArchiveManifest();

  return NextResponse.json({ ok: true, archives });
}

/**
 * POST /api/admin/archives — Trigger a new snapshot right now.
 */
export async function POST(req: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const reason = body?.reason || `Manual snapshot taken by ${user.fullName}`;

  const entry = await capturePortalArchive("MANUAL", reason);

  if (!entry) {
    return NextResponse.json({ error: "Failed to create snapshot" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Historical snapshot created and preserved in separate storage.",
    entry,
  });
}
