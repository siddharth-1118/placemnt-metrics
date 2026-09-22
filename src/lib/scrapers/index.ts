import { scrapeGithub } from "@/lib/scrapers/github";
import { scrapeLeetcode } from "@/lib/scrapers/leetcode";
import { mockGithub, mockLeetcode } from "@/lib/scrapers/mock";
import type { GithubScrapedData, LeetcodeScrapedData, ScrapeMode, Platform } from "@/lib/types";

export type ScrapeOutcome<T> = { data: T; mode: ScrapeMode };

/**
 * Scrape a GitHub profile honoring SCRAPE_MODE:
 *  - live (default): only real scraping (throws on failure)
 *  - mock: deterministic offline data (no network)
 *  - auto: try live, fall back to mock so demos never break
 */
export async function runGithubScrape(login: string): Promise<ScrapeOutcome<GithubScrapedData>> {
  const mode = (process.env.SCRAPE_MODE ?? "live").toLowerCase() as ScrapeMode | "auto";

  if (mode === "mock") {
    return { data: mockGithub(login), mode: "mock" };
  }

  try {
    const data = await scrapeGithub(login);
    return { data, mode: "live" };
  } catch (err) {
    if (mode === "live") throw err;
    console.warn(`[scrape:github] live failed for ${login}, using mock:`, (err as Error).message);
    return { data: mockGithub(login), mode: "mock" };
  }
}

/**
 * Scrape a LeetCode profile honoring SCRAPE_MODE. Live only by default —
 * the portal shows exactly what the public APIs return, nothing invented.
 */
export async function runLeetcodeScrape(user: string): Promise<ScrapeOutcome<LeetcodeScrapedData>> {
  const mode = (process.env.SCRAPE_MODE ?? "live").toLowerCase() as ScrapeMode | "auto";

  if (mode === "mock") {
    return { data: mockLeetcode(user), mode: "mock" };
  }

  try {
    const data = await scrapeLeetcode(user);
    return { data, mode: "live" };
  } catch (err) {
    if (mode === "live") throw err;
    console.warn(`[scrape:leetcode] live failed for ${user}, using mock:`, (err as Error).message);
    return { data: mockLeetcode(user), mode: "mock" };
  }
}

export function scrapePlatform(platform: Platform, handle: string) {
  return platform === "GITHUB"
    ? runGithubScrape(handle)
    : runLeetcodeScrape(handle);
}
