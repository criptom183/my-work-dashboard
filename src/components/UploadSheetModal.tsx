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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardData, SyncSettings, AutoSyncInterval } from '../types';
import { fetchAndParseGoogleSheet } from '../utils/googleSheetSync';
import { parseExcelWorkbook } from '../utils/sheetParser';

interface UploadSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: DashboardData, saveToLocalMemory?: boolean) => void;
  currentSheetUrl?: string;
  syncSettings: SyncSettings;
  onUpdateSyncSettings: (settings: SyncSettings) => void;
  onDisconnectSheet?: () => void;
}

export const UploadSheetModal: React.FC<UploadSheetModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  currentSheetUrl = '',
  syncSettings,
  onUpdateSyncSettings,
  onDisconnectSheet,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setGoogleSheetUrl(currentSheetUrl);
      setAutoSyncEnabled(syncSettings.autoSync);
      setSyncInterval(syncSettings.interval);
      setWebhookUrl(syncSettings.webhookUrl || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, currentSheetUrl, syncSettings]);

  if (!isOpen) return null;

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

  // Process Google Sheet URL and start live link
  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = googleSheetUrl.trim();
    if (!url) return;

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
        webhookUrl: webhookUrl.trim() || undefined,
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
                Data Source & Sync
              </h3>
              <p className="text-xs text-slate-500">
                Connect live Google Sheet or upload your Excel template (VZONE.XLSX)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
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
            <span>Link Google Sheet</span>
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
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Google Sheet URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1wXkY..."
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  className="w-full px-3 py-2.5 pl-9 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
                <Link2 className="w-4 h-4 text-teal-600 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Copy and paste the URL from your browser address bar when viewing your sheet.
              </p>
            </div>

            {/* Direct Autosave Apps Script Web App URL */}
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Google Apps Script Web App URL (Direct Autosave into Sheet)</span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                If you deployed the Apps Script in your sheet, paste your deployed <strong>Web App URL</strong> below. Whenever you add a topic in the dashboard, it writes directly into your Google Sheet's <strong>"Topic Breakdown"</strong> tab in real time!
              </p>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 placeholder:text-slate-400 font-mono"
              />
            </div>

            {/* Live Sync Configuration Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-slate-800">
                    Automatic Dashboard Update
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
                When enabled, the dashboard continuously checks Google Sheets for new edits in the background and instantly refreshes when you switch back to this tab.
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

            {/* Step-by-Step Instructions */}
            <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200/70 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-teal-900">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>How direct Google Sheet linking works:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11.5px] leading-relaxed text-slate-700">
                <li>
                  Open your Google Sheet and click the top-right <span className="font-semibold text-slate-900">Share</span> button.
                </li>
                <li>
                  Under <strong>General access</strong>, switch from "Restricted" to <span className="font-semibold text-teal-800 bg-white px-1 py-0.5 rounded border border-teal-200">"Anyone with the link can view"</span>.
                </li>
                <li>
                  Paste your sheet link above and click <strong>Link Sheet & Start Live Sync</strong>.
                </li>
                <li>
                  <strong>Multi-Month Support:</strong> If your Google Sheet has multiple tabs (e.g. <span className="font-semibold text-slate-900">"September"</span>, <span className="font-semibold text-slate-900">"October"</span>) or month columns, all tabs are imported. Clicking <strong>Total Datas</strong> combines all months together!
                </li>
              </ol>
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
                disabled={isLoading || !googleSheetUrl.trim()}
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
                    <span>Link Sheet & Start Live Sync</span>
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
