import React from 'react';
import {
  Link2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Check,
  Save,
  HardDrive,
  RotateCcw,
  ExternalLink,
  Clock,
  CheckSquare,
} from 'lucide-react';
import { DashboardData, SyncSettings } from '../types';
import { StorageMeta } from '../utils/storage';

interface HeaderProps {
  data: DashboardData;
  onOpenGoogleSheetModal: () => void;
  onResetData: () => void;
  onExportCsv: () => void;
  onSaveToLocalMemory: () => void;
  isSavedInStorage: boolean;
  savedMeta: StorageMeta | null;
  onClearStorage: () => void;
  syncSettings: SyncSettings;
  isSyncing: boolean;
  onSyncNow: () => void;
  onNavigateToTasks?: () => void;
  activeTasksCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  onOpenGoogleSheetModal,
  onResetData,
  onExportCsv,
  onSaveToLocalMemory,
  isSavedInStorage,
  savedMeta,
  onClearStorage,
  syncSettings,
  isSyncing,
  onSyncNow,
  onNavigateToTasks,
  activeTasksCount,
}) => {

  const isGoogleSheetConnected = Boolean(data.sheetSourceUrl);

  return (
    <header className="pt-2 pb-6 border-b border-slate-200/80 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left branding and titles */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 text-xs font-bold tracking-wide uppercase border border-teal-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
              VZone Marketing
            </span>

            {isGoogleSheetConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Live Google Sheet Connected</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Monthly report dashboard
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1 max-w-2xl leading-relaxed">
            Real-time deliverable tracking directly linked to your Google Sheet.
          </p>

          {/* Active File / Sheet & Status Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs sm:text-sm text-slate-600">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-slate-200 shadow-2xs font-medium text-slate-700">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Source:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={data.fileName}>
                {data.fileName}
              </span>
            </div>

            {/* Local Storage Indicator */}
            {isSavedInStorage ? (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200/70 text-xs font-medium"
                title={`Saved to browser local memory: ${savedMeta?.savedAt || 'Active'}`}
              >
                <HardDrive className="w-3 h-3 text-emerald-600" />
                <span>Saved in memory {savedMeta?.savedAt ? `(${savedMeta.savedAt})` : ''}</span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-200/70 text-xs font-medium"
                title="This dataset is in memory only. Click 'Save to Local Memory' to keep it."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Unsaved locally</span>
              </div>
            )}

            {/* If Google Sheet is connected, show link */}
            {data.sheetSourceUrl && (
              <a
                href={data.sheetSourceUrl}
                target="_blank"
                rel="noreferrer"
                title="Open source Google Sheet in a new tab to edit data"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-teal-700 hover:text-teal-800 bg-teal-50/70 hover:bg-teal-100/70 rounded-md border border-teal-200 transition-colors text-xs font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in Google Sheets</span>
              </a>
            )}

            <button
              onClick={onResetData}
              title="Reload sample VZONE report data"
              className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors text-xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Sample</span>
            </button>
          </div>
        </div>

        {/* Right action bar: Task Manager Link & Live Sync Controls */}
        <div className="flex flex-wrap items-center gap-2 lg:self-start">
          {/* Navigation link to Task Manager Page */}
          {onNavigateToTasks && (
            <button
              onClick={onNavigateToTasks}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer group active:scale-98 border border-teal-700/80"
              title="Open Task Manager to track, assign, and manage ongoing tasks"
            >
              <CheckSquare className="w-4 h-4 text-teal-300 group-hover:scale-110 transition-transform" />
              <span>Task Manager</span>
              {activeTasksCount !== undefined && activeTasksCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white leading-none">
                  {activeTasksCount}
                </span>
              )}
            </button>
          )}

          {/* If Google Sheet is connected, show prominent Sync Now & Status button */}
          {isGoogleSheetConnected ? (

            <div className="flex items-center bg-white rounded-lg border border-teal-200 p-1 shadow-2xs">
              <button
                onClick={onSyncNow}
                disabled={isSyncing}
                title="Fetch latest updates from Google Sheet right now"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs sm:text-sm transition-all shadow-xs disabled:opacity-60 cursor-pointer active:scale-98"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <button
                onClick={onOpenGoogleSheetModal}
                title="Configure Google Sheet auto-update settings"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-teal-800 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">
                  {syncSettings.autoSync ? `Auto: ${syncSettings.interval}` : 'Auto: Off'}
                </span>
                {syncSettings.lastSyncedAt && (
                  <span className="text-[11px] text-slate-400">
                    ({syncSettings.lastSyncedAt})
                  </span>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenGoogleSheetModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium text-sm transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-98"
            >
              <Link2 className="w-4 h-4" />
              <span>Link Google Sheet</span>
            </button>
          )}

          {/* Save to Local Memory Option */}
          <button
            onClick={onSaveToLocalMemory}
            title={
              isSavedInStorage
                ? 'Update saved data and connection in local memory'
                : 'Save this sheet data to local memory so it persists'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all shadow-2xs cursor-pointer active:scale-98 ${
              isSavedInStorage
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            {isSavedInStorage ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Saved in Memory</span>
                <span className="sm:hidden">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Save to Memory</span>
                <span className="sm:hidden">Save</span>
              </>
            )}
          </button>

          {/* Export CSV */}
          <button
            onClick={onExportCsv}
            title="Export current report to CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
};
