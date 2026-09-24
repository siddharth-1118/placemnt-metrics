"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { LINK_CATEGORIES, linkCategoryLabel } from "@/lib/categories";
import type { ProjectLinkDto } from "@/lib/types";

function statusBadge(status: ProjectLinkDto["status"]) {
  if (status === "VERIFIED") return <Badge variant="success">Verified</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending review</Badge>;
}

/**
 * Add-as-many-as-you-want project links on the signed-in user's own
 * submission. Organized by the three link categories.
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

  if (!loaded && !busy) {
    load();
    setLoaded(true);
  }

  async function add() {
    setError(null);
    if (!label.trim()) return setError("Give the link a label");
    try {
      new URL(url.trim());
    } catch {
      return setError("Enter a valid URL (https://…)");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/project-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label: label.trim(), url: url.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? body?.fieldErrors?.url ?? "Could not add link");
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
      const res = await fetch(`/api/project-links?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      setLinks((l) => l.filter((x) => x.id !== id));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <Label className="text-sm">Project & portfolio links</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Projects and full-stack projects must be links — add as many as you want. In-house
            projects can use a deployed link instead of a document.
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {locked ? (
          <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600">
            <Lock className="h-3.5 w-3.5" /> Adding links is closed by coordinator
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,2fr)_auto]">
            <select
              className="h-9 rounded-lg border bg-card px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Link category"
            >
              {LINK_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <Input placeholder="Label (e.g. E-commerce app)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="button" onClick={add} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
          </div>
        )}

        {links.length > 0 && (
          <ul className="space-y-1.5">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium">{l.label}</span>
                <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-all text-xs text-primary hover:underline">
                  {l.url}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">{linkCategoryLabel(l.category)}</span>
                {statusBadge(l.status)}
                {l.status !== "VERIFIED" && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove" onClick={() => remove(l.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
          <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium">{l.label}</span>
          <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-all text-xs text-primary hover:underline">
            {l.url}
          </a>
          <span className="shrink-0 text-xs text-muted-foreground">{linkCategoryLabel(l.category)}</span>
          {statusBadge(l.status)}
        </li>
      ))}
    </ul>
  );
}
