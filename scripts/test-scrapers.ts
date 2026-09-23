// Live test of both scrapers through the real code path (tsx).
// Usage: npx tsx scripts/test-scrapers.ts <github-login> <leetcode-user>
import { scrapeGithub } from "../src/lib/scrapers/github";
import { scrapeLeetcode } from "../src/lib/scrapers/leetcode";

const gh = process.argv[2] ?? "siddharth-1118";
const lc = process.argv[3] ?? "leetcode";

(async () => {
  const t0 = Date.now();
  try {
    const g = await scrapeGithub(gh);
    console.log("GITHUB OK", JSON.stringify({
      login: g.login, repos: g.publicRepos, stars: g.totalStars,
      contribs: g.contributionsLastYear, langs: g.languages.length, topRepos: g.topRepos.length,
      ms: Date.now() - t0,
    }));
  } catch (e) {
    console.log("GITHUB FAIL:", (e as Error).message);
  }

  const t1 = Date.now();
  try {
    const l = await scrapeLeetcode(lc);
    console.log("LEETCODE OK", JSON.stringify({
      user: l.username, total: l.solvedTotal, hard: l.solvedHard,
      rating: l.contestRating, ranking: l.ranking, ms: Date.now() - t1,
    }));
  } catch (e) {
    console.log("LEETCODE FAIL:", (e as Error).message);
  }
  process.exit(0);
})();
