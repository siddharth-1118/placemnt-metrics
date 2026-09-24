"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { DOC_CATEGORIES, UPLOAD_MAX_BYTES, docCategoryLabel } from "@/lib/categories";
import type { DocumentDto } from "@/lib/types";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: DocumentDto["status"]) {
  if (status === "VERIFIED") return <Badge variant="success">Verified</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending review</Badge>;
}

/**
 * Document upload + management for the signed-in user's own submission.
 * One upload block per category; uploaded files are listed with their
 * verification status and can be removed while still unverified.
 */
export function DocumentUploader({ onChanged, locked = false }: { onChanged?: () => void; locked?: boolean }) {
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // category key
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    try {
      const res = await fetch("/api/documents/list", { cache: "no-store" });
      if (res.ok) {
        const b = await res.json();
        setDocs(b.documents ?? []);
      }
    } catch {
      /* transient */
    } finally {
      setLoaded(true);
    }
  }

  if (!loaded) {
    load().then(() => setLoaded(true));
    // Render nothing meaningful until the first fetch resolves.
    if (!loaded) return <Card><CardContent className="pt-5 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading your documents…</CardContent></Card>;
  }

  async function upload(category: string) {
    const input = inputRefs.current[category];
    const file = input?.files?.[0];
    if (!file) {
      setError("Choose a file first");
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(`"${file.name}" is larger than 10 MB`);
      return;
    }
    setError(null);
    setUploading(category);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", category);
      if (note[category]?.trim()) fd.set("note", note[category].trim());
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      input.value = "";
      setNote((n) => ({ ...n, [category]: "" }));
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      setDocs((d) => d.filter((x) => x.id !== id));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const byCategory = new Map<string, DocumentDto[]>();
  for (const d of docs) {
    const list = byCategory.get(d.category) ?? [];
    list.push(d);
    byCategory.set(d.category, list);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {DOC_CATEGORIES.map((cat) => {
          const mine = byCategory.get(cat.key) ?? [];
          return (
            <Card key={cat.key}>
              <CardContent className="space-y-3 pt-5">
                <div>
                  <Label className="text-sm">{cat.label}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cat.hint}</p>
                </div>

                {mine.length > 0 && (
                  <ul className="space-y-1.5">
                    {mine.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate hover:underline"
                          title={d.fileName}
                        >
                          {d.note || d.fileName}
                        </a>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{fmtSize(d.sizeBytes)}</span>
                        {statusBadge(d.status)}
                        {d.status !== "VERIFIED" && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove" onClick={() => remove(d.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {locked ? (
                  <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600">
                    <Lock className="h-3.5 w-3.5" /> Uploads closed by coordinator
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={(el) => { inputRefs.current[cat.key] = el; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      className="h-9 max-w-[240px] cursor-pointer text-xs"
                    />
                    <Input
                      placeholder="Caption (optional)"
                      className="h-9 max-w-[180px] text-xs"
                      value={note[cat.key] ?? ""}
                      onChange={(e) => setNote((n) => ({ ...n, [cat.key]: e.target.value }))}
                    />
                    <Button type="button" size="sm" variant="outline" disabled={uploading === cat.key} onClick={() => upload(cat.key)}>
                      {uploading === cat.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        PDF, JPG, PNG or WEBP · up to 10 MB per file. Coordinators verify each document; you can
        remove files until they are verified. {docCategoryLabel("SHL")} uploads are mandatory for
        SHL participants only.
      </p>
    </div>
  );
}

/** Read-only list of a student's documents (coordinator view / own portal). */
export function DocumentList({
  documents,
  showStatus = true,
}: {
  documents: DocumentDto[];
  showStatus?: boolean;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {documents.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <a href={d.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={d.fileName}>
            {d.note || d.fileName}
          </a>
          <span className="shrink-0 text-xs text-muted-foreground">{docCategoryLabel(d.category)}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtSize(d.sizeBytes)}</span>
          {showStatus && statusBadge(d.status)}
        </li>
      ))}
    </ul>
  );
}
