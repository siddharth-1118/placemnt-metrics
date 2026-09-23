import { prisma } from "@/lib/prisma";
import { scrapePlatform } from "@/lib/scrapers";
import { parseGithubLogin, parseLeetcodeUser } from "@/lib/utils";
import { applyAutoPlatformScores } from "@/lib/score";
import type { Platform } from "@/lib/types";

/**
 * Runs the scrape jobs for each platform the student provided and returns a
 * promise that settles when every job has finished (success OR failure —
 * failures are persisted on the job row, never thrown).
 *
 * The submit endpoint awaits this so serverless platforms (Vercel) don't freeze
 * the work after the response; local dev keeps the same behavior.
 */
export function enqueueScrapes(
  studentId: string,
  githubUrl?: string | null,
  leetcodeUrl?: string | null
): Promise<unknown> {
  const jobs: Promise<unknown>[] = [];

  const ghLogin = githubUrl ? parseGithubLogin(githubUrl) : null;
  if (ghLogin) {
    jobs.push(executeScrape(studentId, "GITHUB", ghLogin));
  }

  const lcUser = leetcodeUrl ? parseLeetcodeUser(leetcodeUrl) : null;
  if (lcUser) {
    jobs.push(executeScrape(studentId, "LEETCODE", lcUser));
  }

  return Promise.allSettled(jobs).then(async (results) => {
    // Scrapes settled → apply the scraped-metrics suggestions (GitHub 15,
    // LeetCode 10) so the leaderboard shows calculated marks immediately.
    await applyAutoPlatformScores(studentId);
    return results;
  });
}

/** Single-platform variant used by the per-student re-scrape endpoint. */
export function runSingleScrape(
  studentId: string,
  platform: Platform,
  handle: string
): Promise<unknown> {
  return executeScrape(studentId, platform, handle)
    .then(async () => {
      await applyAutoPlatformScores(studentId);
    })
    .catch(() => undefined);
}

/** Run one scrape job, persisting status transitions and the payload. */
async function executeScrape(studentId: string, platform: Platform, handle: string) {
  await prisma.scrapeResult.upsert({
    where: { studentId_platform: { studentId, platform } },
    create: { studentId, platform, status: "RUNNING", startedAt: new Date() },
    update: { status: "RUNNING", dataJson: null, errorMessage: null, startedAt: new Date(), finishedAt: null },
  });

  try {
    const { data, mode } = await scrapePlatform(platform, handle);
    await prisma.scrapeResult.update({
      where: { studentId_platform: { studentId, platform } },
      data: {
        status: "SUCCESS",
        mode,
        dataJson: JSON.stringify(data),
        finishedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.scrapeResult.update({
      where: { studentId_platform: { studentId, platform } },
      data: {
        status: "FAILED",
        errorMessage: (err as Error).message.slice(0, 500),
        finishedAt: new Date(),
      },
    });
  }
}
