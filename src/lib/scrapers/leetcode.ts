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

export async function scrapeLeetcode(username: string): Promise<LeetcodeScrapedData> {
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
