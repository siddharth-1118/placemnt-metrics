# SRM Placement Ranking Portal

**SRM Institute of Science and Technology — School of Computing · Placement Ranking System (AO1 Batch)**

A full-stack web portal where students submit academic + coding profiles, an automated scraper
engine verifies GitHub & HackerRank claims with live public data, and placement coordinators
score and rank the batch on a transparent 100-mark rubric.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · Tailwind CSS · shadcn-style UI · Lucide icons |
| API | Next.js Route Handlers (`src/app/api/**`) |
| Database | Prisma ORM — SQLite for local dev, PostgreSQL/Supabase in production |
| Scraping | GitHub REST API + public contribution graph · LeetCode public GraphQL API |
| Validation | Zod (server) + client-side mirrors |

## Quick start

```bash
npm install
npm run db:push     # create SQLite database from the Prisma schema
npm run db:seed     # optional: 6 demo students with mock scrape data
npm run dev         # http://localhost:3000
```

Pages:

| Route | Purpose |
|---|---|
| `/` | Landing page + rubric |
| `/student/submit` | Student submission form (triggers scraping on submit) |
| `/login` | Sign in — students see their own submission; assigned coordinators get the dashboard |
| `/my-submission` | Signed-in user's own submission (privacy-safe) |
| `/coordinator/dashboard` | Searchable/filterable ranking table |
| (row click) | Student detail modal: submitted-vs-scraped comparison, profile cards, score panel |

## Auth & access control

Every account (students and coordinators) signs in at `/login`. Authorization is **task-based**:

| Who | What they can access |
|---|---|
| Anonymous | Landing, submit form, login page only — all data APIs return `401` |
| Student (signed in) | `/my-submission` — **only their own** submission, scraped data and score. Other students' records → `403` |
| Coordinator, not assigned | Can sign in but sees no batch data — dashboard redirects to `/my-submission`; all evaluator APIs return `403` |
| Coordinator **assigned** (`evaluatorAssigned: true`) | Full evaluator dashboard: all submissions, comparison modal, scoring, re-scrape |

- Passwords are scrypt-hashed (`src/lib/password.ts`); sessions are HMAC-signed httpOnly cookies (`src/lib/auth.ts`, `SESSION_SECRET`).
- Students may set an optional password on first submission (never editable via the public form afterwards).
- Coordinator accounts are created/assigned in the seed (or by flipping `role` / `evaluatorAssigned` in the DB).

Demo credentials after `npm run db:seed`:

| Account | Email | Password | Sees |
|---|---|---|---|
| Assigned evaluator | `coordinator@srmist.edu.in` | `evaluator123` | Full dashboard |
| Unassigned coordinator | `latha.coordinator@srmist.edu.in` | `coordinator123` | Nothing (403s) |
| Demo student | `arjun_k@srmist.edu.in` | `student123` | Own submission only |

## Scrape modes

`SCRAPE_MODE` in `.env` controls the scraper engine:

- `auto` — try live scraping; on failure fall back to deterministic mock data so demos never break.
- `live` *(default)* — only real scraping; errors surface as FAILED jobs.
- `mock` — fully offline; no network calls.

Scraping runs **synchronously** on submit and re-scrape (results are in the API response when it
lands), which keeps it compatible with serverless platforms such as Vercel.

## Deploying to Vercel (+ Supabase)

The backend is **fully handled by Vercel**: every `src/app/api/**` route deploys as a serverless
function — nothing else to host. Two Vercel constraints shape the setup: there is **no persistent
disk** (SQLite files and `uploads/` would vanish), so both the database and document storage must
live in Supabase.

### 1. Create the Supabase pieces

- **Database** — Dashboard → *Connect* → **Session pooler (port 5432)** → copy the URI and replace
  `[YOUR-PASSWORD]` with your real database password.
- **Storage** — created automatically by the app on first upload (bucket
  `placement-documents`, private). Nothing to click.
- **Service role key** — Dashboard → *Project Settings* → *API* → `service_role` secret. Server-only:
  it bypasses row-level security, so never expose it to the browser.

### 2. Import the repo into Vercel

New Project → import `siddharth-1118/placemnt-metrics` → framework auto-detects Next.js.
Set these **Environment Variables** (Production + Preview):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Supabase pooler URI from step 1 (keep `?pgbouncer=true&connection_limit=1` if shown) |
| `SESSION_SECRET` | long random string — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role secret from step 1 |
| `STORAGE_DRIVER` | `auto` (uses Supabase Storage because the keys above exist) |
| `SCRAPE_MODE` | `live` |
| `GITHUB_TOKEN` | optional — raises GitHub REST rate limits (no scopes needed) |

### 3. Create the tables in Supabase (one-time, from your machine)

The tables can't be pushed from Vercel's build, so run once before/after the first deploy —
hotspot or any network that allows port 5432:

```bash
# switches DATABASE_URL in .env, flips provider to postgres, pushes schema, seeds coordinators
npm run db:use -- "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# then re-create your coordinator accounts in the cloud DB
npx tsx scripts/create-coordinator.ts "sv3824@srmist.edu.in" "<password>" "<name>" true
```

Commit nothing from this — `.env` is gitignored; Vercel reads only its own env vars.

### 4. Deploy

Push to `main` (or click Deploy). Every push auto-redeploys. Verify by opening the deployment URL:

- `/login` signs in with the coordinator account you created in step 3
- `/student/submit` runs a **live** GitHub/LeetCode scrape inline (1–3 s) and returns results
- document uploads land in Supabase Storage (check Dashboard → Storage → `placement-documents`)

### Local dev stays unchanged

With no Supabase keys in `.env`, the app still uses SQLite + local `uploads/` disk automatically.
Setting the `SUPABASE_*` keys locally flips documents to Supabase Storage while the database can
remain SQLite — the two switches (`DATABASE_URL`, `STORAGE_DRIVER`) are independent.

Optional `GITHUB_TOKEN` raises GitHub's rate limit from 60 to 5,000 req/h (public data needs no scopes).

## Architecture

```
src/
├─ app/
│  ├─ page.tsx                       # landing
│  ├─ student/submit/page.tsx        # student portal
│  ├─ coordinator/dashboard/page.tsx # evaluator dashboard
│  └─ api/students/…                 # REST endpoints (below)
├─ components/
│  ├─ ui.tsx                         # button/input/badge/card primitives
│  ├─ student/submit-form.tsx
│  └─ dashboard/                     # table, detail modal, GitHub & HackerRank cards
├─ lib/
│  ├─ scrapers/github.ts             # REST /users + /repos + contribution graph
│  ├─ scrapers/leetcode.ts           # public GraphQL → solved, rating, skills
│  ├─ scrapers/mock.ts               # deterministic offline fallback (seeded PRNG)
│  ├─ scrapers/index.ts              # SCRAPE_MODE dispatcher
│  ├─ pipeline.ts                    # job orchestration (fire-and-forget)
│  ├─ score.ts                       # rubric clamps, auto-suggestions, rank assignment
│  ├─ dto.ts                         # Prisma → API DTO mapper
│  └─ types.ts                       # shared domain types + score caps
└─ prisma/ (schema.prisma, seed.ts)
supabase/schema.sql                  # Postgres DDL for Supabase deployments
```

### Scrape pipeline

1. `POST /api/students` upserts the student (by register number, email-collision guarded).
2. `enqueueScrapes()` upserts `ScrapeResult` rows (`RUNNING`) and executes both platform jobs
   **fire-and-forget** — the HTTP response returns immediately. LeetCode data comes from the
   official public GraphQL endpoint; GitHub from the REST API + contributions page.
3. Each job persists `SUCCESS` (+ JSON payload) or `FAILED` (+ error message).
4. The dashboard polls every 3 s while any job is running; the detail modal polls at 2.5 s.
5. Coordinators can force a re-run via the row button or the modal's Re-scrape (optionally per platform).

### Scoring rubric (100 marks)

| Component | Cap | Source |
|---|---|---|
| Academic (10th + 12th + CGPA) | 40 | Auto-computed from marks; coordinator-adjustable |
| GitHub profile | 15 | Scraped repos / contributions / stars / language breadth |
| Coding platforms (LeetCode) | 10 | Scraped solved counts / difficulty mix / contest rating |
| Projects | 10 | Coordinator judgement of proof links |
| Internships | 10 | Coordinator judgement of proof links |
| Extras & certifications | 15 | Certs, OSS, hackathons, communication |

`PATCH /api/students/:id/score` clamps all inputs to caps, recomputes the total and reassigns
dense ranks (ties share a rank) across the whole batch.

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/students` | All students ranked by score (leaderboard) |
| POST | `/api/students` | Submit/update a student; triggers background scrapes. Returns `422` with `fieldErrors` or `409` on email dupe |
| GET | `/api/students/:id` | Full detail incl. scrape payloads |
| DELETE | `/api/students/:id` | Remove a submission (cascades scrapes, refreshes ranks) |
| PATCH | `/api/students/:id/score` | `{ scores?, verify?, coordinatorNote? }` — partial scores allowed |
| GET | `/api/students/:id/score` | Current breakdown + caps |
| POST | `/api/students/:id/rescrape` | `{ platform? }` — re-run one or both scrapes |

Example submission:

```bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "registerNumber": "RA2211003019999",
    "fullName": "Test User",
    "email": "test_user@srmist.edu.in",
    "tenthPercent": 90, "twelfthPercent": 91, "cgpa": 8.8,
    "githubUrl": "https://github.com/username",
    "hackerRankUrl": "https://www.hackerrank.com/profile/username"
  }'
```

## Deploying with Supabase

1. Create a Supabase project; copy the Postgres connection string.
2. Set `DATABASE_URL="postgresql://…"` in your host's env (Vercel, Fly, Docker…).
3. Create tables via the Supabase SQL editor using `supabase/schema.sql`,
   **or** switch `provider` to `"postgresql"` in `prisma/schema.prisma` and run `npx prisma db push`.
4. Deploy (`npm run build && npm start`). Set `SCRAPE_MODE=live` and add `GITHUB_TOKEN` in production.

## Notes & limitations

- LeetCode data comes from the official public GraphQL API (`leetcode.com/graphql`) — stable
  and auth-free. Some fields (contest rating) are null for users who never attended contests.
- GitHub contribution totals are parsed from the public `github.com/users/<login>/contributions`
  page; when GitHub omits `aria-label` counts the heatmap still renders (counts default to 0).
- No auth layer yet — wire coordinator routes to your SSO/RBAC before exposing publicly.
