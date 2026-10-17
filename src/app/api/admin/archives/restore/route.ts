import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getArchiveContent } from "@/lib/auto-archive";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/archives/restore — Restore database from a saved historical snapshot.
 * Super Admin only.
 */
export async function POST(req: Request) {
  const { error: authError } = await requireSuperAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const filename = body?.filename;

  if (!filename) {
    return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
  }

  const raw = await getArchiveContent(filename);
  if (!raw) {
    return NextResponse.json({ error: "Snapshot file not found" }, { status: 404 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Corrupted snapshot JSON" }, { status: 422 });
  }

  const data = parsed?.data;
  if (!data || !Array.isArray(data.students)) {
    return NextResponse.json({ error: "Invalid snapshot structure" }, { status: 422 });
  }

  let restoredStudents = 0;
  let restoredDocuments = 0;
  let restoredLinks = 0;

  // Restore students
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

  // Restore documents
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
        console.error(`Error restoring doc ${d.id}:`, e);
      }
    }
  }

  // Restore project links
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

  return NextResponse.json({
    ok: true,
    message: `Restored snapshot "${filename}": ${restoredStudents} students, ${restoredDocuments} documents, ${restoredLinks} project links.`,
    counts: {
      students: restoredStudents,
      documents: restoredDocuments,
      projectLinks: restoredLinks,
    },
  });
}
