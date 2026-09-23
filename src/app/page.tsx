import Link from "next/link";
import {
  ArrowRight, BarChart3, Github, LayoutDashboard, ScanEye, Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui";

const features = [
  {
    icon: ScanEye,
    kicker: "No screenshots",
    title: "Claims become evidence",
    body: "GitHub repositories, stars, contribution heatmaps and LeetCode solved counts are pulled live the moment a profile is submitted — then frozen into the student's record.",
  },
  {
    icon: BarChart3,
    kicker: "Capped & auditable",
    title: "A rubric you can defend",
    body: "Academics, GitHub, coding platforms, projects, internships, extras. Every mark has a cap, every cap has a reason, and the breakdown stays visible on every row.",
  },
  {
    icon: Trophy,
    kicker: "Dense ranking",
    title: "Ties handled fairly",
    body: "Scores recompute the leaderboard the second a coordinator signs off. Equal totals share a rank — no artificial ordering between equals.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pt-16">
      {/* Hero */}
      <section className="relative animate-rise">
        <Badge variant="default" className="mb-5 px-3 py-1">
          <Github className="h-3 w-3" />
          Verified coding profiles · AO1 Batch
        </Badge>
        <h1 className="max-w-3xl text-[2.15rem] font-bold leading-[1.06] tracking-[-0.035em] sm:text-6xl">
          Marks tell half the story.
          <span className="text-gradient block drop-shadow-[0_0_28px_hsl(265_95%_60%/0.35)]">
            We verify the other half.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          Students submit their academic profile and coding handles. The portal verifies every
          claim against live data from GitHub and LeetCode, and placement coordinators rank the
          batch on a transparent 100-mark rubric.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/student/submit"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[hsl(262_95%_68%)] to-[hsl(255_85%_57%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_-4px_hsl(258_95%_60%/0.7),inset_0_1px_0_hsl(0_0%_100%/0.35)] transition-all duration-200 hover:shadow-[0_10px_40px_-6px_hsl(270_95%_62%/0.8),inset_0_1px_0_hsl(0_0%_100%/0.35)] active:scale-[0.98]"
          >
            Submit your profile
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/coordinator/dashboard"
            className="glass inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-foreground/90 transition-all duration-200 hover:brightness-[1.2] active:scale-[0.98]"
          >
            <LayoutDashboard className="h-4 w-4 opacity-70" />
            Coordinator dashboard
          </Link>
        </div>

        {/* Rubric strip */}
        <div className="glass mt-14 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold tracking-[-0.015em]">The 100 marks, in the open</h2>
            <span className="text-xs text-muted-foreground">
              Every coordinator scores against the same caps
            </span>
          </div>
          <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Academic marks", "10th + 12th + CGPA", 40],
              ["GitHub profile", "repos · commits · stars", 15],
              ["Coding platforms", "LeetCode solved & rating", 10],
              ["Projects", "verified links", 10],
              ["Internships", "verified documents", 10],
              ["Extras", "certs · competitions · SHL", 15],
            ].map(([title, sub, cap]) => (
              <div
                key={title as string}
                className="glass-inset flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-colors hover:bg-white/[0.07]"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub}</p>
                </div>
                <span className="text-gradient-gold tnum ml-3 shrink-0 text-xl font-bold">
                  {cap}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="glass glass-hover rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="glass-inset flex h-10 w-10 items-center justify-center rounded-xl">
                <f.icon className="h-5 w-5 text-[hsl(258_100%_80%)]" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {f.kicker}
              </span>
            </div>
            <h2 className="mt-4 font-semibold tracking-[-0.015em]">{f.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* Quiet closing line */}
      <p className="mx-auto mt-16 max-w-xl text-center text-sm text-muted-foreground">
        Built for the School of Computing&apos;s placement cell — because a rank list is only as
        strong as the evidence behind it.
      </p>
    </div>
  );
}
