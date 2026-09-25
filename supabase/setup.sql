-- =====================================================================
-- ONE-SHOT SETUP for Supabase (SQL Editor) — creates every table the
-- app needs AND seeds the coordinator accounts, so a Vercel deployment
-- works without ever running `prisma db push` locally.
--
-- How to run:
--   1. Open https://supabase.com/dashboard → your project
--   2. SQL Editor (left sidebar) → New query
--   3. Paste this whole file → Run
--   4. Then test the Vercel deployment again — registrations will work.
--
-- Safe to re-run: everything is idempotent (IF NOT EXISTS / ON CONFLICT).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Students (one row per account/submission)
-- ---------------------------------------------------------------------
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
  proof_urls      text not null default '[]',

  role               text not null default 'STUDENT',
  evaluator_assigned boolean not null default false,
  -- Super admin: full access + coordinator management (see supabase/additions-v3.sql)
  is_super_admin        boolean not null default false,
  can_view_submissions  boolean not null default false,
  can_score             boolean not null default false,
  password_hash      text,

  status           text not null default 'PENDING',
  coordinator_note text,
  upload_token     text not null default gen_random_uuid()::text,

  score_academic   double precision not null default 0,
  score_github     double precision not null default 0,
  score_coding     double precision not null default 0,
  score_projects   double precision not null default 0,
  score_internship double precision not null default 0,
  score_extras     double precision not null default 0,
  total_score      double precision not null default 0,
  rank             integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_status_idx      on students (status);
create index if not exists students_total_score_idx on students (total_score desc);

-- ---------------------------------------------------------------------
-- 2. Scrape results (GitHub / LeetCode job payloads)
-- ---------------------------------------------------------------------
create table if not exists scrape_results (
  id            text primary key,
  student_id    text not null references students (id) on delete cascade,
  platform      text not null,
  status        text not null default 'PENDING',
  mode          text,
  data_json     text,
  error_message text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  constraint scrape_results_student_platform_key unique (student_id, platform)
);

create index if not exists scrape_results_student_idx on scrape_results (student_id);

-- ---------------------------------------------------------------------
-- 3. Documents (uploaded proof files; bytes live in Storage)
-- ---------------------------------------------------------------------
create table if not exists documents (
  id          text primary key,
  student_id  text not null references students (id) on delete cascade,
  category    text not null,
  file_name   text not null,
  mime_type   text not null,
  size_bytes  integer not null,
  note        text,
  status      text not null default 'PENDING',
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);

create index if not exists documents_student_idx  on documents (student_id);
create index if not exists documents_category_idx on documents (category);

-- ---------------------------------------------------------------------
-- 4. Project links (unlimited URL proofs)
-- ---------------------------------------------------------------------
create table if not exists project_links (
  id          text primary key,
  student_id  text not null references students (id) on delete cascade,
  category    text not null,
  label       text not null,
  url         text not null,
  status      text not null default 'PENDING',
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);

create index if not exists project_links_student_idx on project_links (student_id);

-- ---------------------------------------------------------------------
-- 5. Seed coordinator accounts (password hashes are scrypt salt:hash,
--    computed by the app's own hashPassword — verified format)
-- ---------------------------------------------------------------------
insert into students (
  id, register_number, full_name, email,
  tenth_percent, twelfth_percent, cgpa,
  role, evaluator_assigned,
  is_super_admin, can_view_submissions, can_score,
  password_hash
) values
  ( 'coord-sv3824',
    'COORD-SV3824', 'Siddharth V (Super Admin)', 'sv3824@srmist.edu.in',
    0, 0, 0,
    'COORDINATOR', true,
    true, true, true,
    'b17e5a9f7d1566f1949eebd624d974cc:de322b42457c7d8d68860864780b4299f52c81bcc1ca8bccf64dc37fbb6f94ccefcdf07045b373d3f632aed5d6f28f08813bc49bb0cb2c2797dc26ada94f23de'
  ),
  ( 'coord-faculty-01',
    'COORD-FACULTY-01', 'Dr. Ramesh (Placement Coordinator)', 'coordinator@srmist.edu.in',
    0, 0, 0,
    'COORDINATOR', true,
    false, true, true,
    '9ffd9bd5d3e609531beb5cd7d630ad9c:94e2a72df6e232a93d3ddc6b1ed7333a4c33a61942e3a36b2641ba3f612b5979145ffa48bd4a123859ead45930be7ea544fe1e8adff4ef4913e365247be60466'
  )
on conflict (email) do update
  set role               = excluded.role,
      evaluator_assigned = excluded.evaluator_assigned,
      is_super_admin       = excluded.is_super_admin,
      can_view_submissions = excluded.can_view_submissions,
      can_score            = excluded.can_score,
      password_hash      = excluded.password_hash;

-- ---------------------------------------------------------------------
-- 6. (Optional hardening) Deny anon-key access to student data.
--    The app connects with the service role / direct Postgres, which
--    bypasses RLS, so enabling this does not affect the app.
-- ---------------------------------------------------------------------
-- alter table students      enable row level security;
-- alter table scrape_results enable row level security;
-- alter table documents     enable row level security;
-- alter table project_links enable row level security;
