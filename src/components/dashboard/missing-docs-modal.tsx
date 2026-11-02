"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { DOC_CATEGORIES, REQUIRED_DOC_CATEGORIES, auditStudentDocuments } from "@/lib/categories";
import type { StudentDto } from "@/lib/types";

interface MissingDocsModalProps {
  students: StudentDto[];
  isOpen: boolean;
  initialTopic?: string;
  onClose: () => void;
}

type FormatMode = "whatsapp" | "email" | "table";

export function MissingDocsModal({
  students,
  isOpen,
  initialTopic = "ALL_REQUIRED",
  onClose,
}: MissingDocsModalProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [formatMode, setFormatMode] = useState<FormatMode>("whatsapp");
  const [copied, setCopied] = useState(false);

  // Analyze all students for missing documents across categories
  const topicData = useMemo(() => {
    return DOC_CATEGORIES.map((cat) => {
      const defaulters = students.filter(
        (s) => !(s.documents ?? []).some((d) => d.category === cat.key && d.status !== "REJECTED")
      );
      return {
        key: cat.key,
        label: cat.label,
        required: !!cat.required,
        defaulters,
      };
    });
  }, [students]);

  // Mandatory required defaulters (missing any of 10th, 12th, CGPA)
  const requiredDefaulters = useMemo(() => {
    return students.filter((s) => !auditStudentDocuments(s.documents).isComplete);
  }, [students]);

  // Zero uploads (no documents at all)
  const zeroUploads = useMemo(() => {
    return students.filter((s) => !s.documents || s.documents.length === 0);
  }, [students]);

  // Current active list based on selectedTopic
  const activeDefaulters = useMemo(() => {
    if (selectedTopic === "ALL_REQUIRED") {
      return requiredDefaulters;
    }
    if (selectedTopic === "ZERO_UPLOADS") {
      return zeroUploads;
    }
    const match = topicData.find((t) => t.key === selectedTopic);
    return match ? match.defaulters : [];
  }, [selectedTopic, requiredDefaulters, zeroUploads, topicData]);

  // Generate shareable notice text based on formatMode and selectedTopic
  const shareableNotice = useMemo(() => {
    const today = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (formatMode === "whatsapp") {
      let text = `📢 *SRM School of Computing — Placement Document Defaulters List*\n`;
      text += `📅 Date: ${today}\n\n`;

      if (selectedTopic === "ALL_REQUIRED") {
        text += `⚠️ *The following candidates have NOT completed all mandatory marksheets (10th, 12th, CGPA):*\n\n`;

        REQUIRED_DOC_CATEGORIES.forEach((cat) => {
          const match = topicData.find((t) => t.key === cat.key);
          const list = match?.defaulters ?? [];
          text += `📁 *Missing ${cat.label} (${list.length} students):*\n`;
          if (list.length === 0) {
            text += `  ✓ All candidates have uploaded.\n\n`;
          } else {
            list.forEach((s, idx) => {
              text += `  ${idx + 1}. ${s.registerNumber} - ${s.fullName} (${s.email})\n`;
            });
            text += `\n`;
          }
        });
      } else if (selectedTopic === "ZERO_UPLOADS") {
        text += `❌ *Candidates with ZERO uploaded documents (${zeroUploads.length} students):*\n\n`;
        zeroUploads.forEach((s, idx) => {
          text += `  ${idx + 1}. ${s.registerNumber} - ${s.fullName} (${s.email})\n`;
        });
        text += `\n`;
      } else {
        const topic = topicData.find((t) => t.key === selectedTopic);
        text += `⚠️ *Candidates missing ${topic?.label || selectedTopic} (${activeDefaulters.length} students):*\n\n`;
        activeDefaulters.forEach((s, idx) => {
          text += `  ${idx + 1}. ${s.registerNumber} - ${s.fullName} (${s.email})\n`;
        });
        text += `\n`;
      }

      text += `🔗 *Action Required:* Please log in to the placement portal and upload the missing verification files immediately:\n`;
      text += `https://placemnt-metrics.vercel.app/my-submission\n`;
      return text;
    }

    if (formatMode === "email") {
      let text = `Subject: [Action Required] Missing Placement Verification Documents — SRM School of Computing\n\n`;
      text += `Dear Candidates,\n\n`;
      text += `This is a reminder from the AO1 Placement Evaluation Team. As of ${today}, our records indicate that the following students have not uploaded their required verification documents:\n\n`;

      if (selectedTopic === "ALL_REQUIRED") {
        REQUIRED_DOC_CATEGORIES.forEach((cat) => {
          const match = topicData.find((t) => t.key === cat.key);
          const list = match?.defaulters ?? [];
          text += `--- Missing ${cat.label} (${list.length} students) ---\n`;
          list.forEach((s, idx) => {
            text += `${idx + 1}. ${s.registerNumber} - ${s.fullName} <${s.email}> (FA: ${s.facultyAdvisor || "Not assigned"})\n`;
          });
          text += `\n`;
        });
      } else {
        const topic = topicData.find((t) => t.key === selectedTopic);
        text += `--- Missing ${topic?.label || selectedTopic} (${activeDefaulters.length} students) ---\n`;
        activeDefaulters.forEach((s, idx) => {
          text += `${idx + 1}. ${s.registerNumber} - ${s.fullName} <${s.email}> (FA: ${s.facultyAdvisor || "Not assigned"})\n`;
        });
        text += `\n`;
      }

      text += `Kindly submit all required proofs without delay to complete your profile verification:\n`;
      text += `Portal: https://placemnt-metrics.vercel.app/login\n\n`;
      text += `Regards,\nSRM School of Computing Placement Cell`;
      return text;
    }

    // Tab-separated format (for Excel / Google Sheets copy-paste)
    let tsv = `Register Number\tFull Name\tEmail\tFaculty Advisor\tMissing Category\n`;
    activeDefaulters.forEach((s) => {
      const audit = auditStudentDocuments(s.documents);
      const missingStr =
        selectedTopic === "ALL_REQUIRED"
          ? audit.missingDocLabels.join(", ")
          : topicData.find((t) => t.key === selectedTopic)?.label || selectedTopic;
      tsv += `${s.registerNumber}\t${s.fullName}\t${s.email}\t${s.facultyAdvisor || "—"}\t${missingStr}\n`;
    });
    return tsv;
  }, [formatMode, selectedTopic, topicData, activeDefaulters, requiredDefaulters, zeroUploads]);

  // Copy notice to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareableNotice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = shareableNotice;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Download CSV of active defaulters
  const handleDownloadCsv = () => {
    if (!activeDefaulters.length) return;
    const headers = [
      "Register Number",
      "Full Name",
      "Email",
      "Faculty Advisor",
      "Status",
      "Missing Documents",
      "Total Uploads",
      "Placement Score",
    ];

    const rows = activeDefaulters.map((s) => {
      const audit = auditStudentDocuments(s.documents);
      return [
        `"${s.registerNumber}"`,
        `"${s.fullName}"`,
        `"${s.email}"`,
        `"${s.facultyAdvisor || "—"}"`,
        s.status,
        `"${audit.missingDocLabels.join("; ") || "None"}"`,
        s.documents.length,
        s.scores.total,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SRM_Placement_Defaulters_${selectedTopic}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-[#e2ded5] bg-white shadow-2xl dark:border-[#262f3c] dark:bg-[#1b222c]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2ded5] p-5 dark:border-[#262f3c]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b45309]/10 text-[#b45309] dark:bg-[#b45309]/20 dark:text-[#fcd34d]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1c2024] dark:text-white">
                Share Missing Documents &amp; Defaulters Notice
              </h2>
              <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                Extract, format, and share lists of candidates who have not submitted required documents.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5c6470] hover:bg-[#f6f5f2] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:bg-[#222a36] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Category / Topic Selector Tabs */}
          <div>
            <label className="text-xs font-bold text-[#1c2024] dark:text-white mb-2 block">
              1. Select Missing Document Topic:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedTopic("ALL_REQUIRED")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedTopic === "ALL_REQUIRED"
                    ? "bg-[#165b33] text-white shadow-sm"
                    : "border border-[#d8d3c7] bg-white text-[#1c2024] hover:bg-[#f6f5f2] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#f0ede6]"
                }`}
              >
                All Mandatory Defaulters ({requiredDefaulters.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedTopic("ZERO_UPLOADS")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedTopic === "ZERO_UPLOADS"
                    ? "bg-[#991b1b] text-white shadow-sm"
                    : "border border-[#fca5a5] bg-[#fee2e2]/40 text-[#991b1b] hover:bg-[#fee2e2] dark:border-[#7f1d1d] dark:bg-[#450a0a]/40 dark:text-[#fca5a5]"
                }`}
              >
                Zero Uploads ({zeroUploads.length})
              </button>

              {topicData.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedTopic(t.key)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selectedTopic === t.key
                      ? "bg-[#b45309] text-white shadow-sm"
                      : "border border-[#d8d3c7] bg-white text-[#5c6470] hover:text-[#1c2024] hover:bg-[#f6f5f2] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#94a3b8]"
                  }`}
                >
                  {t.label} ({t.defaulters.length})
                </button>
              ))}
            </div>
          </div>

          {/* 2. Format Selector & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-[#e2ded5] py-3 dark:border-[#262f3c]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#1c2024] dark:text-white mr-1">
                Format:
              </span>
              <button
                type="button"
                onClick={() => setFormatMode("whatsapp")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${
                  formatMode === "whatsapp"
                    ? "bg-[#165b33] text-white"
                    : "border border-[#d8d3c7] bg-white text-[#5c6470] dark:border-[#333e4e] dark:bg-[#161c24]"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp / Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setFormatMode("email")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${
                  formatMode === "email"
                    ? "bg-[#165b33] text-white"
                    : "border border-[#d8d3c7] bg-white text-[#5c6470] dark:border-[#333e4e] dark:bg-[#161c24]"
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email Draft</span>
              </button>

              <button
                type="button"
                onClick={() => setFormatMode("table")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${
                  formatMode === "table"
                    ? "bg-[#165b33] text-white"
                    : "border border-[#d8d3c7] bg-white text-[#5c6470] dark:border-[#333e4e] dark:bg-[#161c24]"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel Tab-Separated</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadCsv}
                disabled={!activeDefaulters.length}
                className="h-8 text-xs border-[#b8ddc4] text-[#165b33] hover:bg-[#eaf4ed] dark:border-[#265335] dark:text-[#78d69f]"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                <span>Download CSV</span>
              </Button>

              <Button
                size="sm"
                onClick={handleCopy}
                disabled={!activeDefaulters.length}
                className="h-8 bg-[#165b33] text-xs font-semibold text-white hover:bg-[#124929]"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-white" />
                    <span>Copied Notice!</span>
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    <span>Copy Notice to Share</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 3. Formatted Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#1c2024] dark:text-white">
                Shareable Text Preview ({activeDefaulters.length} students):
              </span>
              <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                Click &quot;Copy Notice to Share&quot; to copy directly to clipboard
              </span>
            </div>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#e2ded5] bg-[#faf8f5] p-3 text-xs font-mono text-[#1c2024] leading-relaxed dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#f0ede6]">
              {shareableNotice || "No students match this category."}
            </pre>
          </div>

          {/* 4. Student Roster Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1c2024] dark:text-white">
                Defaulters Roster ({activeDefaulters.length} Students):
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-[#e2ded5] dark:border-[#262f3c]">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Register Number</th>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Faculty Advisor</th>
                    <th>Missing Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDefaulters.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-[#5c6470]">
                        ✓ No defaulters found. All students have uploaded this document!
                      </td>
                    </tr>
                  ) : (
                    activeDefaulters.map((s, idx) => {
                      const audit = auditStudentDocuments(s.documents);
                      return (
                        <tr key={s.id}>
                          <td className="text-stone-400 font-medium">{idx + 1}</td>
                          <td className="font-mono font-medium text-[#1c2024] dark:text-[#f0ede6]">
                            {s.registerNumber}
                          </td>
                          <td className="font-semibold text-[#1c2024] dark:text-white">
                            {s.fullName}
                          </td>
                          <td className="text-[#5c6470] dark:text-[#94a3b8]">{s.email}</td>
                          <td className="text-[#5c6470] dark:text-[#94a3b8]">
                            {s.facultyAdvisor || "—"}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {audit.missingDocLabels.map((lbl) => (
                                <Badge
                                  key={lbl}
                                  variant="destructive"
                                  className="text-[10px] bg-[#fee2e2] text-[#991b1b] border-[#fca5a5] dark:bg-[#450a0a] dark:text-[#fca5a5]"
                                >
                                  {lbl}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#e2ded5] bg-[#faf8f5] px-5 py-3 dark:border-[#262f3c] dark:bg-[#161c24]">
          <div className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Showing <strong>{activeDefaulters.length}</strong> candidates needing document uploads.
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
