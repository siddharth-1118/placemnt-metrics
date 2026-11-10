"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";

interface OneDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalStudents: number;
}

const ONEDRIVE_FILE_URL =
  "https://1drv.ms/x/c/d2ea2cfb060b966f/IQAtkwyhd-e7T63gUwYlyAIRAbM8mn4zUeOAr5jWqlQoC64?e=WO6IEh";
const DEFAULT_FEED_TOKEN = "srm_ao1_matrix_feed";

export function OneDriveSyncModal({
  isOpen,
  onClose,
  totalStudents,
}: OneDriveSyncModalProps) {
  const [activeTab, setActiveTab] = useState<"powerquery" | "officescript" | "feeds">("officescript");
  const [origin, setOrigin] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingFeed, setTestingFeed] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    count: number;
    updatedAt: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const baseOrigin = origin || "https://placemnt-metrics.vercel.app";
  const csvFeedUrl = `${baseOrigin}/api/students/export/live?token=${DEFAULT_FEED_TOKEN}`;
  const xlsxFeedUrl = `${baseOrigin}/api/students/export/live?format=xlsx&token=${DEFAULT_FEED_TOKEN}`;
  const jsonFeedUrl = `${baseOrigin}/api/students/export/live?format=json&token=${DEFAULT_FEED_TOKEN}`;

  const officeScriptCode = `/**
 * SRM Placement Matrix - Live Auto-Sync for Excel Online
 * Fetches real-time student scores and rubric evaluations from the placement portal.
 */
async function main(workbook: ExcelScript.Workbook) {
  const sheet = workbook.getActiveWorksheet();
  
  // 1. Fetch live data from portal
  const API_URL = "${jsonFeedUrl}";
  
  console.log("Fetching live placement records...");
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error("Portal feed error: " + response.status + " " + response.statusText);
  }
  
  const data = await response.json();
  const headers = data.headers;
  const rows = data.rows;
  
  if (!rows || rows.length === 0) {
    console.log("No student records returned.");
    return;
  }
  
  // 2. Prepare dataset: Row 1 = Headers, Rows 2..N = Candidate Data
  const allData: (string | number)[][] = [headers, ...rows];
  const numRows = allData.length;
  const numCols = headers.length;
  
  // 3. Clear existing contents to prevent stale rows
  sheet.getRange().clear(ExcelScript.ClearApplyTo.contents);
  
  // 4. Populate table values
  const targetRange = sheet.getRangeByIndexes(0, 0, numRows, numCols);
  targetRange.setValues(allData);
  
  // 5. Apply dynamic SUM formulas for Column S (Total)
  for (let i = 2; i <= numRows; i++) {
    sheet.getRange(\`S\${i}\`).setFormula(\`=SUM(F\${i}:R\${i})\`);
  }
  
  // 6. Header styling (Grey background, bold, wrapped text)
  const headerRange = sheet.getRangeByIndexes(0, 0, 1, numCols);
  headerRange.getFormat().getFill().setColor("#F2F4F7");
  headerRange.getFormat().getFont().setBold(true);
  headerRange.getFormat().getFont().setSize(10);
  headerRange.getFormat().setWrapText(true);
  
  // 7. Auto-fit column widths
  targetRange.getFormat().autofitColumns();
  
  console.log(\`Successfully synced \${rows.length} candidates from portal!\`);
}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestFeed = async () => {
    setTestingFeed(true);
    setTestResult(null);
    try {
      const res = await fetch(jsonFeedUrl);
      if (!res.ok) throw new Error("Feed returned error " + res.status);
      const data = await res.json();
      setTestResult({
        success: true,
        count: data.count || data.rows?.length || 0,
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    } catch {
      setTestResult({
        success: false,
        count: 0,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setTestingFeed(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border border-[#e2ded5] bg-white shadow-2xl dark:border-[#262f3c] dark:bg-[#1b222c]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e2ded5] px-6 py-4 dark:border-[#262f3c]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078d4]/10 text-[#0078d4] dark:bg-[#0078d4]/20">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1c2024] dark:text-white">
                  OneDrive &amp; Excel Online Real-Time Sync
                </h2>
                <Badge className="bg-emerald-100 text-emerald-800 text-[11px] font-medium dark:bg-emerald-950/60 dark:text-emerald-300 border-none">
                  Live Feed Active
                </Badge>
              </div>
              <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                Automatically update your OneDrive Excel spreadsheet whenever student marks are saved.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5c6470] hover:bg-[#f0ece4] dark:text-[#94a3b8] dark:hover:bg-[#232b36]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target OneDrive File Banner */}
        <div className="bg-[#f8f9fa] border-b border-[#e2ded5] px-6 py-3 dark:bg-[#151b23] dark:border-[#262f3c] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileSpreadsheet className="h-4 w-4 text-[#107c41]" />
            <span className="font-semibold text-[#1c2024] dark:text-white">
              Target File:
            </span>
            <span className="text-[#5c6470] dark:text-[#94a3b8] truncate max-w-[320px]">
              Placement Metrics OneDrive Spreadsheet
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={ONEDRIVE_FILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0078d4] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0066b8] transition-colors"
            >
              <span>Open OneDrive File</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#e2ded5] px-6 dark:border-[#262f3c] bg-[#fafaf9] dark:bg-[#181f28]">
          <button
            onClick={() => setActiveTab("officescript")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "officescript"
                ? "border-[#0078d4] text-[#0078d4] dark:border-[#3894e6] dark:text-[#3894e6]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>1-Click Sync Button (Excel Online)</span>
          </button>
          <button
            onClick={() => setActiveTab("powerquery")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "powerquery"
                ? "border-[#0078d4] text-[#0078d4] dark:border-[#3894e6] dark:text-[#3894e6]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Auto-Refresh on Open (Power Query)</span>
          </button>
          <button
            onClick={() => setActiveTab("feeds")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "feeds"
                ? "border-[#0078d4] text-[#0078d4] dark:border-[#3894e6] dark:text-[#3894e6]"
                : "border-transparent text-[#5c6470] hover:text-[#1c2024] dark:text-[#94a3b8] dark:hover:text-white"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Feed URLs &amp; Test</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: 1-Click Sync Button via Office Scripts */}
          {activeTab === "officescript" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Recommended for Excel Online:</strong>{" "}
                    Add an embedded <strong>&quot;Sync Placement Marks&quot;</strong> button directly inside your OneDrive spreadsheet. Whenever a faculty coordinator changes marks on this site, simply clicking the button inside Excel Online immediately pulls all updated scores!
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#1c2024] dark:text-white uppercase tracking-wider">
                  Quick 2-Minute Setup in Excel Online
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-xs text-[#3f4753] dark:text-[#cbd5e1] leading-relaxed">
                  <li>
                    Open your sheet:{" "}
                    <a
                      href={ONEDRIVE_FILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0078d4] underline font-medium hover:text-[#005a9e]"
                    >
                      Open Placement Metrics on OneDrive
                    </a>
                  </li>
                  <li>
                    Click the <strong>Automate</strong> tab in the Excel top ribbon.
                  </li>
                  <li>
                    Click <strong>New Script</strong> (or Code Editor), then select all existing text and replace it with the script below.
                  </li>
                  <li>
                    Click <strong>Save script</strong>, then click <strong>More options (⋯)</strong> &rarr; <strong>Add button</strong>.
                  </li>
                  <li>
                    A button named <strong>&quot;Sync Placement Marks&quot;</strong> is placed on the sheet. Whenever clicked, Excel automatically updates all student marks!
                  </li>
                </ol>
              </div>

              {/* Script Box */}
              <div>
                <div className="flex items-center justify-between rounded-t-lg bg-[#23272e] px-4 py-2 text-xs text-gray-300">
                  <span className="font-mono text-[11px] text-[#78d69f]">
                    SRM_SyncPlacementMarks.ts
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(officeScriptCode, "script")}
                    className="h-7 text-xs text-white hover:bg-white/10"
                  >
                    {copiedKey === "script" ? (
                      <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="mr-1 h-3.5 w-3.5" />
                    )}
                    <span>{copiedKey === "script" ? "Copied Script!" : "Copy Script"}</span>
                  </Button>
                </div>
                <pre className="max-h-60 overflow-y-auto rounded-b-lg bg-[#1a1c23] p-4 text-[11px] font-mono leading-relaxed text-[#e6edf3]">
                  {officeScriptCode}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: Power Query Auto-Refresh on File Open */}
          {activeTab === "powerquery" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div className="flex items-start gap-2.5">
                  <RefreshCw className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Automatic Refresh on Open:</strong>{" "}
                    By connecting Excel&apos;s native Power Query web connector to this live feed, your OneDrive file will automatically refresh its rows every single time someone opens the file, with zero clicks required.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#1c2024] dark:text-white uppercase tracking-wider">
                  Setup Instructions (Excel Desktop or Web)
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-xs text-[#3f4753] dark:text-[#cbd5e1] leading-relaxed">
                  <li>
                    Copy your live web connector feed URL:
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={csvFeedUrl}
                        className="flex-1 rounded border border-[#d0d7de] bg-[#f6f8fa] px-3 py-1.5 font-mono text-xs text-[#1c2024] dark:border-[#30363d] dark:bg-[#0d1117] dark:text-[#c9d1d9]"
                      />
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(csvFeedUrl, "feedCsv")}
                        className="h-8 text-xs bg-[#165b33] text-white hover:bg-[#124929]"
                      >
                        {copiedKey === "feedCsv" ? (
                          <Check className="mr-1 h-3.5 w-3.5 text-white" />
                        ) : (
                          <Copy className="mr-1 h-3.5 w-3.5" />
                        )}
                        <span>{copiedKey === "feedCsv" ? "Copied!" : "Copy URL"}</span>
                      </Button>
                    </div>
                  </li>
                  <li>
                    In Excel, go to the <strong>Data</strong> tab &rarr; <strong>From Web</strong> (or <strong>Get Data &gt; From Other Sources &gt; From Web</strong>).
                  </li>
                  <li>
                    Paste the feed URL and select <strong>Anonymous</strong> access (the feed is securely authenticated via token).
                  </li>
                  <li>
                    Click <strong>Load</strong>. The 19 official columns will immediately populate into an Excel Table.
                  </li>
                  <li>
                    Right-click the query in the right sidebar &rarr; <strong>Properties</strong> &rarr; Check:
                    <ul className="list-disc list-inside ml-4 mt-1 font-semibold text-[#165b33] dark:text-[#78d69f]">
                      <li>&quot;Refresh data when opening the file&quot;</li>
                      <li>&quot;Refresh every 15 minutes&quot; (optional)</li>
                    </ul>
                  </li>
                  <li>
                    Save the workbook directly to your OneDrive. It will now stay updated automatically forever!
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: Feed URLs & Connectivity Diagnostics */}
          {activeTab === "feeds" && (
            <div className="space-y-4">
              <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                These endpoints provide secure, CORS-enabled, real-time access to the student placement database. You can consume them from Power Query, Python, PowerBI, or Zapier/Make.
              </p>

              <div className="space-y-3">
                {/* CSV Feed */}
                <div className="rounded-lg border border-[#e2ded5] p-3.5 dark:border-[#262f3c]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#1c2024] dark:text-white">
                        Power Query CSV Web Feed (UTF-8 BOM)
                      </span>
                      <Badge className="bg-blue-100 text-blue-800 text-[10px] dark:bg-blue-950/60 dark:text-blue-300 border-none">
                        Best for Power Query
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(csvFeedUrl, "csv")}
                      className="h-7 text-xs"
                    >
                      {copiedKey === "csv" ? (
                        <Check className="mr-1 h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="mr-1 h-3 w-3" />
                      )}
                      <span>Copy</span>
                    </Button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={csvFeedUrl}
                    className="w-full rounded border border-[#d0d7de] bg-[#f6f8fa] px-2.5 py-1 font-mono text-[11px] text-[#5c6470] dark:border-[#30363d] dark:bg-[#0d1117] dark:text-[#8b949e]"
                  />
                </div>

                {/* JSON Feed */}
                <div className="rounded-lg border border-[#e2ded5] p-3.5 dark:border-[#262f3c]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#1c2024] dark:text-white">
                        JSON REST API Feed
                      </span>
                      <Badge className="bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-950/60 dark:text-amber-300 border-none">
                        Best for Office Scripts &amp; Apps
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(jsonFeedUrl, "json")}
                      className="h-7 text-xs"
                    >
                      {copiedKey === "json" ? (
                        <Check className="mr-1 h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="mr-1 h-3 w-3" />
                      )}
                      <span>Copy</span>
                    </Button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={jsonFeedUrl}
                    className="w-full rounded border border-[#d0d7de] bg-[#f6f8fa] px-2.5 py-1 font-mono text-[11px] text-[#5c6470] dark:border-[#30363d] dark:bg-[#0d1117] dark:text-[#8b949e]"
                  />
                </div>

                {/* XLSX Direct Download */}
                <div className="rounded-lg border border-[#e2ded5] p-3.5 dark:border-[#262f3c]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#1c2024] dark:text-white">
                        Direct XLSX OpenXML File Download
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] dark:bg-emerald-950/60 dark:text-emerald-300 border-none">
                        Native Excel
                      </Badge>
                    </div>
                    <a
                      href={xlsxFeedUrl}
                      download="SRM_Placement_Matrix_AO1_Live.xlsx"
                      className="inline-flex items-center gap-1 text-xs text-[#165b33] font-medium hover:underline dark:text-[#78d69f]"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download Now</span>
                    </a>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={xlsxFeedUrl}
                    className="w-full rounded border border-[#d0d7de] bg-[#f6f8fa] px-2.5 py-1 font-mono text-[11px] text-[#5c6470] dark:border-[#30363d] dark:bg-[#0d1117] dark:text-[#8b949e]"
                  />
                </div>
              </div>

              {/* Feed Diagnostics */}
              <div className="rounded-lg border border-[#e2ded5] bg-[#fcfbfa] p-4 dark:border-[#262f3c] dark:bg-[#151b23]">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1c2024] dark:text-white">
                      Test Live Feed Connectivity
                    </h4>
                    <p className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
                      Verify that the database records and CORS headers are functioning smoothly.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestFeed}
                    disabled={testingFeed}
                    className="h-8 text-xs"
                  >
                    {testingFeed ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    )}
                    <span>Test Feed Now</span>
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={`mt-3 flex items-center gap-2 rounded-md p-2.5 text-xs ${
                      testResult.success
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800"
                    }`}
                  >
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>
                          Feed online! Returned <strong>{testResult.count}</strong> student records. Timestamp: {new Date(testResult.updatedAt).toLocaleTimeString()}.
                        </span>
                      </>
                    ) : (
                      <>
                        <Info className="h-4 w-4 shrink-0 text-red-600" />
                        <span>Feed connection test failed. Please check server logs.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e2ded5] px-6 py-3.5 dark:border-[#262f3c] bg-[#fafaf9] dark:bg-[#181f28]">
          <span className="text-xs text-[#5c6470] dark:text-[#94a3b8]">
            {totalStudents} candidates registered in cohort database
          </span>
          <Button
            size="sm"
            onClick={onClose}
            className="h-8 bg-[#165b33] text-xs font-medium text-white hover:bg-[#124929]"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
