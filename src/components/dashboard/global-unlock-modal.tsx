"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  Unlock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";
import {
  UNLOCKABLE_SECTIONS_DEF,
  getUnlockedSectionLabels,
  type UnlockableSection,
  type StudentUnlockRecord,
} from "@/lib/student-unlock";

interface GlobalUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  studentCount?: number;
}

export function GlobalUnlockModal({
  isOpen,
  onClose,
  onUpdated,
  studentCount = 60,
}: GlobalUnlockModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [globalUnlock, setGlobalUnlock] = useState<StudentUnlockRecord | null>(null);
  const [isGlobalActive, setIsGlobalActive] = useState(false);
  const [selectedSections, setSelectedSections] = useState<UnlockableSection[]>(["ALL"]);
  const [reason, setReason] = useState("");
  const [flashMessage, setFlashMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    setFlashMessage(null);
    setLoading(true);

    fetch("/api/students/unlock-batch", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.globalUnlock) {
          setGlobalUnlock(data.globalUnlock);
          setIsGlobalActive(true);
          setSelectedSections(
            Array.isArray(data.globalUnlock.sections) && data.globalUnlock.sections.length > 0
              ? data.globalUnlock.sections
              : ["ALL"]
          );
          setReason(data.globalUnlock.reason || "");
        } else {
          setGlobalUnlock(null);
          setIsGlobalActive(false);
          setSelectedSections(["ALL"]);
          setReason("");
        }
      })
      .catch(() => {
        setFlashMessage({ type: "error", text: "Failed to load global unlock status" });
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  function toggleSection(secKey: UnlockableSection) {
    if (secKey === "ALL") {
      if (selectedSections.includes("ALL")) {
        setSelectedSections([]);
      } else {
        setSelectedSections(["ALL"]);
      }
      return;
    }

    let next = selectedSections.filter((k) => k !== "ALL");
    if (next.includes(secKey)) {
      next = next.filter((k) => k !== secKey);
    } else {
      next.push(secKey);
    }
    setSelectedSections(next);
  }

  async function handleUnlockAllStudents(customSections?: UnlockableSection[]) {
    const secs = customSections ?? selectedSections;
    if (!secs || secs.length === 0) {
      setFlashMessage({ type: "error", text: "Please select at least one section to unlock." });
      return;
    }

    setActionBusy(true);
    setFlashMessage(null);

    try {
      const res = await fetch("/api/students/unlock-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allStudents: true,
          sections: secs,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unlock all students");

      setGlobalUnlock(data.globalUnlock);
      setIsGlobalActive(true);
      setFlashMessage({
        type: "success",
        text: `⚡ ALL ${studentCount} students unlocked successfully (${getUnlockedSectionLabels(secs)})!`,
      });
      onUpdated?.();
    } catch (err: any) {
      setFlashMessage({ type: "error", text: err.message || "Failed to unlock all students" });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleLockAllStudents() {
    setActionBusy(true);
    setFlashMessage(null);

    try {
      const res = await fetch("/api/students/unlock-batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allStudents: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to lock students");

      setGlobalUnlock(null);
      setIsGlobalActive(false);
      setSelectedSections(["ALL"]);
      setFlashMessage({
        type: "success",
        text: "🔒 All students locked successfully. Edit permissions revoked.",
      });
      onUpdated?.();
    } catch (err: any) {
      setFlashMessage({ type: "error", text: err.message || "Failed to lock all students" });
    } finally {
      setActionBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-[#14181d] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>All Students Edit Access Control</span>
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  (Super Admin)
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Grant or revoke profile & document edit permissions for <strong>all {studentCount} students at once</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {flashMessage && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs font-medium border ${
                flashMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
              }`}
            >
              {flashMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{flashMessage.text}</span>
            </div>
          )}

          {/* Current Global Status Card */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              isGlobalActive
                ? "bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/20"
                : "bg-gray-50 border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isGlobalActive ? (
                  <Unlock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Lock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {isGlobalActive
                      ? "⚡ All Students Are Currently UNLOCKED"
                      : "🔒 All Students Are Currently LOCKED"}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isGlobalActive
                      ? `Active unlocked sections: ${getUnlockedSectionLabels(globalUnlock?.sections)}`
                      : "Students cannot edit verified fields or upload documents unless unlocked."}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full ${
                  isGlobalActive
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-300"
                }`}
              >
                {isGlobalActive ? "Active" : "Locked"}
              </span>
            </div>

            {isGlobalActive && globalUnlock && (
              <div className="mt-3 pt-3 border-t border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
                <div>
                  Granted by: <strong>{globalUnlock.unlockedBy}</strong>
                  {globalUnlock.unlockedAt && (
                    <span className="opacity-75">
                      {" "}
                      on {new Date(globalUnlock.unlockedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {globalUnlock.reason && (
                  <div className="italic text-emerald-800 dark:text-emerald-300">
                    &quot;{globalUnlock.reason}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 1-Click Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Button
              type="button"
              disabled={actionBusy}
              onClick={() => handleUnlockAllStudents(["ALL"])}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-xs shadow-sm flex items-center justify-center gap-2"
            >
              {actionBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
              <span>⚡ Unlock ALL Students (Full Profile)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={actionBusy || !isGlobalActive}
              onClick={handleLockAllStudents}
              className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 font-bold h-11 text-xs flex items-center justify-center gap-2"
            >
              {actionBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              <span>🔒 Lock ALL Students (Revoke Access)</span>
            </Button>
          </div>

          {/* Section Selection for granular unlock */}
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4 space-y-3 bg-white dark:bg-[#181c22]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Or Select Specific Sections to Unlock for All Students:
              </label>
              <button
                type="button"
                onClick={() => setSelectedSections(["ALL"])}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {UNLOCKABLE_SECTIONS_DEF.map((sec) => {
                const isChecked =
                  selectedSections.includes(sec.key) || selectedSections.includes("ALL");
                return (
                  <label
                    key={sec.key}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors text-xs ${
                      isChecked
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                        : "border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSection(sec.key)}
                      className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    <div>
                      <div className="font-semibold">{sec.shortLabel}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                        {sec.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Optional Reason / Note */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason / Note for Students (Optional):
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Allowed to update 12th marks and re-upload internship / project documents"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                disabled={actionBusy || selectedSections.length === 0}
                onClick={() => handleUnlockAllStudents()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4"
              >
                {actionBusy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                <span>Apply Selected Permissions to ALL Students</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 dark:border-neutral-800">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>Applies instantly to all {studentCount} student accounts</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}