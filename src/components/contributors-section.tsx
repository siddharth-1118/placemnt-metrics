import { ExternalLink, Linkedin, Users } from "lucide-react";

export interface Contributor {
  name: string;
  role: string;
  photoUrl: string;
  linkedinUrl: string;
  objectPosition?: string;
  bio: string;
}

export const CONTRIBUTORS: Contributor[] = [
  {
    name: "Krish Sharma",
    role: "Frontend Developer",
    photoUrl: "/contributors/krish-sharma.jpg",
    linkedinUrl: "https://www.linkedin.com/in/krishsharma2007/",
    objectPosition: "object-center",
    bio: "Designed and implemented modern UI layouts, responsive student and coordinator portals, and design system components.",
  },
  {
    name: "Sai Siddharth",
    role: "Full Stack Developer",
    photoUrl: "/contributors/sai-siddharth.jpg",
    linkedinUrl: "https://www.linkedin.com/in/sai-siddharth-ba0a92369",
    objectPosition: "object-top",
    bio: "Architected end-to-end full-stack portal engine, scraper pipelines, database schemas, scoring logic, and security workflows.",
  },
];

export function ContributorsSection() {
  return (
    <div className="rounded-md border border-[#e2ded5] bg-white p-6 sm:p-8 dark:border-[#262f3c] dark:bg-[#1b222c]">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-2.5 inline-flex items-center gap-1.5 rounded border border-[#d6cfc0] bg-[#faf8f5] px-3 py-1 text-xs font-semibold text-[#1c2024] dark:border-[#323d4c] dark:bg-[#161c24] dark:text-[#f0ede6]">
          <Users className="h-3.5 w-3.5 text-[#165b33] dark:text-[#78d69f]" />
          <span>Project Team &amp; Engineering</span>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-[#1c2024] dark:text-white sm:text-2xl">
          Project Contributors
        </h2>

        <p className="mx-auto mt-1 max-w-xl text-xs text-[#5c6470] dark:text-[#94a3b8]">
          Acknowledging the students and engineers who designed and developed the SRM Placement Matrix Portal.
        </p>
      </div>

      {/* Contributor Profile Cards */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 max-w-2xl mx-auto">
        {CONTRIBUTORS.map((c) => (
          <div
            key={c.name}
            className="flex flex-col items-center justify-between rounded-md border border-[#e2ded5] bg-[#faf8f5] p-5 text-center transition-all hover:border-[#b8ddc4] hover:shadow-sm dark:border-[#262f3c] dark:bg-[#161c24] dark:hover:border-[#265335]"
          >
            <div className="flex flex-col items-center">
              {/* Contributor Photo */}
              <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-[#165b33]/25 bg-[#e2ded5] shadow-sm dark:border-[#78d69f]/35 dark:bg-[#262f3c]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.photoUrl}
                  alt={c.name}
                  className={`h-full w-full object-cover ${c.objectPosition ?? "object-center"}`}
                />
              </div>

              {/* Contributor Name */}
              <h3 className="mt-3.5 text-base font-bold text-[#1c2024] dark:text-white">
                {c.name}
              </h3>

              {/* Contributor Role */}
              <span className="mt-1 inline-flex items-center rounded-full bg-[#eaf4ed] px-2.5 py-0.5 text-[11px] font-semibold text-[#165b33] dark:bg-[#133822] dark:text-[#78d69f]">
                {c.role}
              </span>

              {/* Contribution Description */}
              <p className="mt-2.5 text-xs text-[#5c6470] dark:text-[#94a3b8] leading-relaxed">
                {c.bio}
              </p>
            </div>

            {/* LinkedIn Profile Link */}
            <div className="mt-5 w-full pt-3 border-t border-[#e2ded5] dark:border-[#262f3c]">
              <a
                href={c.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#0077b5]/30 bg-[#0077b5]/10 px-3 py-2 text-xs font-semibold text-[#0077b5] transition-colors hover:bg-[#0077b5] hover:text-white dark:border-[#0077b5]/40 dark:bg-[#0077b5]/20 dark:text-[#38bdf8] dark:hover:bg-[#0077b5] dark:hover:text-white"
              >
                <Linkedin className="h-3.5 w-3.5" />
                <span>LinkedIn Profile</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
