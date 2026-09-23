import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/auth";
import { suggestAcademicScore, clampScores, assignRanks } from "@/lib/score";

export const dynamic = "force-dynamic";

/**
 * POST /api/students/recalculate — evaluator-only backfill.
 *
 * Rebuilds every student's academic score from their stored 10th/12th/CGPA
 * (the deterministic formula) and recomputes each total. Platform scores
 * (GitHub/LeetCode) keep any coordinator-entered value; zero-valued platform
 * scores are refilled from the latest scrape payload when one exists.
 *
 * Fixes rows submitted through an older build that saved academic = 0.
 */
export async function POST() {
  const { error } = await requireEvaluator();
  if (error) return error;

  const students = await prisma.student.findMany({
    include: { scrapes: true },
  });

  let updated = 0;
  const details: { registerNumber: string; academic: number; total: number }[] = [];

  for (const s of students) {
    // Academic is always derivable from marks.
    const academic = s.tenthPercent > 0 || s.twelfthPercent > 0 || s.cgpa > 0
      ? suggestAcademicScore(s.tenthPercent, s.twelfthPercent, s.cgpa)
      : 0;

    // Platform scores: keep coordinator-entered values; refill zeros from scrapes.
    const ghJob = s.scrapes.find((x) => x.platform === "GITHUB");
    const lcJob = s.scrapes.find((x) => x.platform === "LEETCODE");
    let ghSuggested = 0;
    let lcSuggested = 0;
    try {
      if (ghJob?.status === "SUCCESS" && ghJob.dataJson) {
        const { suggestGithubScore } = await import("@/lib/score");
        ghSuggested = suggestGithubScore(JSON.parse(ghJob.dataJson));
      }
      if (lcJob?.status === "SUCCESS" && lcJob.dataJson) {
        const { suggestCodingScore } = await import("@/lib/score");
        lcSuggested = suggestCodingScore(JSON.parse(lcJob.dataJson));
      }
    } catch {
      // corrupt payloads → treat as no data
    }

    const clamped = clampScores({
      academic,
      github: s.scoreGithub > 0 ? s.scoreGithub : ghSuggested,
      coding: s.scoreCoding > 0 ? s.scoreCoding : lcSuggested,
      projects: s.scoreProjects,
      internship: s.scoreInternship,
      extras: s.scoreExtras,
    });

    if (
      clamped.academic !== s.scoreAcademic ||
      clamped.github !== s.scoreGithub ||
      clamped.coding !== s.scoreCoding ||
      clamped.total !== s.totalScore
    ) {
      await prisma.student.update({
        where: { id: s.id },
        data: {
          scoreAcademic: clamped.academic,
          scoreGithub: clamped.github,
          scoreCoding: clamped.coding,
          totalScore: clamped.total,
        },
      });
      updated += 1;
      details.push({ registerNumber: s.registerNumber, academic: clamped.academic, total: clamped.total });
    }
  }

  await assignRanks();

  return NextResponse.json({
    ok: true,
    updated,
    scanned: students.length,
    details,
    message:
      updated > 0
        ? `Recalculated ${updated} student(s) from stored marks. Ranks refreshed.`
        : "All scores already up to date.",
  });
}
