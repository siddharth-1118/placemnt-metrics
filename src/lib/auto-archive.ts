/**
 * Automated Portal Archiving & Continuous Snapshot Engine
 *
 * Automatically saves full isolated snapshots of all portal data:
 *   1. Everyday (daily automated baseline)
 *   2. Whenever updates come in (student submission, coordinator scoring,
 *      document verification, score recalculation)
 *
 * Stored in separate isolated locations (disk + Supabase Storage `_archives/`)
 * so operational edits or deletions can never affect past historical records.
 */

import { prisma } from "@/lib/prisma";
import * as fs from "node:fs";
import * as path from "node:path";

export type ArchiveTrigger =
  | "DAILY_AUTO"
  | "STUDENT_UPDATE"
  | "COORDINATOR_UPDATE"
  | "VERIFICATION"
  | "RECALCULATION"
  | "MANUAL";

export interface ArchiveEntry {
  id: string;
  filename: string;
  trigger: ArchiveTrigger;
  reason: string;
  timestamp: string;
  studentCount: number;
  docCount: number;
  linkCount: number;
  sizeKb: number;
  storageKey: string;
}

const MANIFEST_KEY = "portal_archives_manifest";
let lastCaptureTime = 0;
let lastCaptureTrigger: ArchiveTrigger | null = null;

/**
 * Capture an isolated, full-portal snapshot.
 * Debounced: avoids running concurrently or repeating within 10 seconds for the same trigger.
 */
export async function capturePortalArchive(
  trigger: ArchiveTrigger,
  reason: string = "Automated portal update snapshot"
): Promise<ArchiveEntry | null> {
  const now = Date.now();
  if (trigger !== "MANUAL" && trigger !== "DAILY_AUTO" && trigger === lastCaptureTrigger && now - lastCaptureTime < 10000) {
    return null; // Debounce rapid keystrokes/uploads
  }
  lastCaptureTime = now;
  lastCaptureTrigger = trigger;

  try {
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
    const timeStr = timestamp.slice(11, 19).replace(/[:.]/g, "-");
    const id = `arch_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const filename = `snapshot_${dateStr}_${timeStr}_${trigger}.json`;

    const snapshot = {
      app: "srm-placement-ranking-portal",
      version: "1.0.0",
      id,
      timestamp,
      trigger,
      reason,
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
    const sizeKb = Number((Buffer.byteLength(jsonStr) / 1024).toFixed(1));
    const storageKey = `_archives/${filename}`;

    // 1. Save to local disk archives directory
    try {
      const diskDir = path.resolve(process.cwd(), "backups", "archives");
      if (!fs.existsSync(diskDir)) {
        fs.mkdirSync(diskDir, { recursive: true });
      }
      fs.writeFileSync(path.join(diskDir, filename), jsonStr, "utf8");
    } catch (err) {
      console.warn("[auto-archive] Local disk write warning:", (err as Error).message);
    }

    // 2. Mirror to cloud Supabase Storage `_archives/`
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await client.storage
          .from("placement-documents")
          .upload(storageKey, Buffer.from(jsonStr), {
            contentType: "application/json",
            upsert: true,
          });
      }
    } catch (storageErr) {
      console.warn("[auto-archive] Supabase mirror notice:", (storageErr as Error).message);
    }

    // 3. Update the manifest record in Setting table
    const newEntry: ArchiveEntry = {
      id,
      filename,
      trigger,
      reason,
      timestamp,
      studentCount: students.length,
      docCount: documents.length,
      linkCount: projectLinks.length,
      sizeKb,
      storageKey,
    };

    let manifest: ArchiveEntry[] = [];
    try {
      const setting = await prisma.setting.findUnique({ where: { key: MANIFEST_KEY } });
      if (setting?.value) {
        manifest = JSON.parse(setting.value);
      }
    } catch {
      manifest = [];
    }

    manifest.unshift(newEntry);
    if (manifest.length > 60) manifest = manifest.slice(0, 60); // keep newest 60 snapshots

    await prisma.setting.upsert({
      where: { key: MANIFEST_KEY },
      update: { value: JSON.stringify(manifest) },
      create: { key: MANIFEST_KEY, value: JSON.stringify(manifest) },
    });

    return newEntry;
  } catch (e) {
    console.error("[auto-archive] Failed to create portal snapshot:", e);
    return null;
  }
}

/**
 * Fetch list of all historical archives from manifest.
 */
export async function getArchiveManifest(): Promise<ArchiveEntry[]> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: MANIFEST_KEY } });
    if (setting?.value) {
      return JSON.parse(setting.value);
    }
  } catch {
    // fallback to disk
  }

  // Fallback: discover files from backups/archives on disk
  try {
    const diskDir = path.resolve(process.cwd(), "backups", "archives");
    if (fs.existsSync(diskDir)) {
      const files = fs.readdirSync(diskDir).filter((f) => f.endsWith(".json")).reverse();
      return files.map((f, idx) => ({
        id: `disk_${idx}`,
        filename: f,
        trigger: f.includes("DAILY") ? "DAILY_AUTO" : "MANUAL",
        reason: "Disk snapshot file",
        timestamp: fs.statSync(path.join(diskDir, f)).mtime.toISOString(),
        studentCount: 0,
        docCount: 0,
        linkCount: 0,
        sizeKb: Number((fs.statSync(path.join(diskDir, f)).size / 1024).toFixed(1)),
        storageKey: `_archives/${f}`,
      }));
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Load full snapshot content by filename (from disk or Supabase).
 */
export async function getArchiveContent(filename: string): Promise<string | null> {
  const safeFilename = path.basename(filename);

  // 1. Check local disk
  const diskPath = path.resolve(process.cwd(), "backups", "archives", safeFilename);
  if (fs.existsSync(diskPath)) {
    return fs.readFileSync(diskPath, "utf8");
  }

  // 2. Check Supabase Storage
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.storage
        .from("placement-documents")
        .download(`_archives/${safeFilename}`);
      if (!error && data) {
        return await data.text();
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Ensure today's automated daily baseline snapshot has been taken.
 */
export async function ensureDailyArchive(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const manifest = await getArchiveManifest();
    const hasTodayDaily = manifest.some(
      (m) => m.trigger === "DAILY_AUTO" && m.timestamp.slice(0, 10) === today
    );

    if (!hasTodayDaily) {
      await capturePortalArchive("DAILY_AUTO", `Daily automated baseline snapshot for ${today}`);
    }
  } catch (err) {
    console.warn("[auto-archive] ensureDailyArchive error:", (err as Error).message);
  }
}
