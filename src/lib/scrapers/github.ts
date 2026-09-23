import type { GithubRepo, GithubScrapedData } from "@/lib/types";
import { sleep } from "@/lib/utils";

const GITHUB_API = "https://api.github.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

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

function isRateLimitError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return msg.includes("rate limit") || msg.includes("403") || msg.includes("429");
}

function isNotFound(err: unknown): boolean {
  return ((err as Error)?.message ?? "").includes("404");
}

async function ghFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "srm-placement-portal",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (res.status === 404) throw new Error(`GitHub profile not found (404)`);
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GitHub API rate limit reached (${res.status})`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function ghHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
    redirect: "follow",
  });
  if (res.status === 404) throw new Error(`GitHub profile not found (404)`);
  if (!res.ok) throw new Error(`GitHub page error ${res.status} for ${url}`);
  return res.text();
}

/** Parse "1,234" / "1.2k" / "3m" style GitHub counter text. */
function parseCount(s: string | undefined | null): number {
  if (!s) return 0;
  const t = s.trim().replace(/,/g, "");
  const m = t.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!m) return 0;
  const mult = m[2] ? (m[2].toLowerCase() === "k" ? 1e3 : 1e6) : 1;
  return Math.round(parseFloat(m[1]!) * mult);
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch the contribution calendar via the public contributions page
 * (no API quota). Returns an empty calendar on failure so other data
 * still surfaces.
 */
async function fetchContributionCalendar(login: string): Promise<{ date: string; count: number }[]> {
  try {
    const res = await fetch(`https://github.com/users/${login}/contributions`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const days: { date: string; count: number }[] = [];

    // Format 1 (legacy): count embedded in the cell's aria-label.
    const labels = [
      ...html.matchAll(
        /data-date="(\d{4}-\d{2}-\d{2})"[\s\S]{0,400}?aria-label="(?:No contributions|(\d+) contributions?) on/g
      ),
    ];
    for (const m of labels) days.push({ date: m[1]!, count: m[2] ? parseInt(m[2], 10) : 0 });
    if (days.length > 0) return days;

    // Format 2 (current markup): the cell holds data-date + id; the count
    // lives in a sibling <tool-tip for=ID> — "5 contributions on Sept 21st."
    const tips = new Map<string, number>();
    for (const t of html.matchAll(
      /<tool-tip[^>]*for="([^"]+)"[^>]*>\s*(\d+) contributions on/g
    )) {
      tips.set(t[1]!, parseInt(t[2], 10));
    }
    const zeroTips = new Set<string>();
    for (const t of html.matchAll(
      /<tool-tip[^>]*for="([^"]+)"[^>]*>\s*No contributions on/g
    )) {
      zeroTips.add(t[1]!);
    }
    if (tips.size > 0 || zeroTips.size > 0) {
      for (const cell of html.matchAll(
        /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*?id="([^"]+)"[^>]*>/g
      )) {
        const id = cell[2]!;
        days.push({ date: cell[1]!, count: tips.get(id) ?? 0 });
      }
      if (days.length > 0) return days;
    }

    // Last resort: dates only, counts unknown.
    for (const cell of html.matchAll(/<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g)) {
      days.push({ date: cell[1]!, count: 0 });
    }
    return days;
  } catch {
    return [];
  }
}

interface HtmlRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string | null;
}

/** Pull the visible count out of a stargazers/forks anchor (text sits after the <svg> icon). */
function linkCount(chunk: string, kind: "stargazers" | "forks"): number {
  const m = chunk.match(new RegExp(`href="\\/[^"?#+]+\\/${kind}"[^>]*>([\\s\\S]*?)<\\/a>`));
  if (!m) return 0;
  return parseCount(stripTags(m[1]!.replace(/<svg[\s\S]*?<\/svg>/g, " ")));
}

/** Parse owned repositories out of one `?tab=repositories&type=source` page. */
function parseReposPage(html: string): HtmlRepo[] {
  const out: HtmlRepo[] = [];
  const chunks = html.split(/<li[\s>]/);
  for (const chunk of chunks) {
    if (!chunk.includes("codeRepository")) continue;
    const hrefM = chunk.match(/<a[^>]*itemprop="name codeRepository"[^>]*href="\/[^"]+\/([^"?#\/]+)"/);
    if (!hrefM) continue;
    const name = decodeURIComponent(hrefM[1]!);

    const descM = chunk.match(/itemprop="description"[^>]*>([\s\S]*?)<\/p>/);
    const langM = chunk.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</);
    const updM = [...chunk.matchAll(/datetime="([^"]+)"/g)];

    out.push({
      name,
      description: descM ? stripTags(descM[1]!).slice(0, 200) || null : null,
      language: langM ? langM[1]!.trim() : null,
      stars: linkCount(chunk, "stargazers"),
      forks: linkCount(chunk, "forks"),
      updatedAt: updM.length ? updM[updM.length - 1]![1]! : null,
    });
  }
  return out;
}

/**
 * HTML fallback: scrape the public profile + repositories pages (no API
 * quota). Numbers are best-effort; anything unparseable stays 0/null so
 * the rest of the data still reaches the dashboard.
 */
async function scrapeGithubViaHtml(login: string): Promise<GithubScrapedData> {
  const profileHtml = await ghHtml(`https://github.com/${login}`);

  const profileUrl = `https://github.com/${login}`;
  const loginRe = new RegExp(`github\\.com/(${login.replace(/[-]/g, "\\$&")})["/]`, "i");
  if (!loginRe.test(profileHtml)) throw new Error(`GitHub profile not found: ${login}`);

  const nameM = profileHtml.match(/vcard-fullname[^>]*>([^<]+)</);
  const bioM = profileHtml.match(/user-profile-bio[\s\S]{0,400}?<div[^>]*>([\s\S]*?)<\/div>/);
  const avatarM = profileHtml.match(/property="og:image" content="([^"]+)"/);
  const locationM = profileHtml.match(/itemprop="homeLocation"[^>]*>([^<]+)</);
  const followersM = profileHtml.match(/tab=followers[\s\S]{0,600}?>([\d,.]+\s*[kKmM]?)<\/span>/);
  const followingM = profileHtml.match(/tab=following[\s\S]{0,600}?>([\d,.]+\s*[kKmM]?)<\/span>/);
  const reposM =
    profileHtml.match(/tab=repositories[\s\S]{0,600}?title="([\d,]+)"/) ||
    profileHtml.match(/tab=repositories[\s\S]{0,600}?>([\d,.]+\s*[kKmM]?)<\/span>/);

  // Owned repositories, up to 3 pages (~75+ repos) — plenty for students.
  const repos: HtmlRepo[] = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const html = await ghHtml(`https://github.com/${login}?tab=repositories&type=source&page=${page}`);
      const items = parseReposPage(html);
      if (items.length === 0) break;
      repos.push(...items);
      if (items.length < 25) break;
      await sleep(300);
    } catch {
      break;
    }
  }

  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks, 0);

  const langCount = new Map<string, number>();
  for (const r of repos) {
    if (!r.language) continue;
    langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
  }
  const langTotal = [...langCount.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nm, count]) => ({ name: nm, count, pct: Math.round((count / langTotal) * 100) }));

  const topRepos: GithubRepo[] = [...repos]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 6)
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: `${profileUrl}/${r.name}`,
      stars: r.stars,
      forks: r.forks,
      language: r.language,
      isFork: false,
      updatedAt: r.updatedAt,
    }));

  const contributionCalendar = await fetchContributionCalendar(login);
  const contributionsLastYear = contributionCalendar.reduce((s, d) => s + d.count, 0);

  return {
    login,
    name: nameM ? stripTags(nameM[1]!) : null,
    avatarUrl: avatarM ? avatarM[1]! : `https://avatars.githubusercontent.com/${login}`,
    profileUrl,
    bio: bioM ? stripTags(bioM[1]!).slice(0, 300) || null : null,
    location: locationM ? stripTags(locationM[1]!).slice(0, 120) : null,
    company: null,
    followers: parseCount(followersM?.[1]),
    following: parseCount(followingM?.[1]),
    publicRepos: parseCount(reposM?.[1]) || repos.length,
    totalStars,
    totalForks,
    contributionsLastYear,
    contributionCalendar,
    languages,
    topRepos,
  };
}

async function scrapeGithubViaApi(login: string, token?: string): Promise<GithubScrapedData> {
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

export async function scrapeGithub(login: string): Promise<GithubScrapedData> {
  const token = process.env.GITHUB_TOKEN || undefined;

  // Preferred path: REST API (exact numbers). On a rate limit (shared
  // networks exhaust the 60 req/hr anonymous quota), retry once then fall
  // back to HTML scraping which has no API quota. 404s stay 404s — an
  // invalid profile must not be masked by the fallback.
  try {
    return await scrapeGithubViaApi(login, token);
  } catch (err) {
    if (isNotFound(err)) throw err;
    if (isRateLimitError(err)) {
      await sleep(1200);
      try {
        return await scrapeGithubViaApi(login, token);
      } catch (err2) {
        if (isNotFound(err2)) throw err2;
        return await scrapeGithubViaHtml(login);
      }
    }
    throw err;
  }
}
