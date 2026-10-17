/**
 * SRM Placement Portal — CLI Database Restore Script
 *
 * Usage:
 *   npm run db:restore [optional-path-to-backup.json]
 *
 * Restores database records using idempotent upserts (matching original IDs)
 * so documents and storage files remain cleanly connected.
 */
import { prisma } from "../src/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== SRM PLACEMENT PORTAL: DATABASE RESTORE ===");

  let targetFile = process.argv[2];

  if (!targetFile) {
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      console.error("No backups directory found and no backup file specified.");
      console.error("Usage: npm run db:restore [path/to/backup.json]");
      process.exit(1);
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error("No backup .json files found in ./backups/");
      process.exit(1);
    }

    targetFile = path.join(backupDir, files[0]);
    console.log(`Auto-selected latest backup: ${targetFile}`);
  }

  const resolvedPath = path.resolve(process.cwd(), targetFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Backup file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const data = parsed?.data;

  if (!data || !Array.isArray(data.students)) {
    console.error("Invalid backup file format: missing 'data.students' array.");
    process.exit(1);
  }

  console.log(`Reading snapshot created: ${parsed.timestamp || "Unknown"}`);
  console.log(`Students in snapshot: ${data.students.length}`);
  console.log(`Documents in snapshot: ${data.documents?.length || 0}`);
  console.log(`Project Links in snapshot: ${data.projectLinks?.length || 0}`);

  let restoredStudents = 0;
  let restoredDocuments = 0;
  let restoredLinks = 0;
  let restoredSettings = 0;

  // 1. Students
  for (const s of data.students) {
    try {
      const studentData = {
        registerNumber: s.registerNumber,
        fullName: s.fullName,
        email: s.email,
        facultyAdvisor: s.facultyAdvisor ?? null,
        tenthPercent: Number(s.tenthPercent ?? 0),
        twelfthPercent: Number(s.twelfthPercent ?? 0),
        cgpa: Number(s.cgpa ?? 0),
        sgpaSem1: Number(s.sgpaSem1 ?? 0),
        sgpaSem2: Number(s.sgpaSem2 ?? 0),
        githubUrl: s.githubUrl ?? null,
        leetcodeUrl: s.leetcodeUrl ?? null,
        proofUrls: typeof s.proofUrls === "string" ? s.proofUrls : JSON.stringify(s.proofUrls ?? []),
        role: s.role ?? "STUDENT",
        evaluatorAssigned: Boolean(s.evaluatorAssigned),
        isSuperAdmin: Boolean(s.isSuperAdmin),
        canViewSubmissions: Boolean(s.canViewSubmissions),
        canScore: Boolean(s.canScore),
        permissionScopes: typeof s.permissionScopes === "string" ? s.permissionScopes : JSON.stringify(s.permissionScopes ?? []),
        passwordHash: s.passwordHash ?? null,
        claimablePassword: Boolean(s.claimablePassword),
        status: s.status ?? "PENDING",
        coordinatorNote: s.coordinatorNote ?? null,
        verifiedById: s.verifiedById ?? null,
        verifiedByName: s.verifiedByName ?? null,
        verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : null,
        scoreAudit: typeof s.scoreAudit === "string" ? s.scoreAudit : JSON.stringify(s.scoreAudit ?? []),
        uploadToken: s.uploadToken ?? s.id,
        scoreAcademic: Number(s.scoreAcademic ?? 0),
        scoreGithub: Number(s.scoreGithub ?? 0),
        scoreCoding: Number(s.scoreCoding ?? 0),
        scoreInternship: Number(s.scoreInternship ?? 0),
        scoreCertifications: Number(s.scoreCertifications ?? 0),
        scoreProjects: Number(s.scoreProjects ?? 0),
        scoreFullstack: Number(s.scoreFullstack ?? 0),
        scoreHackathons: Number(s.scoreHackathons ?? 0),
        scoreInhouse: Number(s.scoreInhouse ?? 0),
        scoreMembership: Number(s.scoreMembership ?? 0),
        scoreShl: Number(s.scoreShl ?? 0),
        totalScore: Number(s.totalScore ?? 0),
        rank: s.rank !== null && s.rank !== undefined ? Number(s.rank) : null,
        academicOverridden: Boolean(s.academicOverridden),
        githubOverridden: Boolean(s.githubOverridden),
        codingOverridden: Boolean(s.codingOverridden),
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      };

      await prisma.student.upsert({
        where: { id: s.id },
        update: studentData,
        create: { id: s.id, ...studentData },
      });
      restoredStudents++;
    } catch (e) {
      console.error(`Error restoring student ${s.email}:`, e);
    }
  }

  // 2. Documents
  if (Array.isArray(data.documents)) {
    for (const d of data.documents) {
      try {
        const docData = {
          studentId: d.studentId,
          category: d.category,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: Number(d.sizeBytes ?? 0),
          note: d.note ?? null,
          status: d.status ?? "PENDING",
          reviewedAt: d.reviewedAt ? new Date(d.reviewedAt) : null,
          reviewNote: d.reviewNote ?? null,
          reviewedById: d.reviewedById ?? null,
          reviewedByName: d.reviewedByName ?? null,
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        };

        await prisma.document.upsert({
          where: { id: d.id },
          update: docData,
          create: { id: d.id, ...docData },
        });
        restoredDocuments++;
      } catch (e) {
        console.error(`Error restoring document ${d.id}:`, e);
      }
    }
  }

  // 3. Project Links
  if (Array.isArray(data.projectLinks)) {
    for (const l of data.projectLinks) {
      try {
        const linkData = {
          studentId: l.studentId,
          category: l.category,
          label: l.label,
          url: l.url,
          status: l.status ?? "PENDING",
          reviewedAt: l.reviewedAt ? new Date(l.reviewedAt) : null,
          reviewNote: l.reviewNote ?? null,
          reviewedById: l.reviewedById ?? null,
          reviewedByName: l.reviewedByName ?? null,
          createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
        };

        await prisma.projectLink.upsert({
          where: { id: l.id },
          update: linkData,
          create: { id: l.id, ...linkData },
        });
        restoredLinks++;
      } catch (e) {
        console.error(`Error restoring project link ${l.id}:`, e);
      }
    }
  }

  // 4. Settings
  if (Array.isArray(data.settings)) {
    for (const st of data.settings) {
      try {
        await prisma.setting.upsert({
          where: { key: st.key },
          update: { value: st.value },
          create: { key: st.key, value: st.value },
        });
        restoredSettings++;
      } catch (e) {
        console.error(`Error restoring setting ${st.key}:`, e);
      }
    }
  }

  console.log("\n✓ Database restoration complete!");
  console.log(`  - Students restored/synced: ${restoredStudents}`);
  console.log(`  - Documents restored/synced: ${restoredDocuments}`);
  console.log(`  - Project links restored/synced: ${restoredLinks}`);
  console.log(`  - Settings restored/synced: ${restoredSettings}`);
}

main()
  .catch((e) => {
    console.error("Restore failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
