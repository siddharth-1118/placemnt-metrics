/**
 * SRM Placement Portal — CLI Database Backup Script
 *
 * Usage:
 *   npm run db:backup
 *
 * Exports all database records (Student, Document, ProjectLink, Setting,
 * PasswordResetRequest, ScrapeResult, Notification) to a local JSON file in
 * ./backups/ and mirrors to Supabase Storage if configured.
 */
import { prisma } from "../src/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== SRM PLACEMENT PORTAL: CREATING DATABASE BACKUP ===");

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
    exportedBy: "cli:backup-db",
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

  // 1. Save locally to ./backups/
  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `backup_${dateStr}_${timeStr}.json`;
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, jsonStr, "utf8");

  console.log(`✓ Local backup saved: ${filePath}`);
  console.log(`  - Students: ${students.length}`);
  console.log(`  - Documents: ${documents.length}`);
  console.log(`  - Project Links: ${projectLinks.length}`);
  console.log(`  - Settings: ${settings.length}`);
  console.log(`  - Password Resets: ${passwordResetRequests.length}`);
  console.log(`  - Scrapes: ${scrapeResults.length}`);
  console.log(`  - Notifications: ${notifications.length}`);
  console.log(`  - Total File Size: ${(Buffer.byteLength(jsonStr) / 1024).toFixed(1)} KB`);

  // 2. Best-effort mirror to Supabase Storage
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const storageKey = `_backups/${filename}`;
      const { error } = await client.storage
        .from("placement-documents")
        .upload(storageKey, Buffer.from(jsonStr), {
          contentType: "application/json",
          upsert: true,
        });
      if (error) {
        console.warn(`  ! Cloud mirror notice: ${error.message}`);
      } else {
        console.log(`✓ Cloud mirror saved to Supabase Storage: placement-documents/${storageKey}`);
      }
    } catch (e) {
      console.warn("  ! Cloud mirror error:", (e as Error).message);
    }
  }

  console.log("\nBackup completed successfully. Your data is 100% safe.");
}

main()
  .catch((e) => {
    console.error("Backup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
