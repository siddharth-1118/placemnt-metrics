"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { DOC_CATEGORIES, REQUIRED_DOC_CATEGORIES, auditStudentDocuments } from "@/lib/categories";
import type { StudentDto } from "@/lib/types";

interface MissingDocsModalProps {
  students: StudentDto[];
  isOpen: boolean;
  initialTopic?: string;
  initialTab?: "email" | "broadcast" | "share" | "roster";
  onClose: () => void;
}

type ModalTab = "email" | "broadcast" | "share" | "roster";
type FormatMode = "whatsapp" | "email" | "table";
type AudienceType = "FILTERED" | "ALL_REQUIRED" | "ZERO_UPLOADS" | "ALL_STUDENTS";

const DEFAULT_BROADCAST_TITLE = "⚠️ Action Required: Upload Missing Placement Documents";
const DEFAULT_BROADCAST_BODY =
  "Dear {name}, our placement records indicate that you have not uploaded: {missing_documents}. Please log in to the student portal and upload your verification files immediately to maintain your placement eligibility.";

const DEFAULT_EMAIL_SUBJECT = "[Action Required] Upload Missing Placement Verification Documents — SRM";
const DEFAULT_EMAIL_BODY =
  "Our placement verification records indicate that you have pending or missing verification documents. Please log in and upload these verification files immediately to maintain your eligibility for campus recruitment drives and company shortlists.";

export function MissingDocsModal({
  students,
  isOpen,
  initialTopic = "ALL_REQUIRED",
  initialTab = "email",
  onClose,
}: MissingDocsModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [formatMode, setFormatMode] = useState<FormatMode>("whatsapp");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [copiedBcc, setCopiedBcc] = useState(false);

  // Email Server config & state
  const [emailConfig, setEmailConfig] = useState<{
    configured: boolean;
    info?: { configured: boolean; provider: string; from: string };
  } | null>(null);
  const [emailAudience, setEmailAudience] = useState<AudienceType>("FILTERED");
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    mode?: string;
  } | null>(null);

  // In-app Broadcast state
  const [broadcastAudience, setBroadcastAudience] = useState<AudienceType>("FILTERED");
  const [customTitle, setCustomTitle] = useState(DEFAULT_BROADCAST_TITLE);
  const [customMessage, setCustomMessage] = useState(DEFAULT_BROADCAST_BODY);
  const [broadcastKind, setBroadcastKind] = useState<"WARNING" | "INFO">("WARNING");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  // Roster state
  const [rosterSearch, setRosterSearch] = useState("");
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);
  const [singleSentMap, setSingleSentMap] = useState<Record<string, boolean>>({});
  const [singleEmailSendingId, setSingleEmailSendingId] = useState<string | null>(null);
  const [singleEmailSentMap, setSingleEmailSentMap] = useState<Record<string, boolean>>({});

  // Check email transport status on mount
  useEffect(() => {
    fetch("/api/students/send-email")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setEmailConfig(data);
      })
      .catch(() => {});
  }, []);

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

  // Selected topic display label
  const selectedTopicLabel = useMemo(() => {
    if (selectedTopic === "ALL_REQUIRED") return "All Mandatory Marksheets (10th, 12th, CGPA)";
    if (selectedTopic === "ZERO_UPLOADS") return "Candidates with Zero Uploads";
    const found = topicData.find((t) => t.key === selectedTopic);
    return found ? found.label : selectedTopic;
  }, [selectedTopic, topicData]);

  // Audience list for Email tab
  const emailList = useMemo(() => {
    if (emailAudience === "FILTERED") return activeDefaulters;
    if (emailAudience === "ALL_REQUIRED") return requiredDefaulters;
    if (emailAudience === "ZERO_UPLOADS") return zeroUploads;
    return students;
  }, [emailAudience, activeDefaulters, requiredDefaulters, zeroUploads, students]);

  // Audience list for Broadcast tab
  const broadcastList = useMemo(() => {
    if (broadcastAudience === "FILTERED") return activeDefaulters;
    if (broadcastAudience === "ALL_REQUIRED") return requiredDefaulters;
    if (broadcastAudience === "ZERO_UPLOADS") return zeroUploads;
    return students;
  }, [broadcastAudience, activeDefaulters, requiredDefaulters, zeroUploads, students]);

  // Sample student for live preview in Email tab
  const sampleEmailStudent = useMemo(() => {
    return emailList[0] || null;
  }, [emailList]);

  const sampleEmailPreview = useMemo(() => {
    if (!sampleEmailStudent) return null;
    const audit = auditStudentDocuments(sampleEmailStudent.documents);
    const missingText =
      audit.missingDocLabels.length > 0 ? audit.missingDocLabels.join(", ") : "Mandatory Verification Documents";

    const subject = emailSubject
      .replaceAll("{name}", sampleEmailStudent.fullName)
      .replaceAll("{missing_documents}", missingText)
      .replaceAll("{register_number}", sampleEmailStudent.registerNumber);

    const body = emailBody
      .replaceAll("{name}", sampleEmailStudent.fullName)
      .replaceAll("{missing_documents}", missingText)
      .replaceAll("{register_number}", sampleEmailStudent.registerNumber);

    return {
      student: sampleEmailStudent,
      missingText,
      subject,
      body,
    };
  }, [sampleEmailStudent, emailSubject, emailBody]);

  // Sample student for live preview in Broadcast tab
  const sampleBroadcastStudent = useMemo(() => {
    return broadcastList[0] || null;
  }, [broadcastList]);

  const sampleBroadcastPreviewText = useMemo(() => {
    if (!sampleBroadcastStudent) return "No matching candidates found for this target.";
    const audit = auditStudentDocuments(sampleBroadcastStudent.documents);
    const missingText =
      audit.missingDocLabels.length > 0 ? audit.missingDocLabels.join(", ") : "Required Placement Documents";

    return customMessage
      .replaceAll("{name}", sampleBroadcastStudent.fullName)
      .replaceAll("{missing_documents}", missingText)
      .replaceAll("{register_number}", sampleBroadcastStudent.registerNumber);
  }, [sampleBroadcastStudent, customMessage]);

  const sampleBroadcastPreviewTitle = useMemo(() => {
    if (!sampleBroadcastStudent) return customTitle;
    const audit = auditStudentDocuments(sampleBroadcastStudent.documents);
    const missingText =
      audit.missingDocLabels.length > 0 ? audit.missingDocLabels.join(", ") : "Required Placement Documents";

    return customTitle
      .replaceAll("{name}", sampleBroadcastStudent.fullName)
      .replaceAll("{missing_documents}", missingText);
  }, [sampleBroadcastStudent, customTitle]);

  // Comma-separated BCC emails for quick copy
  const bccEmails = useMemo(() => {
    return activeDefaulters
      .map((s) => s.email)
      .filter((e) => Boolean(e) && e.includes("@"))
      .join(", ");
  }, [activeDefaulters]);

  // Mailto link for default email client
  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("[Action Required] Missing Placement Verification Documents — SRM");
    const bccList = activeDefaulters
      .slice(0, 50)
      .map((s) => s.email)
      .filter((e) => Boolean(e) && e.includes("@"))
      .join(",");
    const body = encodeURIComponent(
      `Dear Candidate,\n\nOur records indicate that you have pending or missing placement verification documents on the SRM portal.\n\nPlease log in and complete your document submissions immediately:\nhttps://placement-metrics.vercel.app/my-submission\n\nRegards,\nSRM School of Computing Placement Cell`
    );
    return `mailto:placement@srmist.edu.in?bcc=${bccList}&subject=${subject}&body=${body}`;
  }, [activeDefaulters]);

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
      text += `https://placement-metrics.vercel.app/my-submission\n`;
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
      text += `Portal: https://placement-metrics.vercel.app/login\n\n`;
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
  }, [formatMode, selectedTopic, topicData, activeDefaulters, zeroUploads]);

  // Copy notice to clipboard
  const handleCopyNotice = async () => {
    try {
      await navigator.clipboard.writeText(shareableNotice);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareableNotice;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    }
  };

  // Copy all BCC emails
  const handleCopyBcc = async () => {
    if (!bccEmails) return;
    try {
      await navigator.clipboard.writeText(bccEmails);
      setCopiedBcc(true);
      setTimeout(() => setCopiedBcc(false), 2500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = bccEmails;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedBcc(true);
      setTimeout(() => setCopiedBcc(false), 2500);
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

  // Dispatch Direct Emails to student mailboxes
  const handleSendEmails = async () => {
    if (sendingEmail) return;
    setSendingEmail(true);
    setEmailResult(null);

    let targetPayload: {
      target: "MISSING_MANDATORY" | "MISSING_TOPIC" | "ALL_STUDENTS" | "ZERO_UPLOADS";
      topicCategory?: string;
    } = { target: "MISSING_MANDATORY" };

    if (emailAudience === "FILTERED") {
      if (selectedTopic === "ALL_REQUIRED") {
        targetPayload = { target: "MISSING_MANDATORY" };
      } else if (selectedTopic === "ZERO_UPLOADS") {
        targetPayload = { target: "ZERO_UPLOADS" };
      } else {
        targetPayload = { target: "MISSING_TOPIC", topicCategory: selectedTopic };
      }
    } else if (emailAudience === "ALL_REQUIRED") {
      targetPayload = { target: "MISSING_MANDATORY" };
    } else if (emailAudience === "ZERO_UPLOADS") {
      targetPayload = { target: "ZERO_UPLOADS" };
    } else if (emailAudience === "ALL_STUDENTS") {
      targetPayload = { target: "ALL_STUDENTS" };
    }

    try {
      const res = await fetch("/api/students/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...targetPayload,
          customSubject: emailSubject.trim(),
          customMessage: emailBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch reminder emails.");
      }

      setEmailResult({
        success: true,
        message: data.message || `Dispatched reminder emails to ${data.count} students.`,
        count: data.count,
        mode: data.mode,
      });
    } catch (err: unknown) {
      setEmailResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error sending reminder emails.",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Dispatch broadcast notification to student portals
  const handleSendBroadcast = async () => {
    if (sendingBroadcast) return;
    setSendingBroadcast(true);
    setBroadcastResult(null);

    let targetPayload: {
      target: "MISSING_MANDATORY" | "MISSING_TOPIC" | "ALL_STUDENTS" | "ZERO_UPLOADS";
      topicCategory?: string;
      studentIds?: string[];
    } = { target: "MISSING_MANDATORY" };

    if (broadcastAudience === "FILTERED") {
      if (selectedTopic === "ALL_REQUIRED") {
        targetPayload = { target: "MISSING_MANDATORY" };
      } else if (selectedTopic === "ZERO_UPLOADS") {
        targetPayload = { target: "ZERO_UPLOADS" };
      } else {
        targetPayload = { target: "MISSING_TOPIC", topicCategory: selectedTopic };
      }
    } else if (broadcastAudience === "ALL_REQUIRED") {
      targetPayload = { target: "MISSING_MANDATORY" };
    } else if (broadcastAudience === "ZERO_UPLOADS") {
      targetPayload = { target: "ZERO_UPLOADS" };
    } else if (broadcastAudience === "ALL_STUDENTS") {
      targetPayload = { target: "ALL_STUDENTS" };
    }

    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...targetPayload,
          customTitle: customTitle.trim(),
          customMessage: customMessage.trim(),
          kind: broadcastKind,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send broadcast notifications.");
      }

      setBroadcastResult({
        success: true,
        message: data.message || `Dispatched notifications to ${data.count} students.`,
        count: data.count,
      });
    } catch (err: unknown) {
      setBroadcastResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error sending notifications.",
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Send single direct email to a student from Roster tab
  const handleSendSingleEmail = async (student: StudentDto) => {
    setSingleEmailSendingId(student.id);
    try {
      const audit = auditStudentDocuments(student.documents);
      const missingText =
        audit.missingDocLabels.length > 0 ? audit.missingDocLabels.join(", ") : "Required Marksheets";

      const res = await fetch("/api/students/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "CUSTOM_IDS",
          studentIds: [student.id],
          customSubject: `[Action Required] Missing Placement Verification Documents (${student.registerNumber})`,
          customMessage: `Dear ${student.fullName}, our placement records indicate that you have not uploaded: ${missingText}. Please upload your verification documents on the portal immediately.`,
        }),
      });

      if (res.ok) {
        setSingleEmailSentMap((prev) => ({ ...prev, [student.id]: true }));
      }
    } catch {
      // Ignored
    } finally {
      setSingleEmailSendingId(null);
    }
  };

  // Send single direct in-app reminder to a student from Roster tab
  const handleSendSingleReminder = async (student: StudentDto) => {
    setSingleSendingId(student.id);
    try {
      const audit = auditStudentDocuments(student.documents);
      const missingText =
        audit.missingDocLabels.length > 0 ? audit.missingDocLabels.join(", ") : "Required Documents";

      const title = `⚠️ Action Required: Missing Placement Documents (${student.registerNumber})`;
      const body = `Dear ${student.fullName}, our placement records indicate that you have not uploaded: ${missingText}. Please upload your verification documents on the portal immediately.`;

      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "ALL_STUDENTS",
          studentIds: [student.id],
          customTitle: title,
          customMessage: body,
          kind: "WARNING",
        }),
      });

      if (res.ok) {
        setSingleSentMap((prev) => ({ ...prev, [student.id]: true }));
      }
    } catch {
      // Ignored
    } finally {
      setSingleSendingId(null);
    }
  };

  // Filter roster for search query
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return activeDefaulters;
    const q = rosterSearch.toLowerCase();
    return activeDefaulters.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.registerNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.facultyAdvisor && s.facultyAdvisor.toLowerCase().includes(q))
    );
  }, [activeDefaulters, rosterSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-xl border border-[#e2ded5] bg-white shadow-2xl dark:border-[#262f3c] dark:bg-[#1b222c]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2ded5] p-4 sm:p-5 dark:border-[#262f3c]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#165b33]/10 text-[#165b33] dark:bg-[#165b33]/25 dark:text-[#78d69f]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1c2024] dark:text-white flex items-center gap-2">
                <span>Send Emails &amp; Defaulter Notifications</span>
              </h2>
              <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                Send personalized reminder emails, broadcast portal alerts, or copy BCC email rosters.
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

        {/* Modal Primary Navigation Tabs */}
        <div className="flex border-b border-[#e2ded5] bg-[#faf8f5] px-4 pt-2 dark:border-[#262f3c] dark:bg-[#161c24] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "email"
                ? "border-[#165b33] text-[#165b33] dark:border-[#78d69f] dark:text-[#78d69f]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Send Direct Emails</span>
            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 border-[#165b33]/30">
              Personalized
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "broadcast"
                ? "border-[#165b33] text-[#165b33] dark:border-[#78d69f] dark:text-[#78d69f]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>In-App Portal Alert</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("share")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "share"
                ? "border-[#165b33] text-[#165b33] dark:border-[#78d69f] dark:text-[#78d69f]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Copy BCC &amp; WhatsApp List</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "roster"
                ? "border-[#165b33] text-[#165b33] dark:border-[#78d69f] dark:text-[#78d69f]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Defaulters Roster ({activeDefaulters.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Universal Document Category Filter Strip */}
          <div className="rounded-lg border border-[#e2ded5] bg-[#faf8f5] p-3 dark:border-[#262f3c] dark:bg-[#161c24]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#1c2024] dark:text-white flex items-center gap-1.5">
                <span>Filter by Missing Document Category:</span>
              </label>
              <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                Active Filter: <strong className="text-[#1c2024] dark:text-white">{selectedTopicLabel}</strong> (
                {activeDefaulters.length} students)
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedTopic("ALL_REQUIRED")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  selectedTopic === "ALL_REQUIRED"
                    ? "bg-[#165b33] text-white shadow-sm"
                    : "border border-[#d8d3c7] bg-white text-[#1c2024] hover:bg-[#f6f5f2] dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]"
                }`}
              >
                All Mandatory ({requiredDefaulters.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedTopic("ZERO_UPLOADS")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
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
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    selectedTopic === t.key
                      ? "bg-[#b45309] text-white shadow-sm"
                      : "border border-[#d8d3c7] bg-white text-[#5c6470] hover:text-[#1c2024] hover:bg-[#f6f5f2] dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#94a3b8]"
                  }`}
                >
                  {t.label} ({t.defaulters.length})
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: SEND DIRECT EMAILS */}
          {activeTab === "email" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Server Status & Target Audience Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Target Email Recipients:
                  </label>
                  <select
                    value={emailAudience}
                    onChange={(e) => setEmailAudience(e.target.value as AudienceType)}
                    className="flex h-9 w-full rounded-md border border-[#d8d3c7] bg-white px-2.5 py-1 text-xs text-[#1c2024] shadow-none outline-none focus:border-[#165b33] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#f0ede6]"
                  >
                    <option value="FILTERED">
                      Current Filter: {selectedTopicLabel} ({activeDefaulters.length} students)
                    </option>
                    <option value="ALL_REQUIRED">
                      All Mandatory Defaulters (10th/12th/CGPA) ({requiredDefaulters.length} students)
                    </option>
                    <option value="ZERO_UPLOADS">
                      Candidates with Zero Uploads ({zeroUploads.length} students)
                    </option>
                    <option value="ALL_STUDENTS">
                      All Registered Candidates ({students.length} students)
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Email Server Status:
                  </label>
                  <div className="flex h-9 items-center justify-between rounded-md border border-[#d8d3c7] bg-[#faf8f5] px-3 text-xs dark:border-[#333e4e] dark:bg-[#161c24]">
                    {emailConfig?.configured ? (
                      <span className="flex items-center gap-1.5 font-semibold text-[#165b33] dark:text-[#78d69f]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Connected: {emailConfig.info?.provider}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[#b45309] dark:text-[#fcd34d]">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>Simulation Mode / Ready (SMTP env optional)</span>
                      </span>
                    )}
                    <span className="text-[10px] text-[#5c6470] dark:text-[#94a3b8]">
                      {emailList.length} recipients
                    </span>
                  </div>
                </div>
              </div>

              {/* Email Subject Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                  Email Subject Line:
                </label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. [Action Required] Upload Missing Placement Verification Documents — SRM"
                  className="font-medium"
                />
              </div>

              {/* Email Body Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Email Message Content:
                  </label>
                  <div className="flex items-center gap-1 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                    <span>Insert dynamic tag:</span>
                    <button
                      type="button"
                      onClick={() => setEmailBody((prev) => prev + " {name}")}
                      className="rounded bg-[#e2ded5]/60 px-1.5 py-0.5 font-mono text-[10px] text-[#165b33] hover:bg-[#d8d3c7] dark:bg-[#262f3c] dark:text-[#78d69f]"
                    >
                      {"{name}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailBody((prev) => prev + " {missing_documents}")}
                      className="rounded bg-[#e2ded5]/60 px-1.5 py-0.5 font-mono text-[10px] text-[#165b33] hover:bg-[#d8d3c7] dark:bg-[#262f3c] dark:text-[#78d69f]"
                    >
                      {"{missing_documents}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailBody((prev) => prev + " {register_number}")}
                      className="rounded bg-[#e2ded5]/60 px-1.5 py-0.5 font-mono text-[10px] text-[#165b33] hover:bg-[#d8d3c7] dark:bg-[#262f3c] dark:text-[#78d69f]"
                    >
                      {"{register_number}"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-[#d8d3c7] bg-white p-2.5 text-xs text-[#1c2024] shadow-none outline-none focus:border-[#165b33] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#f0ede6]"
                  placeholder="Enter email message content..."
                />
              </div>

              {/* Institutional HTML Email Preview */}
              {sampleEmailPreview && (
                <div className="rounded-lg border border-[#d8d3c7] bg-[#f9f8f6] p-3.5 dark:border-[#2b3543] dark:bg-[#151b22]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1c2024] dark:text-white">
                      <Sparkles className="h-3.5 w-3.5 text-[#165b33]" />
                      <span>Live Personalized Email Preview for Recipient:</span>
                    </div>
                    <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                      Sending to: <strong>{sampleEmailPreview.student.fullName}</strong> ({sampleEmailPreview.student.email})
                    </span>
                  </div>

                  {/* Mock Email Frame */}
                  <div className="rounded-lg border border-[#e2ded5] bg-white p-4 shadow-sm text-xs space-y-3 dark:border-[#262f3c] dark:bg-[#1b222c]">
                    <div className="rounded bg-[#165b33] px-3 py-2 text-white font-semibold flex items-center justify-between">
                      <span>SRM School of Computing — Placement Cell</span>
                      <span className="text-[10px] text-[#a3e6b9]">PLACEMENT VERIFICATION REMINDER</span>
                    </div>

                    <div className="text-[#1c2024] dark:text-[#f0ede6] space-y-2">
                      <div className="font-semibold">
                        Subject: <span className="font-normal">{sampleEmailPreview.subject}</span>
                      </div>
                      <div>
                        Dear <strong>{sampleEmailPreview.student.fullName}</strong> (Reg No: {sampleEmailPreview.student.registerNumber}),
                      </div>
                      <p className="text-[#4b5563] dark:text-[#94a3b8] leading-relaxed">
                        {sampleEmailPreview.body}
                      </p>

                      <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] p-2.5 text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#450a0a]/50 dark:text-[#fca5a5]">
                        <div className="font-bold text-[11px] uppercase tracking-wide">
                          Pending / Missing Submission(s):
                        </div>
                        <div className="font-semibold text-xs mt-0.5">
                          {sampleEmailPreview.missingText}
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="inline-block rounded bg-[#165b33] px-4 py-2 text-white font-bold text-xs shadow-sm">
                          Log In &amp; Upload Documents &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dispatch Action & Feedback */}
              {emailResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                    emailResult.success
                      ? "border-[#86efac] bg-[#f0fdf4] text-[#166534] dark:border-[#166534] dark:bg-[#052e16] dark:text-[#86efac]"
                      : "border-[#fca5a5] bg-[#fef2f2] text-[#991b1b] dark:border-[#991b1b] dark:bg-[#450a0a] dark:text-[#fca5a5]"
                  }`}
                >
                  {emailResult.success ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{emailResult.message}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                  Will send personalized emails to <strong>{emailList.length}</strong> candidates (and post in-app alerts).
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyBcc}
                    disabled={!activeDefaulters.length}
                    className="h-8 text-xs border-[#38bdf8] text-[#0284c7] hover:bg-[#f0f9ff] dark:border-[#0284c7] dark:text-[#38bdf8]"
                    title="Or copy emails to BCC in your college email account"
                  >
                    {copiedBcc ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-[#165b33]" />
                        <span>Copied BCC!</span>
                      </>
                    ) : (
                      <>
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        <span>Copy BCC ({activeDefaulters.length})</span>
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleSendEmails}
                    disabled={sendingEmail || emailList.length === 0}
                    className="bg-[#165b33] text-xs font-semibold text-white hover:bg-[#124929] shadow-sm h-8"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        <span>Sending Emails…</span>
                      </>
                    ) : (
                      <>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        <span>Send Reminder Emails ({emailList.length} Students)</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IN-APP PORTAL ALERTS */}
          {activeTab === "broadcast" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Audience & Alert Type Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Target Recipient Audience:
                  </label>
                  <select
                    value={broadcastAudience}
                    onChange={(e) => setBroadcastAudience(e.target.value as AudienceType)}
                    className="flex h-9 w-full rounded-md border border-[#d8d3c7] bg-white px-2.5 py-1 text-xs text-[#1c2024] shadow-none outline-none focus:border-[#165b33] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#f0ede6]"
                  >
                    <option value="FILTERED">
                      Current Filter: {selectedTopicLabel} ({activeDefaulters.length} students)
                    </option>
                    <option value="ALL_REQUIRED">
                      All Mandatory Defaulters (10th/12th/CGPA) ({requiredDefaulters.length} students)
                    </option>
                    <option value="ZERO_UPLOADS">
                      Candidates with Zero Uploads ({zeroUploads.length} students)
                    </option>
                    <option value="ALL_STUDENTS">
                      All Registered Candidates ({students.length} students)
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Notice Urgency / Visual Style:
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastKind("WARNING")}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold transition-colors ${
                        broadcastKind === "WARNING"
                          ? "border-[#b45309] bg-[#fef3c7] text-[#92400e] dark:border-[#b45309] dark:bg-[#78350f]/40 dark:text-[#fcd34d]"
                          : "border-[#d8d3c7] bg-white text-[#5c6470] dark:border-[#333e4e] dark:bg-[#161c24]"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-[#b45309]" />
                      <span>Urgent Warning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastKind("INFO")}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold transition-colors ${
                        broadcastKind === "INFO"
                          ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-[#0284c7] dark:bg-[#0c4a6e]/40 dark:text-[#7dd3fc]"
                          : "border-[#d8d3c7] bg-white text-[#5c6470] dark:border-[#333e4e] dark:bg-[#161c24]"
                      }`}
                    >
                      <Info className="h-3.5 w-3.5 text-[#0284c7]" />
                      <span>General Notice</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Title Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                  Notification Title:
                </label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. ⚠️ Action Required: Upload Missing Placement Documents"
                  className="font-medium"
                />
              </div>

              {/* Message Body Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Notification Message Body:
                  </label>
                  <div className="flex items-center gap-1 text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                    <span>Insert dynamic tag:</span>
                    <button
                      type="button"
                      onClick={() => setCustomMessage((prev) => prev + " {name}")}
                      className="rounded bg-[#e2ded5]/60 px-1.5 py-0.5 font-mono text-[10px] text-[#165b33] hover:bg-[#d8d3c7] dark:bg-[#262f3c] dark:text-[#78d69f]"
                    >
                      {"{name}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMessage((prev) => prev + " {missing_documents}")}
                      className="rounded bg-[#e2ded5]/60 px-1.5 py-0.5 font-mono text-[10px] text-[#165b33] hover:bg-[#d8d3c7] dark:bg-[#262f3c] dark:text-[#78d69f]"
                    >
                      {"{missing_documents}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMessage((prev) => prev + " {register_number}")}
                      className="rounded bg-[#e2ded5]/60 px-1.5 py-0.5 font-mono text-[10px] text-[#165b33] hover:bg-[#d8d3c7] dark:bg-[#262f3c] dark:text-[#78d69f]"
                    >
                      {"{register_number}"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-[#d8d3c7] bg-white p-2.5 text-xs text-[#1c2024] shadow-none outline-none focus:border-[#165b33] dark:border-[#333e4e] dark:bg-[#161c24] dark:text-[#f0ede6]"
                  placeholder="Enter reminder message..."
                />
              </div>

              {/* Dynamic Live Preview Box */}
              <div className="rounded-lg border border-[#d8d3c7] bg-[#f9f8f6] p-3 dark:border-[#2b3543] dark:bg-[#151b22]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1c2024] dark:text-white">
                    <Sparkles className="h-3.5 w-3.5 text-[#b45309]" />
                    <span>Live Sample Preview for Recipient:</span>
                  </div>
                  {sampleBroadcastStudent && (
                    <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                      Sample: <strong>{sampleBroadcastStudent.fullName}</strong> ({sampleBroadcastStudent.registerNumber})
                    </span>
                  )}
                </div>
                <div
                  className={`rounded-md border p-3 ${
                    broadcastKind === "WARNING"
                      ? "border-[#f59e0b]/40 bg-[#fffbeb] text-[#92400e] dark:border-[#b45309]/50 dark:bg-[#451a03]/30 dark:text-[#fcd34d]"
                      : "border-[#38bdf8]/40 bg-[#f0f9ff] text-[#0369a1] dark:border-[#0284c7]/50 dark:bg-[#082f49]/30 dark:text-[#7dd3fc]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Bell className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-xs font-bold">{sampleBroadcastPreviewTitle}</div>
                      <div className="text-xs leading-relaxed">{sampleBroadcastPreviewText}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatch Action & Feedback */}
              {broadcastResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                    broadcastResult.success
                      ? "border-[#86efac] bg-[#f0fdf4] text-[#166534] dark:border-[#166534] dark:bg-[#052e16] dark:text-[#86efac]"
                      : "border-[#fca5a5] bg-[#fef2f2] text-[#991b1b] dark:border-[#991b1b] dark:bg-[#450a0a] dark:text-[#fca5a5]"
                  }`}
                >
                  {broadcastResult.success ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{broadcastResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                  This will dispatch real-time in-app alerts to <strong>{broadcastList.length}</strong> registered students.
                </span>
                <Button
                  onClick={handleSendBroadcast}
                  disabled={sendingBroadcast || broadcastList.length === 0}
                  className="bg-[#165b33] text-xs font-semibold text-white hover:bg-[#124929] shadow-sm"
                >
                  {sendingBroadcast ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      <span>Sending Alerts…</span>
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      <span>Send In-App Notice ({broadcastList.length} Students)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: SHAREABLE FORMATS (WHATSAPP / EMAIL DRAFT / SHEETS) */}
          {activeTab === "share" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#e2ded5] pb-3 dark:border-[#262f3c]">
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

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyBcc}
                    disabled={!activeDefaulters.length}
                    className="h-8 text-xs border-[#38bdf8] text-[#0284c7] hover:bg-[#f0f9ff] dark:border-[#0284c7] dark:text-[#38bdf8]"
                    title="Copy comma-separated list of candidate emails to paste into Gmail or Outlook BCC"
                  >
                    {copiedBcc ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-[#165b33]" />
                        <span>Copied {activeDefaulters.length} Emails!</span>
                      </>
                    ) : (
                      <>
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        <span>Copy BCC Emails</span>
                      </>
                    )}
                  </Button>

                  <a
                    href={mailtoHref}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 rounded-md border border-[#d8d3c7] px-2.5 py-1.5 text-xs font-medium text-[#1c2024] hover:bg-[#f6f5f2] dark:border-[#333e4e] dark:text-[#f0ede6] dark:hover:bg-[#222a36] ${
                      !activeDefaulters.length ? "pointer-events-none opacity-50" : ""
                    }`}
                    title="Open default email application with prefilled BCC, subject and reminder body"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open Mail App</span>
                  </a>

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
                    onClick={handleCopyNotice}
                    disabled={!activeDefaulters.length}
                    className="h-8 bg-[#165b33] text-xs font-semibold text-white hover:bg-[#124929]"
                  >
                    {copiedNotice ? (
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#1c2024] dark:text-white">
                    Formatted Text Preview ({activeDefaulters.length} students):
                  </span>
                  <span className="text-[11px] text-[#5c6470] dark:text-[#94a3b8]">
                    Ready to copy directly into WhatsApp class groups or email notices
                  </span>
                </div>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#e2ded5] bg-[#faf8f5] p-3 text-xs font-mono text-[#1c2024] leading-relaxed dark:border-[#262f3c] dark:bg-[#161c24] dark:text-[#f0ede6]">
                  {shareableNotice || "No students match this category."}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: DEFAULTERS ROSTER */}
          {activeTab === "roster" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#5c6470]" />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search candidate by name, register number, email, FA..."
                    className="pl-8 text-xs"
                  />
                </div>
                <span className="text-xs font-semibold text-[#5c6470] dark:text-[#94a3b8] shrink-0">
                  {filteredRoster.length} of {activeDefaulters.length} defaulters
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-[#e2ded5] dark:border-[#262f3c]">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Register Number</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Faculty Advisor</th>
                      <th>Missing Documents</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-xs text-[#5c6470]">
                          ✓ No defaulters found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredRoster.map((s, idx) => {
                        const audit = auditStudentDocuments(s.documents);
                        const isSent = singleSentMap[s.id];
                        const isSending = singleSendingId === s.id;
                        const isEmailSent = singleEmailSentMap[s.id];
                        const isEmailSending = singleEmailSendingId === s.id;

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
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant={isEmailSent ? "success" : "outline"}
                                  onClick={() => handleSendSingleEmail(s)}
                                  disabled={isEmailSending || isEmailSent}
                                  className="h-6 text-[10px] px-2 text-[#0284c7] border-[#38bdf8] hover:bg-[#f0f9ff]"
                                  title="Send individual email to this student"
                                >
                                  {isEmailSending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : isEmailSent ? (
                                    <>
                                      <Check className="mr-1 h-3 w-3 text-[#165b33]" />
                                      <span>Mailed!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Mail className="mr-1 h-3 w-3" />
                                      <span>Email</span>
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant={isSent ? "success" : "outline"}
                                  onClick={() => handleSendSingleReminder(s)}
                                  disabled={isSending || isSent}
                                  className="h-6 text-[10px] px-2"
                                  title="Send individual in-app portal alert"
                                >
                                  {isSending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : isSent ? (
                                    <>
                                      <Check className="mr-1 h-3 w-3" />
                                      <span>Alerted!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bell className="mr-1 h-3 w-3" />
                                      <span>Alert</span>
                                    </>
                                  )}
                                </Button>
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#e2ded5] bg-[#faf8f5] px-4 py-3 sm:px-5 dark:border-[#262f3c] dark:bg-[#161c24]">
          <div className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
            Showing <strong>{activeDefaulters.length}</strong> candidates needing document uploads under {selectedTopicLabel}.
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
