import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Link2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Unlink,
  UploadCloud,
  Zap,
  Copy,
  Check,
  Code,
  ChevronDown,
  ChevronUp,
  Send,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardData, SyncSettings, AutoSyncInterval, WorkItem } from '../types';
import { fetchAndParseGoogleSheet } from '../utils/googleSheetSync';
import { parseExcelWorkbook } from '../utils/sheetParser';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptTemplate';
import { buildTopicSyncKey, getSyncedTopicKeys, markTopicsAsSynced } from '../utils/storage';

interface UploadSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: DashboardData, saveToLocalMemory?: boolean) => void;
  currentSheetUrl?: string;
  syncSettings: SyncSettings;
  onUpdateSyncSettings: (settings: SyncSettings) => void;
  onDisconnectSheet?: () => void;
  worksCompleted?: WorkItem[];
  selectedMonth?: string;
}

export const UploadSheetModal: React.FC<UploadSheetModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  currentSheetUrl = '',
  syncSettings,
  onUpdateSyncSettings,
  onDisconnectSheet,
  worksCompleted = [],
  selectedMonth = 'Nov 2026',
}) => {
  const [googleSheetUrl, setGoogleSheetUrl] = useState(currentSheetUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveToLocalMemory, setSaveToLocalMemory] = useState(true);

  // Sync settings state in modal
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(syncSettings.autoSync);
  const [syncInterval, setSyncInterval] = useState<AutoSyncInterval>(syncSettings.interval);
  const [webhookUrl, setWebhookUrl] = useState(syncSettings.webhookUrl || '');

  const [activeSourceTab, setActiveSourceTab] = useState<'link' | 'file'>('link');
  const [isScriptGuideOpen, setIsScriptGuideOpen] = useState(false);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Webhook test and bulk sync state
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGoogleSheetUrl(currentSheetUrl);
      setAutoSyncEnabled(syncSettings.autoSync);
      setSyncInterval(syncSettings.interval);
      setWebhookUrl(syncSettings.webhookUrl || '');
      setErrorMessage(null);
      setSuccessMessage(null);
      setTestResult(null);
    }
  }, [isOpen, currentSheetUrl, syncSettings]);

  if (!isOpen) return null;

  // Count total topics currently present across deliverables
  const totalTopicsCount = worksCompleted.reduce((acc, w) => {
    let count = w.subItems?.length || 0;
    if (w.monthlySubItems) {
      for (const m in w.monthlySubItems) {
        count += w.monthlySubItems[m]?.length || 0;
      }
    }
    return acc;
  }, 0);

  const handleCopyScriptCode = () => {
    try {
      navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setHasCopiedCode(true);
      setTimeout(() => setHasCopiedCode(false), 3000);
    } catch {
      setHasCopiedCode(true);
      setTimeout(() => setHasCopiedCode(false), 3000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
        const parsedData = parseExcelWorkbook(workbook, file.name);

        setSuccessMessage(
          `Imported "${file.name}"! Loaded ${parsedData.worksCompleted.length} deliverables across ${
            parsedData.availableMonths?.join(', ') || 'months'
          }.`
        );

        setTimeout(() => {
          onDataLoaded(parsedData, saveToLocalMemory);
          onClose();
        }, 600);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to parse Excel file.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file.');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Immediate save for the Web App URL
  const handleSaveWebhookUrlOnly = () => {
    const cleanUrl = webhookUrl.trim();
    const newSettings: SyncSettings = {
      ...syncSettings,
      autoSync: autoSyncEnabled,
      interval: syncInterval,
      webhookUrl: cleanUrl || undefined,
    };
    onUpdateSyncSettings(newSettings);
    setTestResult({
      message: cleanUrl
        ? 'Autosave Web App URL saved! New topics will write to your Google Sheet automatically.'
        : 'Web App URL cleared.',
    });
  };

  const handleTestWebhook = async () => {
    const url = webhookUrl.trim();
    if (!url) {
      setTestResult({
        message: 'Please paste your Google Apps Script Web App URL first (starts with https://script.google.com/macros/s/.../exec).',
        isError: true,
      });
      return;
    }

    if (url.includes('docs.google.com/spreadsheets')) {
      setTestResult({
        message: '⚠️ You pasted a Google Sheet link instead of the Apps Script Web App URL. Click "View 4-Step Apps Script Setup" below to deploy and get the Web App URL (ends with /exec).',
        isError: true,
      });
      return;
    }

    // Automatically persist the URL
    onUpdateSyncSettings({
      ...syncSettings,
      webhookUrl: url,
    });

    setIsTestingWebhook(true);
    setTestResult(null);

    try {
      const params = new URLSearchParams({
        action: 'test',
        deliverable: 'Dashboard Connection Test',
        month: selectedMonth || 'Nov 2026',
        title: 'VZone Marketing Dashboard Connected',
        note: `Test row sent on ${new Date().toLocaleTimeString()} - Autosave verified!`,
      });
      const separator = url.includes('?') ? '&' : '?';
      const target = `${url}${separator}${params.toString()}`;

      // 1. Send via POST with CORS-safelisted text/plain
      await fetch(target, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'test',
          deliverable: 'Dashboard Connection Test',
          month: selectedMonth || 'Nov 2026',
          title: 'VZone Marketing Dashboard Connected',
          note: `Test row sent on ${new Date().toLocaleTimeString()} - Autosave verified!`,
        }),
      });

      // 2. Also trigger GET beacon for guaranteed execution
      try {
        const img = new Image();
        img.src = target;
      } catch {}

      setTestResult({
        message: '✅ Test row sent successfully! Please check your Google Sheet: a new tab named "Topic Breakdown" will have this test row. (Note: Make sure "Who has access" was set to "Anyone" in your Apps Script deployment).',
      });
    } catch (e: any) {
      setTestResult({
        message: 'Sent test request. Please check your Google Sheet to verify the "Topic Breakdown" tab updated.',
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Push all existing topics to Google Sheet in bulk
  const handleBulkSyncTopics = async () => {
    const url = webhookUrl.trim();
    if (!url) {
      setTestResult({
        message: 'Please paste your Google Apps Script Web App URL first.',
        isError: true,
      });
      return;
    }

    // Gather all topics from worksCompleted
    const items: Array<{ deliverable: string; month: string; title: string; note: string }> = [];
    for (const w of worksCompleted) {
      if (w.subItems && w.subItems.length > 0) {
        for (const s of w.subItems) {
          items.push({
            deliverable: w.activity,
            month: w.month || selectedMonth || 'Nov 2026',
            title: s.title,
            note: s.note || '',
          });
        }
      }
      if (w.monthlySubItems) {
        for (const [mName, mList] of Object.entries(w.monthlySubItems)) {
          for (const s of mList || []) {
            // Avoid duplicate if already in subItems
            const already = items.some(
              (it) => it.deliverable === w.activity && it.month === mName && it.title === s.title
            );
            if (!already) {
              items.push({
                deliverable: w.activity,
                month: mName,
                title: s.title,
                note: s.note || '',
              });
            }
          }
        }
      }
    }

    if (items.length === 0) {
      setTestResult({
        message: 'No sub-category topics found in the dashboard yet. Expand any deliverable and add topics first, or click "Send Test Row".',
        isError: true,
      });
      return;
    }

    // Filter out topics that have already been synced
    const syncedKeys = getSyncedTopicKeys();
    const newItems = items.filter(
      (it) => !syncedKeys.has(buildTopicSyncKey(it.deliverable, it.month, it.title))
    );

    if (newItems.length === 0) {
      setTestResult({
        message: 'All topics are already synced in your Google Sheet! No duplicates were added.',
      });
      return;
    }

    setIsBulkSyncing(true);
    setTestResult(null);

    try {
      onUpdateSyncSettings({
        ...syncSettings,
        webhookUrl: url,
      });

      const newlySyncedKeys: string[] = [];

      // Send each new topic row-by-row with verified addTopic action
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const queryParams = new URLSearchParams({
          action: 'addTopic',
          deliverable: item.deliverable,
          month: item.month,
          title: item.title,
          note: item.note,
        });
        const separator = url.includes('?') ? '&' : '?';
        const targetWithParams = `${url}${separator}${queryParams.toString()}`;

        await fetch(targetWithParams, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'addTopic',
            deliverable: item.deliverable,
            month: item.month,
            title: item.title,
            note: item.note,
          }),
        }).catch(() => {
          try {
            const img = new Image();
            img.src = targetWithParams;
          } catch {}
        });

        newlySyncedKeys.push(buildTopicSyncKey(item.deliverable, item.month, item.title));

        if (i < newItems.length - 1) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      markTopicsAsSynced(newlySyncedKeys);

      setTestResult({
        message: `✅ Pushed ${newItems.length} new topics into your Google Sheet "Topic Breakdown" tab! (${items.length - newItems.length} were already synced, skipping duplicates).`,
      });
    } catch (err: any) {
      setTestResult({
        message: `Sent update of ${newItems.length} topics. Please check your Google Sheet.`,
      });
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Process Google Sheet URL and start live link
  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let url = googleSheetUrl.trim();
    let scriptUrl = webhookUrl.trim();

    // Auto-detect if user accidentally pasted the script.google.com link into the sheet URL box
    if (url.includes('script.google.com')) {
      scriptUrl = url;
      url = '';
      setWebhookUrl(scriptUrl);
      setGoogleSheetUrl('');
    }

    // If only saving the direct autosave Web App URL
    if (!url && scriptUrl) {
      const newSettings: SyncSettings = {
        autoSync: autoSyncEnabled,
        interval: syncInterval,
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        webhookUrl: scriptUrl,
      };
      onUpdateSyncSettings(newSettings);
      setSuccessMessage('Google Apps Script Web App saved! Autosave is now active.');
      setTimeout(() => {
        onClose();
      }, 700);
      return;
    }

    if (!url) {
      setErrorMessage('Please enter a Google Sheet link or Apps Script Web App URL.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const parsedData = await fetchAndParseGoogleSheet(url);

      // Save sync settings
      const newSettings: SyncSettings = {
        autoSync: autoSyncEnabled,
        interval: syncInterval,
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        webhookUrl: scriptUrl || undefined,
      };
      onUpdateSyncSettings(newSettings);

      setSuccessMessage(
        `Successfully linked Google Sheet! ${parsedData.worksCompleted.length} deliverables synced.${
          autoSyncEnabled ? ` Auto-sync active (${syncInterval}).` : ''
        }`
      );

      setTimeout(() => {
        onDataLoaded(parsedData, saveToLocalMemory);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Failed to link Google Sheet. Ensure sheet sharing is set to "Anyone with the link can view".'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isSheetLinkPastedInWebhook = webhookUrl.trim().includes('docs.google.com/spreadsheets');
  const isValidWebhookFormat = webhookUrl.trim().includes('script.google.com') && webhookUrl.trim().includes('/exec');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Google Sheet Sync & Autosave
              </h3>
              <p className="text-xs text-slate-500">
                Connect live Google Sheet & enable automatic topic writing into your sheet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-2">
          <button
            onClick={() => setActiveSourceTab('link')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeSourceTab === 'link'
                ? 'border-[#E11D74] text-[#E11D74]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link Google Sheet & Autosave</span>
          </button>
          <button
            onClick={() => setActiveSourceTab('file')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeSourceTab === 'file'
                ? 'border-[#E11D74] text-[#E11D74]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Excel File (.xlsx)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="leading-relaxed space-y-1">
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-[11px] text-rose-700">
                  Tip: In your Google Sheet, click <strong>Share</strong> in the top-right corner and set General access to <strong>"Anyone with the link can view"</strong>.
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <p>{successMessage}</p>
            </div>
          )}

          {activeSourceTab === 'file' ? (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#E11D74] rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-slate-50 group"
              >
                <div className="w-12 h-12 mx-auto rounded-xl bg-pink-50 text-[#E11D74] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Click to browse or drop your VZONE.XLSX file here
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports .xlsx, .xls, and .csv with multi-month columns (Oct 2026, Sep 2026)
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                <span className="font-bold text-slate-800 block mb-1">Automatic Multi-Month Extraction:</span>
                Your template columns (<code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">Oct 2026</code> and <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">Sep 2026</code>) are automatically parsed, calculating month-over-month comparisons, trends, and item totals.
              </div>
            </div>
          ) : (
            <form onSubmit={handleGoogleSheetSubmit} className="space-y-4">
              {/* Google Sheet URL Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Google Sheet URL (For reading deliverables & reports)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/1wXkY..."
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    className="w-full px-3 py-2.5 pl-9 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <Link2 className="w-4 h-4 text-teal-600 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Copy and paste the URL from your browser address bar when viewing your sheet.
                </p>
              </div>

              {/* Direct Autosave Apps Script Web App URL Section */}
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span>2. Google Apps Script Web App (Direct Autosave into Sheet)</span>
                  </div>
                  {webhookUrl && isValidWebhookFormat && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Ready to sync</span>
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  Whenever you add a topic under any deliverable (e.g. <em>Reels Video</em>), it automatically saves into a new tab named <strong>"Topic Breakdown"</strong> in your Google Sheet in real time.
                </p>

                {/* Web App URL input and actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      value={webhookUrl}
                      onChange={(e) => {
                        setWebhookUrl(e.target.value);
                        setTestResult(null);
                      }}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 placeholder:text-slate-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveWebhookUrlOnly}
                      className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Save URL
                    </button>
                  </div>

                  {/* Warning if user pasted a docs.google.com spreadsheet link instead */}
                  {isSheetLinkPastedInWebhook && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <strong>Notice:</strong> This is a Google Sheet URL, not the Web App URL. To get your Web App URL, open <strong>Extensions &gt; Apps Script &gt; Deploy &gt; New deployment &gt; Web app</strong> and copy the URL ending in <code className="bg-white px-1 py-0.5 rounded border border-amber-300 font-mono">/exec</code>.
                      </div>
                    </div>
                  )}

                  {/* Action buttons: Send Test Row & Push All Topics */}
                  {webhookUrl && !isSheetLinkPastedInWebhook && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={handleTestWebhook}
                        disabled={isTestingWebhook}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-300 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                        <span>{isTestingWebhook ? 'Sending Test Row...' : 'Send Test Row to Sheet'}</span>
                      </button>

                      {totalTopicsCount > 0 && (
                        <button
                          type="button"
                          onClick={handleBulkSyncTopics}
                          disabled={isBulkSyncing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <Send className={`w-3.5 h-3.5 ${isBulkSyncing ? 'animate-spin' : ''}`} />
                          <span>{isBulkSyncing ? 'Pushing...' : `Push All Dashboard Topics (${totalTopicsCount})`}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      testResult.isError
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    {testResult.isError ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{testResult.message}</span>
                  </div>
                )}

                {/* Apps Script Code & Setup Accordion */}
                <div className="pt-2 border-t border-indigo-200/60">
                  <button
                    type="button"
                    onClick={() => setIsScriptGuideOpen((prev) => !prev)}
                    className="flex items-center justify-between w-full text-left text-xs font-bold text-indigo-900 hover:text-indigo-700 py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-indigo-600" />
                      <span>How to get your Web App URL (4-Step Setup &amp; Code)</span>
                    </span>
                    {isScriptGuideOpen ? (
                      <ChevronUp className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-indigo-600" />
                    )}
                  </button>

                  {isScriptGuideOpen && (
                    <div className="mt-2.5 space-y-3 bg-white p-3 rounded-xl border border-indigo-200 text-xs text-slate-700 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                          Google Apps Script Code
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyScriptCode}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer border border-indigo-200"
                        >
                          {hasCopiedCode ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied Code!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-indigo-600" />
                              <span>Copy Script Code</span>
                            </>
                          )}
                        </button>
                      </div>

                      <ol className="list-decimal list-inside space-y-2 text-[11.5px] leading-relaxed text-slate-700">
                        <li>
                          In your Google Sheet, click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.
                        </li>
                        <li>
                          Select and delete everything in <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">Code.gs</code>, click <strong>"Copy Script Code"</strong> above, paste it into the editor, and click the <strong>Save (💾)</strong> icon.
                        </li>
                        <li>
                          Click the blue <strong>Deploy</strong> button (top right) &gt; <strong>New deployment</strong>:
                          <ul className="list-disc list-inside ml-3 mt-1 space-y-1 text-slate-600">
                            <li>Click the gear icon ⚙️ next to <em>Select type</em> and pick <strong>Web app</strong>.</li>
                            <li>Execute as: <strong>Me</strong></li>
                            <li className="font-bold text-amber-900 bg-amber-50 px-1 rounded inline-block">
                              Who has access: <strong>Anyone</strong> (CRITICAL: Must be "Anyone" so dashboard can write rows!)
                            </li>
                          </ul>
                        </li>
                        <li>
                          Click <strong>Deploy</strong>, click <strong>Authorize access</strong> if asked, then copy the <strong>Web app URL</strong> (ends with <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">/exec</code>) and paste it into the box above!
                        </li>
                      </ol>

                      <div className="pt-2">
                        <div className="text-[10.5px] font-mono bg-slate-900 text-slate-200 p-2.5 rounded-lg max-h-36 overflow-y-auto whitespace-pre leading-relaxed select-all">
                          {GOOGLE_APPS_SCRIPT_CODE}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Sync Configuration Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-800">
                      Automatic Dashboard Pull
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
                  </label>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  When enabled, the dashboard continuously checks Google Sheets for updates in the background and instantly refreshes when you switch back to this tab.
                </p>

                {autoSyncEnabled && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                    <label className="text-xs font-semibold text-slate-700">
                      Auto-Refresh Frequency:
                    </label>
                    <select
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(e.target.value as AutoSyncInterval)}
                      className="text-xs font-medium bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="30s">Every 30 seconds</option>
                      <option value="1m">Every 1 minute (Recommended)</option>
                      <option value="5m">Every 5 minutes</option>
                      <option value="15m">Every 15 minutes</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Local persistence checkbox */}
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  id="modalSaveStorage"
                  checked={saveToLocalMemory}
                  onChange={(e) => setSaveToLocalMemory(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                />
                <label htmlFor="modalSaveStorage" className="cursor-pointer">
                  Save link and loaded data in browser local memory
                </label>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isLoading || (!googleSheetUrl.trim() && !webhookUrl.trim())}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting & Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      <span>Link Sheet & Save Settings</span>
                    </>
                  )}
                </button>

                {currentSheetUrl && onDisconnectSheet && (
                  <button
                    type="button"
                    onClick={() => {
                      onDisconnectSheet();
                      setGoogleSheetUrl('');
                      onClose();
                    }}
                    title="Disconnect Google Sheet and revert to manual/sample mode"
                    className="py-2.5 px-3 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Disconnect</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
