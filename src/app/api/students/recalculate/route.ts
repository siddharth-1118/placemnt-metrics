import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScorer } from "@/lib/auth";
import { suggestAcademicScore, clampScores, assignRanks, autoScoresFor } from "@/lib/score";

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
  const { error } = await requireScorer();
  if (error) return error;

  const students = await prisma.student.findMany({
    include: { scrapes: true },
  });

  let updated = 0;
  const details: { registerNumber: string; academic: number; total: number }[] = [];

  for (const s of students) {
    // The three automatic components are always recomputed from source data
    // (marks band tables + latest scrapes) — never coordinator-entered.
    const auto = await autoScoresFor(s.id);

    const clamped = clampScores({
      academic: auto.academic,
      github: auto.github,
      coding: auto.coding,
      internship: s.scoreInternship,
      certifications: s.scoreCertifications,
      projects: s.scoreProjects,
      fullstack: s.scoreFullstack,
      hackathons: s.scoreHackathons,
      inhouse: s.scoreInhouse,
      membership: s.scoreMembership,
      shl: s.scoreShl,
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
