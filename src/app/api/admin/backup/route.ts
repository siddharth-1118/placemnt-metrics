import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { DOCUMENT_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/backup — Export a full database snapshot (JSON).
 * Super-admin only.
 */
export async function GET() {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;

  const [
    students,
    documents,
    projectLinks,
    settings,
    passwordResetRequests,
    scrapeResults,
    notifications,
  ] = await Promise.all([
    prisma.student.findMany(),
    prisma.document.findMany(),
    prisma.projectLink.findMany(),
    prisma.setting.findMany(),
    prisma.passwordResetRequest.findMany(),
    prisma.scrapeResult.findMany(),
    prisma.notification.findMany(),
  ]);

  const timestamp = new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);
  const timeStr = timestamp.slice(11, 16).replace(":", "-");

  const snapshot = {
    app: "srm-placement-ranking-portal",
    version: "1.0.0",
    timestamp,
    exportedBy: user.email,
    counts: {
      students: students.length,
      documents: documents.length,
      projectLinks: projectLinks.length,
      settings: settings.length,
      passwordResetRequests: passwordResetRequests.length,
      scrapeResults: scrapeResults.length,
      notifications: notifications.length,
    },
    data: {
      students,
      documents,
      projectLinks,
      settings,
      passwordResetRequests,
      scrapeResults,
      notifications,
    },
  };

  const jsonStr = JSON.stringify(snapshot, null, 2);

  // Best-effort: Save a cloud copy to Supabase Storage if configured
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const backupKey = `_backups/backup_${dateStr}_${timeStr}.json`;
      await client.storage
        .from(DOCUMENT_BUCKET)
        .upload(backupKey, Buffer.from(jsonStr), {
          contentType: "application/json",
          upsert: true,
        });
    }
  } catch (storageErr) {
    console.warn("[backup] Cloud backup mirror warning:", (storageErr as Error).message);
  }

  const filename = `srm_placement_backup_${dateStr}_${timeStr}.json`;

  return new NextResponse(jsonStr, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
