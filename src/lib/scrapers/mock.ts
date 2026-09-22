import type { GithubScrapedData, LeetcodeScrapedData } from "@/lib/types";
import { range } from "@/lib/utils";

/**
 * Deterministic pseudo-random generator seeded by username, so the same
 * profile always produces the same mock data (stable for demos & tests).
 * Only used when SCRAPE_MODE=mock or auto-with-fallback — never live.
 */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const LANGS = ["Python", "TypeScript", "JavaScript", "Java", "C++", "Go", "Rust", "SQL", "C", "Kotlin"];
const REPO_NAMES = [
  "e-commerce-api", "campus-event-manager", "ml-playground", "portfolio-site",
  "dsa-journal", "realtime-chat", "expense-tracker", "code-snippets", "srm-hack-project",
];
const LC_TAGS = ["Dynamic Programming", "Arrays", "Strings", "Trees", "Graph", "Hash Table", "Math", "Two Pointers"];

export function mockGithub(login: string): GithubScrapedData {
  const rnd = seeded(`gh:${login.toLowerCase()}`);
  const repos = 8 + Math.floor(rnd() * 40);
  const stars = Math.floor(rnd() * 120);
  const forks = Math.floor(rnd() * 45);
  const followers = Math.floor(rnd() * 200);

  const today = new Date();
  const contributionCalendar = range(371).map((i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (370 - i));
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const base = rnd();
    const count =
      base < (weekend ? 0.45 : 0.28)
        ? 0
        : Math.max(1, Math.round((weekend ? 1.2 : 2.4) * rnd() * 6));
    return { date: d.toISOString().slice(0, 10), count };
  });
  const contributionsLastYear = contributionCalendar.reduce((s, d) => s + d.count, 0);

  const langCount = new Map<string, number>();
  for (let i = 0; i < repos; i++) {
    const l = LANGS[Math.floor(rnd() * LANGS.length)]!;
    langCount.set(l, (langCount.get(l) ?? 0) + 1);
  }
  const langTotal = [...langCount.values()].reduce((a, b) => a + b, 0);
  const languages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / langTotal) * 100) }));

  const topRepos = range(Math.min(6, repos)).map((i) => ({
    name: REPO_NAMES[Math.floor(rnd() * REPO_NAMES.length)]! + (i > 0 ? `-${i + 1}` : ""),
    description:
      i === 0
        ? "Full-stack project built for the School of Computing capstone."
        : i % 2 === 0
          ? "Utilities and experiments — see README for details."
          : null,
    url: `https://github.com/${login}/${REPO_NAMES[i % REPO_NAMES.length]}`,
    stars: Math.floor(rnd() * Math.max(6, stars / 4)),
    forks: Math.floor(rnd() * Math.max(4, forks / 4)),
    language: languages[i % Math.max(1, languages.length)]?.name ?? "Python",
    isFork: false,
    updatedAt: new Date(today.getTime() - i * 86_400_000 * 7).toISOString(),
  }));

  return {
    login,
    name: login.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    avatarUrl: `https://avatars.githubusercontent.com/u/${(seeded(login)() * 90_000_000 + 10_000_000) | 0}?v=4`,
    profileUrl: `https://github.com/${login}`,
    bio: ["B.Tech CSE @ SRM IST", "Full-stack developer", "DSA enthusiast", null][Math.floor(rnd() * 4)] ?? null,
    location: "Chennai, India",
    company: null,
    followers,
    following: Math.floor(rnd() * 120),
    publicRepos: repos,
    totalStars: stars,
    totalForks: forks,
    contributionsLastYear,
    contributionCalendar,
    languages,
    topRepos,
  };
}

export function mockLeetcode(username: string): LeetcodeScrapedData {
  const rnd = seeded(`lc:${username.toLowerCase()}`);
  const easy = Math.floor(rnd() * 180);
  const medium = Math.floor(rnd() * 220);
  const hard = Math.floor(rnd() * 60);
  const total = easy + medium + hard;
  const hasContest = rnd() < 0.7;

  return {
    username,
    name: username.replace(/[-_0-9]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    avatarUrl: null,
    profileUrl: `https://leetcode.com/u/${username}/`,
    country: "India",
    aboutMe: null,
    githubUrl: null,
    ranking: total > 30 ? 50_000 + Math.floor(rnd() * 300_000) : null,
    contestRating: hasContest ? 1400 + Math.floor(rnd() * 800) : null,
    attendedContests: hasContest ? Math.floor(rnd() * 40) : null,
    topPercentage: hasContest ? Math.floor(5 + rnd() * 55) : null,
    solvedEasy: easy,
    solvedMedium: medium,
    solvedHard: hard,
    solvedTotal: total,
    skillTags: LC_TAGS.filter(() => rnd() < 0.6)
      .slice(0, 6)
      .map((name) => ({ name, count: 5 + Math.floor(rnd() * 80) })),
    recentSubmissions: [],
  };
}
