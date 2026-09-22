-- =====================================================================
-- SRM Placement Ranking System — PostgreSQL / Supabase schema (DDL)
-- Mirrors prisma/schema.prisma (provider "postgresql").
-- NOTE: `npx prisma db push` against DATABASE_URL is the primary setup path;
-- this file is a reference/manual fallback.
-- =====================================================================

create table if not exists students (
  id              text primary key,
  register_number text not null unique,
  full_name       text not null,
  email           text not null unique,
  faculty_advisor text,

  tenth_percent   double precision not null,
  twelfth_percent double precision not null,
  cgpa            double precision not null,

  github_url      text,
  leetcode_url    text,
  -- JSON array of { label, url }
  proof_urls      text not null default '[]',

  -- auth & role
  role               text not null default 'STUDENT', -- STUDENT | COORDINATOR
  evaluator_assigned boolean not null default false,
  password_hash      text,

  status          text not null default 'PENDING', -- PENDING | VERIFIED
  coordinator_note text,

  score_academic   double precision not null default 0, -- max 40
  score_github     double precision not null default 0, -- max 15
  score_coding     double precision not null default 0, -- max 10
  score_projects   double precision not null default 0, -- max 10
  score_internship double precision not null default 0, -- max 10
  score_extras     double precision not null default 0, -- max 15
  total_score      double precision not null default 0,
  rank             integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_status_idx     on students (status);
create index if not exists students_total_score_idx on students (total_score desc);

create table if not exists scrape_results (
  id           text primary key,
  student_id   text not null references students (id) on delete cascade,
  platform     text not null,                        -- GITHUB | LEETCODE
  status       text not null default 'PENDING',      -- PENDING | RUNNING | SUCCESS | FAILED
  mode         text,                                 -- live | mock
  data_json    text,                                 -- platform-specific scraped payload
  error_message text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  constraint scrape_results_student_platform_key unique (student_id, platform)
);

create index if not exists scrape_results_student_idx on scrape_results (student_id);

-- Optional Row Level Security hardening for Supabase:
-- keep service-role (API) access, deny anon by default.
-- alter table students        enable row level security;
-- alter table scrape_results  enable row level security;
