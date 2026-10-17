"use client";

import { useEffect, useState } from "react";
import {
  History,
  Download,
  RotateCcw,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

interface ArchiveEntry {
  id: string;
  filename: string;
  trigger: string;
  reason: string;
  timestamp: string;
  studentCount: number;
  docCount: number;
  linkCount: number;
  sizeKb: number;
  storageKey: string;
}

export function PortalArchivesPanel() {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadArchives() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/archives", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArchives(data.archives ?? []);
    } catch (e) {
      console.warn("Failed to load archives:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArchives();
  }, []);

  async function handleTakeSnapshot() {
    setCapturing(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual snapshot requested by administrator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create snapshot");

      setStatusMsg({
        type: "success",
        text: `Isolated snapshot created successfully: ${data.entry?.filename} (${data.entry?.sizeKb} KB). Stored separately in archive storage.`,
      });
      await loadArchives();
    } catch (e) {
      setStatusMsg({
        type: "error",
        text: (e as Error).message || "Snapshot creation failed",
      });
    } finally {
      setCapturing(false);
    }
  }

  async function handleRestore(entry: ArchiveEntry) {
    const confirmText = `Are you sure you want to restore to the snapshot from ${new Date(entry.timestamp).toLocaleString()}?\n\nReason: ${entry.reason}\nStudents: ${entry.studentCount} | Documents: ${entry.docCount}\n\nThis will safely sync all records to this version.`;
    if (!window.confirm(confirmText)) return;

    setRestoringId(entry.id);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/archives/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: entry.filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restoration failed");

      setStatusMsg({
        type: "success",
        text: `Restoration complete: ${data.message}`,
      });
    } catch (e) {
      setStatusMsg({
        type: "error",
        text: (e as Error).message || "Restoration failed",
      });
    } finally {
      setRestoringId(null);
    }
  }

  function getBadge(trigger: string) {
    switch (trigger) {
      case "DAILY_AUTO":
        return { label: "Daily Auto-Snapshot", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
      case "STUDENT_UPDATE":
        return { label: "Student Submission", color: "border-blue-500/40 bg-blue-500/10 text-blue-300" };
      case "COORDINATOR_UPDATE":
        return { label: "Score Update", color: "border-purple-500/40 bg-purple-500/10 text-purple-300" };
      case "VERIFICATION":
        return { label: "Proof Verification", color: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
      case "RECALCULATION":
        return { label: "Recalculation", color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" };
      default:
        return { label: "Manual Snapshot", color: "border-slate-500/40 bg-slate-500/10 text-slate-300" };
    }
  }

  return (
    <Card className="border border-indigo-500/30 bg-slate-900/60 backdrop-blur-md">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-2.5 text-indigo-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Continuous Portal Archiving &amp; Daily Snapshots</h3>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                  Separate Isolated Storage
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Every day and whenever updates arrive (submissions, mark scoring, proof verifications),
                a full snapshot is saved in an isolated archive location. Even if active tables are modified or wiped,
                these historical versions remain intact and can be restored with one click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTakeSnapshot}
              disabled={capturing}
              className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
            >
              {capturing ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Capturing…
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-3.5 w-3.5" />
                  Take Snapshot Now
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadArchives}
              disabled={loading}
              className="text-slate-400 hover:text-white"
              title="Refresh archive list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Feedback Message */}
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

        {/* Snapshot History Table */}
        <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-slate-950/40">
          <div className="border-b border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Preserved Historical Snapshots ({archives.length})</span>
            </div>
            <span className="text-[11px] text-slate-400">Isolated Cloud &amp; Disk Copies</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {loading && archives.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading historical archives…</div>
            ) : archives.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No historical archives recorded yet. Click &quot;Take Snapshot Now&quot; to save the first baseline!
              </div>
            ) : (
              archives.map((entry) => {
                const badge = getBadge(entry.trigger);
                const isRestoring = restoringId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 hover:bg-white/[0.02] gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="font-medium text-white">
                          {new Date(entry.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400 text-[11px]">{entry.sizeKb} KB</span>
                      </div>
                      <p className="text-slate-300 text-[11px] line-clamp-1">{entry.reason}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-emerald-400" />
                          <span>{entry.studentCount} candidates</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-indigo-400" />
                          <span>{entry.docCount} docs</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={`/api/admin/archives/${encodeURIComponent(entry.filename)}`}
                        download={entry.filename}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
                        title="Download raw snapshot JSON"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestore(entry)}
                        disabled={isRestoring}
                        className="h-7 text-[11px] font-medium text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                        title="Restore portal database to this point in time"
                      >
                        {isRestoring ? (
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 h-3 w-3" />
                        )}
                        Restore
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
