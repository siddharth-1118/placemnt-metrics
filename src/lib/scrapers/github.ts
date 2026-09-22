import type { GithubRepo, GithubScrapedData } from "@/lib/types";

const GITHUB_API = "https://api.github.com";

interface GhUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  following: number;
  public_repos: number;
}

interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  fork: boolean;
  updated_at: string | null;
}

async function ghFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "srm-placement-portal",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Next.js fetch caching: always revalidate scrape data
    cache: "no-store",
  });
  if (res.status === 404) throw new Error(`GitHub profile not found (404)`);
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GitHub API rate limit reached (${res.status})`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/**
 * Fetch the contribution calendar via the private GraphQL endpoint used by
 * github.com profiles (no auth required for public profiles).
 * Returns an empty calendar on failure so REST-only data still surfaces.
 */
async function fetchContributionCalendar(login: string): Promise<{ date: string; count: number }[]> {
  try {
    const res = await fetch(`https://github.com/users/${login}/contributions`, {
      headers: { "User-Agent": "srm-placement-portal" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Contribution cells look like: <td ... data-date="2024-01-05" ... aria-label="3 contributions on January 5">
    const days: { date: string; count: number }[] = [];
    const cellRe = /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g;
    const labels = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[\s\S]*?aria-label="(?:No contributions|(\d+) contributions?) on/g)];
    for (const m of labels) days.push({ date: m[1], count: m[2] ? parseInt(m[2], 10) : 0 });
    if (days.length > 0) return days;
    // Fallback: level-based estimation when aria-labels are absent
    for (const cell of html.matchAll(cellRe)) {
      days.push({ date: cell[1], count: 0 });
    }
    return days;
  } catch {
    return [];
  }
}

export async function scrapeGithub(login: string): Promise<GithubScrapedData> {
  const token = process.env.GITHUB_TOKEN || undefined;

  const user = await ghFetch<GhUser>(`/users/${login}`, token);

  // Public repos — fetch up to 100 (most students have fewer); paginate lazily.
  const repos = await ghFetch<GhRepo[]>(
    `/users/${login}/repos?per_page=100&sort=updated&direction=desc`,
    token
  );

  const owned = repos.filter((r) => !r.fork);
  const totalStars = owned.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = owned.reduce((s, r) => s + r.forks_count, 0);

  const topRepos: GithubRepo[] = [...owned]
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        (Date.parse(b.updated_at ?? "0") || 0) - (Date.parse(a.updated_at ?? "0") || 0)
    )
    .slice(0, 6)
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      isFork: r.fork,
      updatedAt: r.updated_at,
    }));

  const langCount = new Map<string, number>();
  for (const r of owned) {
    if (!r.language) continue;
    langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
  }
  const langTotal = [...langCount.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / langTotal) * 100) }));

  const contributionCalendar = await fetchContributionCalendar(login);
  const contributionsLastYear = contributionCalendar.reduce((s, d) => s + d.count, 0);

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
    bio: user.bio,
    location: user.location,
    company: user.company,
    followers: user.followers,
    following: user.following,
    publicRepos: user.public_repos,
    totalStars,
    totalForks,
    contributionsLastYear,
    contributionCalendar,
    languages,
    topRepos,
  };
}
