"use client";

import { useState } from "react";
import { Check, ExternalLink, FileText, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { docCategoryLabel, linkCategoryLabel, auditStudentDocuments } from "@/lib/categories";
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
  onChanged,
}: {
  documents: DocumentDto[];
  links: ProjectLinkDto[];
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
  const audit = auditStudentDocuments(documents);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1c2024] dark:text-white">
            Document Verification
          </h3>
          {(pendingDocs > 0 || pendingLinks > 0) && (
            <Badge variant="warning">
              {pendingDocs + pendingLinks} awaiting review
            </Badge>
          )}
        </div>
        <div className="text-xs">
          {audit.isComplete ? (
            <span className="font-semibold text-[#165b33] dark:text-[#78d69f] inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> All Mandatory Documents Uploaded
            </span>
          ) : (
            <span className="font-semibold text-[#b45309] dark:text-[#fcd34d] inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-[#d97706]" /> {audit.summaryText}
            </span>
          )}
        </div>
      </div>

      {/* Audit Banner: Highlight Missing Documents or Complete Status */}
      {audit.missingCount > 0 ? (
        <div className="rounded-md border border-[#fcd34d] bg-[#fef3c7] p-3 text-xs dark:border-[#78350f] dark:bg-[#381e05]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#d97706] mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[#92400e] dark:text-[#fde68a]">
                Missing Documents ({audit.missingCount} of {audit.requiredTotal} required documents not uploaded)
              </p>
              <p className="text-[11px] text-[#78350f] dark:text-[#fcd34d]">
                The student has not yet uploaded the following mandatory verification documents:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {audit.missingDocLabels.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded border border-[#fca5a5] bg-[#fee2e2] px-2 py-0.5 text-[11px] font-semibold text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#450a0a] dark:text-[#fca5a5]"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span>{name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-[#b8ddc4] bg-[#eaf4ed] p-3 text-xs text-[#165b33] dark:border-[#215736] dark:bg-[#133822] dark:text-[#78d69f]">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#165b33] dark:text-[#78d69f] mt-0.5" />
            <div>
              <p className="font-bold">
                Mandatory Verification Complete ({audit.requiredTotal}/{audit.requiredTotal})
              </p>
              <p className="mt-0.5 text-[11px] text-[#2e6945] dark:text-[#a0e4bd]">
                All mandatory verification marksheets (10th Marksheet, 12th Marksheet, CGPA Marksheet) have been uploaded.
                {audit.hasPendingVerification
                  ? " Please review pending uploads below before final verification."
                  : " All uploaded documents are accounted for."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Verification Checklist */}
      <div className="rounded-md border border-[#e2ded5] bg-[#faf8f5] p-3 dark:border-[#262f3c] dark:bg-[#161c24]">
        <div className="text-xs font-bold text-[#1c2024] dark:text-white mb-2">
          Required Verification Marksheets Checklist
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {audit.checklist.map((item) => (
            <div
              key={item.category}
              className={`rounded border p-2.5 text-xs flex flex-col justify-between ${
                item.uploaded
                  ? "border-[#b8ddc4] bg-white dark:border-[#215736] dark:bg-[#1b222c]"
                  : "border-[#fca5a5] bg-white dark:border-[#7f1d1d] dark:bg-[#1b222c]"
              }`}
            >
              <div>
                <div className="font-semibold text-[#1c2024] dark:text-white flex items-center justify-between">
                  <span>{item.label}</span>
                  {item.uploaded ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#165b33] dark:text-[#78d69f]" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-[#dc2626]" />
                  )}
                </div>
                <p className="text-[10px] text-[#5c6470] dark:text-[#94a3b8] truncate mt-0.5">
                  {item.fileName || (item.uploaded ? "File attached" : "Not uploaded")}
                </p>
              </div>
              <div className="mt-2 pt-1 border-t border-[#f0ece4] dark:border-[#262f3c]">
                {item.uploaded ? (
                  item.status === "VERIFIED" ? (
                    <Badge variant="success" className="text-[10px]">Verified</Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">Uploaded · Pending Review</Badge>
                  )
                ) : (
                  <Badge variant="destructive" className="text-[10px] bg-[#fee2e2] text-[#991b1b] border-[#fca5a5] dark:bg-[#450a0a] dark:text-[#fca5a5]">
                    Missing
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {documents.length === 0 && links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No files or external links have been submitted by the student yet.
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
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        title="Verify"
                        disabled={busyId === d.id || d.status === "VERIFIED"}
                        onClick={() => act("document", d.id, "VERIFIED")}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
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
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      title="Verify"
                      disabled={busyId === l.id || l.status === "VERIFIED"}
                      onClick={() => act("link", l.id, "VERIFIED")}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
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
