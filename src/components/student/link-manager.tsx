"use client";

import { useState } from "react";
import {
  Boxes,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { LINK_CATEGORIES } from "@/lib/categories";
import type { ProjectLinkDto } from "@/lib/types";

function statusBadge(status: ProjectLinkDto["status"]) {
  if (status === "VERIFIED")
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </Badge>
    );
  if (status === "REJECTED")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  return (
    <Badge variant="warning" className="gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
}

/** Visual identity per link section. */
const LINK_SECTION_STYLE: Record<string, string> = {
  PROJECT: "border-primary/25",
  FULLSTACK_PROJECT: "border-emerald-500/25",
  INHOUSE_PROJECT_LINK: "border-cyan-500/25",
};

/** Category key -> short label, for chips in the links list. */
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  LINK_CATEGORIES.map((c) => [c.key, c.label]),
);

/**
 * Project & portfolio links on the signed-in user's own submission, grouped
 * into their own clearly separated sections: project links, full-stack
 * project links, and in-house project links.
 */
export function LinkManager({ onChanged, locked = false }: { onChanged?: () => void; locked?: boolean }) {
  const [links, setLinks] = useState<ProjectLinkDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState(LINK_CATEGORIES[0].key);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/documents/list", { cache: "no-store" });
      if (res.ok) {
        const b = await res.json();
        setLinks(b.projectLinks ?? []);
      }
    } catch {
      /* transient */
    } finally {
      setLoaded(true);
    }
  }

  async function add() {
    setError(null);
    if (!label.trim()) return setError("Please enter a title or label for the project");
    try {
      new URL(url.trim());
    } catch {
      return setError("Please enter a valid URL (e.g. https://my-app.vercel.app)");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/project-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label: label.trim(), url: url.trim() }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body?.error ?? body?.fieldErrors?.url ?? "Could not add project link");
      setLabel("");
      setUrl("");
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/project-links?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      setLinks((l) => l.filter((x) => x.id !== id));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card className="rounded-md border border-[#e2ded5] bg-white p-4 dark:border-[#262f3c] dark:bg-[#1b222c]">
      <CardContent className="space-y-4 p-0">
        <div>
          <h3 className="text-sm font-bold text-[#1c2024] dark:text-white">
            Project &amp; Live Deployment Links
          </h3>
          <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Deployed links, GitHub code repositories, and in-house laboratory projects for
            coordinator audit.
          </p>
        </div>

        {error && (
          <div className="rounded border border-[#f8c4c4] bg-[#fdeded] p-2.5 text-xs text-[#a82424] dark:border-[#5e2626] dark:bg-[#3d1818] dark:text-[#f38d8d]">
            {error}
          </div>
        )}

        {locked && (
          <div className="flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600">
            <Lock className="h-3.5 w-3.5" /> Adding links is closed by coordinator
          </div>
        )}

        {/* Input bar */}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,2fr)_auto]">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-md border border-[#d8d3c7] bg-white px-2.5 text-xs text-[#1c2024] outline-none dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
          >
            {LINK_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <Input
            placeholder="Project Title"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={locked}
            className="h-8 text-xs"
          />
          <Input
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={locked}
            className="h-8 font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || locked}
            onClick={add}
            className="h-8 gap-1 bg-[#165b33] px-3 text-xs font-medium text-white hover:bg-[#124929]"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            <span>Add Link</span>
          </Button>
        </div>

        {/* Links list */}
        {links.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#5c6470] dark:text-[#94a3b8]">
            {loaded ? "No project links submitted yet." : "Loading…"}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded border border-[#e2ded5] bg-[#faf8f5] p-2 text-xs dark:border-[#262f3c] dark:bg-[#161c24]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#1c2024] dark:text-white">{l.label}</span>
                    <span className="rounded border border-[#ded9ce] bg-white px-1.5 py-0.2 text-[10px] text-[#5c6470] dark:border-[#323d4c] dark:bg-[#1b222c] dark:text-[#94a3b8]">
                      {CATEGORY_LABELS[l.category] ?? l.category}
                    </span>
                  </div>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-[#165b33] hover:underline dark:text-[#78d69f]"
                  >
                    <span className="truncate max-w-sm">{l.url}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {statusBadge(l.status)}
                {l.status !== "VERIFIED" && !locked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-[#5c6470] hover:text-[#a82424]"
                    aria-label="Remove"
                    onClick={() => remove(l.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Read-only list of a student's project links. */
export function LinkList({ links }: { links: ProjectLinkDto[] }) {
  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">No project links added yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {links.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <Boxes className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium">{l.label}</span>
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer noopener"
            className="min-w-0 flex-1 break-all text-xs text-primary hover:underline"
          >
            {l.url}
          </a>
          <span className="shrink-0 text-xs text-muted-foreground">
            {CATEGORY_LABELS[l.category] ?? l.category}
          </span>
          {statusBadge(l.status)}
        </li>
      ))}
    </ul>
  );
}
