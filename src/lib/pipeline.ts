import { prisma } from "@/lib/prisma";
import { scrapePlatform } from "@/lib/scrapers";
import { parseGithubLogin, parseLeetcodeUser } from "@/lib/utils";
import type { Platform } from "@/lib/types";

/**
 * Upserts a PENDING ScrapeResult row for each platform the student provided,
 * then executes the jobs. Called in a fire-and-forget fashion from the submit
 * endpoint so the student's HTTP response returns immediately ("background
 * scraping"); the dashboard polls for results.
 */
export function enqueueScrapes(studentId: string, githubUrl?: string | null, leetcodeUrl?: string | null) {
  const jobs: Promise<unknown>[] = [];

  const ghLogin = githubUrl ? parseGithubLogin(githubUrl) : null;
  if (ghLogin) {
    jobs.push(executeScrape(studentId, "GITHUB", ghLogin));
  }

  const lcUser = leetcodeUrl ? parseLeetcodeUser(leetcodeUrl) : null;
  if (lcUser) {
    jobs.push(executeScrape(studentId, "LEETCODE", lcUser));
  }

  // Swallow rejections — failures are persisted on the job row.
  Promise.allSettled(jobs).catch(() => undefined);
}

/** Single-platform variant used by the per-student re-scrape endpoint. */
export function runSingleScrape(studentId: string, platform: Platform, handle: string) {
  void executeScrape(studentId, platform, handle).catch(() => undefined);
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
