import Link from "next/link";
import { ArrowRight, BarChart3, FileSearch, Github, Trophy } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Automated profile scraping",
    body: "GitHub repositories, stars, contribution heatmaps and LeetCode solved counts are pulled automatically when a student submits — no screenshots, no guesswork.",
  },
  {
    icon: BarChart3,
    title: "Transparent 100-mark rubric",
    body: "Academics, GitHub, coding platforms, projects, internships and extras — every mark is capped, visible and auditable.",
  },
  {
    icon: Trophy,
    title: "Live placement ranking",
    body: "Coordinator-verified scores recompute the batch leaderboard instantly, with dense tie-aware ranking.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Github className="h-4 w-4" />
        Verified coding profiles · AO1 Batch
      </div>
      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        SRM School of Computing
        <span className="block text-muted-foreground">Placement Ranking System</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Students submit their academic profile and coding handles. The portal verifies every claim
        with live scraped data from GitHub and LeetCode, and coordinators rank the batch on a
        transparent 100-mark rubric.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/student/submit"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90"
        >
          Submit your profile <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/coordinator/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent"
        >
          Coordinator dashboard
        </Link>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5 shadow-card">
            <f.icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border bg-card p-5 shadow-card">
        <h2 className="font-semibold">Scoring rubric (out of 100)</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Academic marks (10th + 12th + CGPA)", 40],
            ["GitHub profile (repos, commits, stars)", 15],
            ["Coding platforms (LeetCode)", 10],
            ["Projects", 10],
            ["Internships", 10],
            ["Extras & certifications", 15],
          ].map(([label, cap]) => (
            <div key={label as string} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">{cap}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
