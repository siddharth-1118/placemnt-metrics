// Direct scraper probe: test GitHub and LeetCode endpoints and print raw status/errors.
// Usage: node scripts/test-scraper.js github <login>  |  node scripts/test-scraper.js leetcode <user>
const platform = process.argv[2];
const handle = process.argv[3];
if (!platform || !handle) {
  console.error("usage: node scripts/test-scraper.js <github|leetcode> <handle>");
  process.exit(2);
}

(async () => {
  try {
    if (platform === "github") {
      const token = process.env.GITHUB_TOKEN || undefined;
      const res = await fetch(`https://api.github.com/users/${handle}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "srm-placement-portal",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      console.log("status:", res.status);
      const body = await res.text();
      console.log("body:", body.slice(0, 250));
    } else {
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Referer: "https://leetcode.com",
        },
        body: JSON.stringify({
          query:
            "query userProfile($userSlug: String!) { matchedUser(username: $userSlug) { username profile { realName ranking } } }",
          variables: { userSlug: handle },
        }),
      });
      console.log("status:", res.status);
      const body = await res.text();
      console.log("body:", body.slice(0, 250));
    }
    process.exit(0);
  } catch (e) {
    console.error("FETCH-ERROR:", e.message, e.cause ? String(e.cause) : "");
    process.exit(1);
  }
})();
