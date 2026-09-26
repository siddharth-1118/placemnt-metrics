"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload, CheckCircle2, Clock, XCircle, FileCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { DOC_CATEGORIES, UPLOAD_MAX_BYTES } from "@/lib/categories";
import type { DocumentDto } from "@/lib/types";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: DocumentDto["status"]) {
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

export function DocumentUploader({
  initialDocs,
  onChanged,
}: {
  studentId?: string;
  uploadToken?: string;
  initialDocs?: DocumentDto[];
  onChanged?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentDto[]>(initialDocs ?? []);
  const [loaded, setLoaded] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
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

  async function upload(category: string) {
    const input = inputRefs.current[category];
    const file = input?.files?.[0];
    if (!file) {
      setError("Please select a file to upload first");
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(`"${file.name}" exceeds the maximum allowed size of 10 MB`);
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
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
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
      <div>
        <h3 className="text-sm font-bold text-[#1c2024] dark:text-white">
          Document Proof Uploads
        </h3>
        <p className="mt-0.5 text-xs text-[#5c6470] dark:text-[#94a3b8]">
          Upload marksheets, certificates, and internship proof for coordinator verification.
        </p>
      </div>

      {error && (
        <div className="rounded border border-[#f8c4c4] bg-[#fdeded] p-2.5 text-xs text-[#a82424] dark:border-[#5e2626] dark:bg-[#3d1818] dark:text-[#f38d8d]">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {DOC_CATEGORIES.map((cat) => {
          const mine = byCategory.get(cat.key) ?? [];
          return (
            <Card
              key={cat.key}
              className="rounded-md border border-[#e2ded5] bg-white p-3.5 dark:border-[#262f3c] dark:bg-[#1b222c]"
            >
              <CardContent className="space-y-3 p-0">
                <div className="flex items-start justify-between">
                  <div>
                    <Label className="text-xs font-bold text-[#1c2024] dark:text-white">{cat.label}</Label>
                    <p className="mt-0.5 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">{cat.hint}</p>
                  </div>
                  <span className="rounded border border-[#ded9ce] bg-[#faf8f5] px-2 py-0.5 font-mono text-[10px] text-[#5c6470] dark:border-[#323d4c] dark:bg-[#161c24] dark:text-[#94a3b8]">
                    {mine.length} uploaded
                  </span>
                </div>

                {mine.length > 0 && (
                  <ul className="space-y-1.5">
                    {mine.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-2 rounded border border-[#e2ded5] bg-[#faf8f5] p-2 text-xs dark:border-[#262f3c] dark:bg-[#161c24]"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[#165b33] dark:text-[#78d69f]" />
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate font-medium text-[#1c2024] hover:underline dark:text-white"
                          title={d.fileName}
                        >
                          {d.note || d.fileName}
                        </a>
                        <span className="shrink-0 font-mono text-[10px] text-[#5c6470] dark:text-[#94a3b8]">
                          {fmtSize(d.sizeBytes)}
                        </span>
                        {statusBadge(d.status)}
                        {d.status !== "VERIFIED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-[#5c6470] hover:text-[#a82424]"
                            aria-label="Remove"
                            onClick={() => remove(d.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-[#e2ded5] pt-2.5 dark:border-[#262f3c]">
                  <Input
                    ref={(el) => {
                      inputRefs.current[cat.key] = el;
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    className="h-8 max-w-[200px] cursor-pointer text-xs file:mr-2 file:rounded file:border-0 file:bg-[#f0ece4] file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-[#1c2024] dark:file:bg-[#232b36] dark:file:text-white"
                  />
                  <Input
                    placeholder="Caption (e.g. Sem 4 Marksheet)"
                    className="h-8 max-w-[170px] text-xs"
                    value={note[cat.key] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [cat.key]: e.target.value }))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={uploading === cat.key}
                    onClick={() => upload(cat.key)}
                    className="h-8 gap-1 bg-[#165b33] px-3 text-xs font-medium text-white hover:bg-[#124929]"
                  >
                    {uploading === cat.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    <span>Upload</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
