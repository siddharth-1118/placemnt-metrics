import type { LeetcodeScrapedData, LeetcodeSkillTag } from "@/lib/types";

/**
 * LeetCode public profile data via the site's public GraphQL API
 * (https://leetcode.com/graphql) — no auth, no cookies, works for public
 * profiles. Failures throw; `auto` mode falls back per pipeline config.
 */

const GQL = "https://leetcode.com/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function gqlOnce<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA, Referer: "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("LeetCode profile not found (404)");
  if (res.status === 429) throw new Error("LeetCode rate limit reached (429)");
  if (!res.ok) throw new Error(`LeetCode API error ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`LeetCode API error: ${json.errors[0]!.message}`);
  if (!json.data) throw new Error("LeetCode API returned no data");
  return json.data;
}

/** Retry once on transient failures (network blips, 429, 5xx). */
async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  try {
    return await gqlOnce<T>(query, variables);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    const transient =
      msg.includes("429") || msg.includes("rate limit") || /LeetCode API error 5\d\d/.test(msg) ||
      msg.includes("fetch failed");
    if (!transient) throw err;
    await new Promise((r) => setTimeout(r, 1500));
    return gqlOnce<T>(query, variables);
  }
}

interface ProfileData {
  matchedUser: {
    username: string;
    profile: {
      realName: string;
      userAvatar: string;
      countryName: string;
      aboutMe: string;
      ranking: number | null;
    } | null;
  } | null;
}

interface StreakData {
  matchedUser: {
    userProfileCalendar?: { activeYears: number[]; streak: number };
  } | null;
}

interface SolvedData {
  matchedUser: {
    submitStatsGlobal: {
      acSubmissionNum: { difficulty: string; count: number }[];
    };
    tagProblemCounts?: {
      fundamental?: { tagName: string; problemsSolved: number }[];
      intermediate?: { tagName: string; problemsSolved: number }[];
      advanced?: { tagName: string; problemsSolved: number }[];
    };
  } | null;
}

interface ContestData {
  userContestRanking: { rating: number; attendedContestsCount: number; topPercentage: number } | null;
}

interface RecentData {
  recentAcSubmissionList: { id: string; title: string; titleSlug: string; timestamp: string }[];
}

async function scrapeLeetcodeOfficial(username: string): Promise<LeetcodeScrapedData> {
  const profile = await gql<ProfileData>(
    `query userProfile($userSlug: String!) {
      matchedUser(username: $userSlug) {
        username
        profile {
          realName
          userAvatar
          countryName
          aboutMe
          ranking
        }
      }
    }`,
    { userSlug: username }
  );
  if (!profile.matchedUser) throw new Error(`LeetCode profile not found: ${username}`);

  // Secondary queries are best-effort: a failure in any of them must not
  // invalidate the profile scrape — we degrade to zero/null fields instead.
  const [solvedRes, contestRes, recentRes] = await Promise.allSettled([
    gql<SolvedData>(
      `query userProblemsSolved($userSlug: String!) {
        matchedUser(username: $userSlug) {
          submitStatsGlobal {
            acSubmissionNum { difficulty count }
          }
          tagProblemCounts {
            fundamental { tagName problemsSolved }
            intermediate { tagName problemsSolved }
            advanced { tagName problemsSolved }
          }
        }
      }`,
      { userSlug: username }
    ),
    gql<ContestData>(
      `query userContestRankingInfo($userSlug: String!) {
        userContestRanking(username: $userSlug) {
          rating
          attendedContestsCount
          topPercentage
        }
      }`,
      { userSlug: username }
    ),
    gql<RecentData>(
      `query recentAcSubmissions($userSlug: String!) {
        recentAcSubmissionList(username: $userSlug, limit: 10) {
          id title titleSlug timestamp
        }
      }`,
      { userSlug: username }
    ),
  ]);

  const solved: SolvedData =
    solvedRes.status === "fulfilled"
      ? solvedRes.value
      : { matchedUser: null };
  const contest: ContestData =
    contestRes.status === "fulfilled"
      ? contestRes.value
      : { userContestRanking: null };
  const recent: RecentData =
    recentRes.status === "fulfilled"
      ? recentRes.value
      : { recentAcSubmissionList: [] };

  const counts = solved.matchedUser?.submitStatsGlobal.acSubmissionNum ?? [];
  const byDifficulty = (d: string) => counts.find((c) => c.difficulty === d)?.count ?? 0;
  const solvedEasy = byDifficulty("Easy");
  const solvedMedium = byDifficulty("Medium");
  const solvedHard = byDifficulty("Hard");

  const tc = solved.matchedUser?.tagProblemCounts;
  const allTags = [...(tc?.fundamental ?? []), ...(tc?.intermediate ?? []), ...(tc?.advanced ?? [])]
    .map<LeetcodeSkillTag>((t) => ({ name: t.tagName, count: t.problemsSolved }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recentSubmissions = (recent.recentAcSubmissionList ?? []).slice(0, 10).map((s) => ({
    title: s.title,
    slug: s.titleSlug,
    solvedAt: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : null,
  }));

  const p = profile.matchedUser!.profile;
  return {
    username: profile.matchedUser!.username,
    name: p?.realName || null,
    avatarUrl: p?.userAvatar || null,
    profileUrl: `https://leetcode.com/u/${username}/`,
    country: p?.countryName || null,
    aboutMe: p?.aboutMe || null,
    githubUrl: null,
    ranking: p?.ranking ?? null,
    contestRating: contest.userContestRanking?.rating ?? null,
    attendedContests: contest.userContestRanking?.attendedContestsCount ?? null,
    topPercentage: contest.userContestRanking?.topPercentage ?? null,
    solvedEasy,
    solvedMedium,
    solvedHard,
    solvedTotal: solvedEasy + solvedMedium + solvedHard,
    skillTags: allTags,
    recentSubmissions,
  };
}

async function scrapeLeetcodeViaMirror(username: string): Promise<LeetcodeScrapedData> {
  // Mirror 1: Vercel-hosted fast proxy
  try {
    const res = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${username}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && (data.totalSolved !== undefined || data.easySolved !== undefined)) {
        const solvedEasy = Number(data.easySolved ?? 0);
        const solvedMedium = Number(data.mediumSolved ?? 0);
        const solvedHard = Number(data.hardSolved ?? 0);
        const solvedTotal = Number(data.totalSolved ?? solvedEasy + solvedMedium + solvedHard);
        return {
          username,
          name: data.name || null,
          avatarUrl: data.avatar || null,
          profileUrl: `https://leetcode.com/u/${username}/`,
          country: data.country || null,
          aboutMe: data.about || null,
          githubUrl: null,
          ranking: data.ranking ?? null,
          contestRating: data.contestRanking?.rating ?? null,
          attendedContests: data.contestRanking?.attendedContestsCount ?? null,
          topPercentage: data.contestRanking?.topPercentage ?? null,
          solvedEasy,
          solvedMedium,
          solvedHard,
          solvedTotal,
          skillTags: [],
          recentSubmissions: (data.recentSubmissions ?? []).slice(0, 10).map((s: any) => ({
            title: s.title,
            slug: s.titleSlug,
            solvedAt: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : null,
          })),
        };
      }
    }
  } catch {
    // mirror 1 failed -> try mirror 2
  }

  // Mirror 2: alfa-leetcode-api
  const res2 = await fetch(`https://alfa-leetcode-api.onrender.com/userProfile/${username}`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res2.ok) throw new Error(`LeetCode profile not found or unavailable for ${username}`);
  const data2 = (await res2.json()) as any;
  const solvedEasy = Number(data2.easySolved ?? 0);
  const solvedMedium = Number(data2.mediumSolved ?? 0);
  const solvedHard = Number(data2.hardSolved ?? 0);
  const solvedTotal = Number(data2.totalSolved ?? solvedEasy + solvedMedium + solvedHard);
  return {
    username,
    name: data2.name || null,
    avatarUrl: data2.avatar || null,
    profileUrl: `https://leetcode.com/u/${username}/`,
    country: data2.country || null,
    aboutMe: data2.about || null,
    githubUrl: null,
    ranking: data2.ranking ?? null,
    contestRating: null,
    attendedContests: null,
    topPercentage: null,
    solvedEasy,
    solvedMedium,
    solvedHard,
    solvedTotal,
    skillTags: [],
    recentSubmissions: [],
  };
}

export async function scrapeLeetcode(username: string): Promise<LeetcodeScrapedData> {
  try {
    return await scrapeLeetcodeOfficial(username);
  } catch (err) {
    if ((err as Error)?.message?.includes("not found")) {
      try {
        return await scrapeLeetcodeViaMirror(username);
      } catch {
        throw err;
      }
    }
    // Network, 429, Cloudflare or datacenter IP block -> seamless failover to mirror
    return await scrapeLeetcodeViaMirror(username);
  }
}

/** Streak/active-years bonus data (optional, non-fatal if unavailable). */
export async function fetchStreak(username: string): Promise<{ activeYears: number[]; streak: number } | null> {
  try {
    const d = await gql<StreakData>(
      `query userProfileCalendar($userSlug: String!) {
        matchedUser(username: $userSlug) {
          userProfileCalendar { activeYears streak }
        }
      }`,
      { userSlug: username }
    );
    return d.matchedUser?.userProfileCalendar ?? null;
  } catch {
    return null;
  }
}
