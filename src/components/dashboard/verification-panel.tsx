"use client";

import { useState } from "react";
import { Check, ExternalLink, FileText, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { docCategoryLabel, linkCategoryLabel } from "@/lib/categories";
import type { DocumentDto, ProjectLinkDto } from "@/lib/types";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "VERIFIED") return <Badge variant="success">Verified</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

async function reviewApi(
  kind: "document" | "link",
  id: string,
  status: "VERIFIED" | "REJECTED",
  note?: string
) {
  const res = await fetch("/api/documents/verify", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id, status, reviewNote: note }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b?.error ?? "Review failed");
  }
}

async function deleteApi(kind: "document" | "link", id: string) {
  const url = kind === "document" ? `/api/documents?id=${encodeURIComponent(id)}` : `/api/project-links?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b?.error ?? "Delete failed");
  }
}

/**
 * Evaluator panel: every student-uploaded document (viewable inline) and
 * project link with per-item verify / reject actions.
 */
export function VerificationPanel({
  documents,
  links,
  canScore = true,
  onChanged,
}: {
  documents: DocumentDto[];
  links: ProjectLinkDto[];
  canScore?: boolean;
  onChanged?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  async function act(
    kind: "document" | "link",
    id: string,
    status: "VERIFIED" | "REJECTED",
    note?: string
  ) {
    setError(null);
    setBusyId(id);
    try {
      await reviewApi(kind, id, status, note);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(kind: "document" | "link", id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? The student will be notified to re-upload it.`)) return;
    setError(null);
    setBusyId(id);
    try {
      await deleteApi(kind, id);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const pendingDocs = documents.filter((d) => d.status === "PENDING").length;
  const pendingLinks = links.filter((l) => l.status === "PENDING").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Documents &amp; links verification
        </h3>
        {(pendingDocs > 0 || pendingLinks > 0) && (
          <Badge variant="warning">
            {pendingDocs + pendingLinks} awaiting review
          </Badge>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {documents.length === 0 && links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The student has not uploaded any documents or added any links yet.
        </p>
      ) : (
        <div className="space-y-4">
          {documents.length > 0 && (
            <div className="space-y-1.5">
              {documents.map((d) => (
                <div key={d.id} className="rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left hover:underline"
                      onClick={() => setOpenDocId(openDocId === d.id ? null : d.id)}
                      title="Toggle preview"
                    >
                      {d.note || d.fileName}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">{docCategoryLabel(d.category)}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fmtSize(d.sizeBytes)}</span>
                    <StatusBadge status={d.status} />
                    <div className="flex shrink-0 gap-1">
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs hover:bg-accent"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                      {canScore && (
                        <Button
                          size="icon"
                          className="h-8 w-8"
                          title="Verify"
                          disabled={busyId === d.id || d.status === "VERIFIED"}
                          onClick={() => act("document", d.id, "VERIFIED")}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {canScore && (
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          title="Reject"
                          disabled={busyId === d.id || d.status === "REJECTED"}
                          onClick={() => act("document", d.id, "REJECTED", "Proof not acceptable")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        title="Delete — student must re-upload"
                        disabled={busyId === d.id}
                        onClick={() => remove("document", d.id, d.note || d.fileName)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {openDocId === d.id && (
                    <div className="border-t p-2">
                      {d.mimeType === "application/pdf" ? (
                        <iframe src={d.fileUrl} title={d.fileName} className="h-96 w-full rounded-lg border" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.fileUrl} alt={d.fileName} className="max-h-96 rounded-lg border" />
                      )}
                    </div>
                  )}
                  {d.reviewNote && (
                    <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">Review note: {d.reviewNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {links.length > 0 && (
            <div className="space-y-1.5">
              {links.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                  <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium">{l.label}</span>
                  <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-all text-xs text-primary hover:underline">
                    {l.url}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">{linkCategoryLabel(l.category)}</span>
                  <StatusBadge status={l.status} />
                  <div className="flex shrink-0 gap-1">
                    {canScore && (
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        title="Verify"
                        disabled={busyId === l.id || l.status === "VERIFIED"}
                        onClick={() => act("link", l.id, "VERIFIED")}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {canScore && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        title="Reject"
                        disabled={busyId === l.id || l.status === "REJECTED"}
                        onClick={() => act("link", l.id, "REJECTED")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      title="Delete — student must re-add"
                      disabled={busyId === l.id}
                      onClick={() => remove("link", l.id, l.label)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
