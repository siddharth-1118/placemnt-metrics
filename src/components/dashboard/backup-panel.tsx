"use client";

import { useState, useRef } from "react";
import { Download, Upload, ShieldCheck, Database, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

interface SnapshotMetadata {
  timestamp: string;
  exportedBy: string;
  counts: {
    students: number;
    documents: number;
    projectLinks: number;
    settings?: number;
  };
}

export function DatabaseBackupPanel() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<{ file: File; meta: SnapshotMetadata; rawJson: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Backup
  async function handleDownloadBackup() {
    setDownloading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/backup", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Backup failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `srm_placement_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: "success",
        text: `Database snapshot downloaded successfully (${(blob.size / 1024).toFixed(1)} KB). A mirror copy was also saved to cloud storage.`,
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: (err as Error).message || "Failed to download backup.",
      });
    } finally {
      setDownloading(false);
    }
  }

  // 2. Select File for Restore Preview
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.data || !Array.isArray(parsed.data.students)) {
          throw new Error("Invalid backup format: missing 'data.students'");
        }

        setPreview({
          file,
          meta: {
            timestamp: parsed.timestamp || "Unknown",
            exportedBy: parsed.exportedBy || "System Admin",
            counts: {
              students: parsed.counts?.students ?? parsed.data.students.length,
              documents: parsed.counts?.documents ?? (parsed.data.documents?.length || 0),
              projectLinks: parsed.counts?.projectLinks ?? (parsed.data.projectLinks?.length || 0),
              settings: parsed.counts?.settings ?? (parsed.data.settings?.length || 0),
            },
          },
          rawJson: parsed,
        });
        setStatusMsg(null);
      } catch (err) {
        setStatusMsg({
          type: "error",
          text: `Invalid backup file: ${(err as Error).message}`,
        });
        setPreview(null);
      }
    };
    reader.readAsText(file);
  }

  // 3. Perform Restore
  async function handleExecuteRestore() {
    if (!preview) return;

    const confirmMsg = `Restore database from snapshot taken on ${new Date(preview.meta.timestamp).toLocaleString()}?\n\nThis will restore ${preview.meta.counts.students} students, ${preview.meta.counts.documents} documents, and ${preview.meta.counts.projectLinks} project links.\n\nAll existing records are preserved (idempotent upsert).`;
    if (!window.confirm(confirmMsg)) return;

    setRestoring(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview.rawJson),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.error ?? `Restore failed (${res.status})`);
      }

      setStatusMsg({
        type: "success",
        text: `Database successfully restored! ${result.message}`,
      });
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: (err as Error).message || "Failed to restore database.",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Card className="border border-emerald-500/30 bg-slate-900/60 backdrop-blur-md">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Database Backup &amp; Instant Disaster Recovery</h3>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Zero Data Loss
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Export full JSON database snapshots of all students, verified marks, documents, and settings.
                Safely restore without Pro plan limits or risking data wipes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              {downloading ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Exporting Snapshot…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download Backup (.json)
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              Restore from Backup
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json,application/json"
              className="hidden"
            />
          </div>
        </div>

        {/* Restore Preview Area */}
        {preview && (
          <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-950/30 p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                  <ShieldCheck className="h-4 w-4" />
                  Ready to Restore Snapshot: {preview.file.name}
                </div>
                <p className="text-xs text-slate-300">
                  Snapshot created at: <strong className="text-white">{new Date(preview.meta.timestamp).toLocaleString()}</strong>
                  {" "}· Exported by: <strong className="text-white">{preview.meta.exportedBy}</strong>
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-slate-800 px-2.5 py-1 text-slate-200">
                    Students: <strong className="text-emerald-400">{preview.meta.counts.students}</strong>
                  </span>
                  <span className="rounded bg-slate-800 px-2.5 py-1 text-slate-200">
                    Documents: <strong className="text-indigo-400">{preview.meta.counts.documents}</strong>
                  </span>
                  <span className="rounded bg-slate-800 px-2.5 py-1 text-slate-200">
                    Project Links: <strong className="text-amber-400">{preview.meta.counts.projectLinks}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleExecuteRestore}
                  disabled={restoring}
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                >
                  {restoring ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Restoring…
                    </>
                  ) : (
                    "Confirm & Restore Now"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={restoring}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {statusMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs ${
              statusMsg.type === "success"
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
