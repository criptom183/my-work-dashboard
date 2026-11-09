import React from 'react';
import { Search, Download, Plus, Lock, Unlock, Share2, Eye, EyeOff, CheckSquare } from 'lucide-react';

interface BrandTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExportCsv: () => void;
  onOpenTaskManager: () => void;
  isViewOnly?: boolean;
  onUnlockEditor?: () => void;
  onShareViewLink?: () => void;
  onToggleViewPreview?: () => void;
  isEditorAuthorized?: boolean;
}

export const BrandTopBar: React.FC<BrandTopBarProps> = ({
  searchQuery,
  onSearchChange,
  onExportCsv,
  onOpenTaskManager,
  isViewOnly = false,
  onUnlockEditor,
  onShareViewLink,
  onToggleViewPreview,
  isEditorAuthorized = false,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      {/* Breadcrumbs & Role Indicator */}
      <div className="flex items-center gap-2.5 text-sm flex-wrap">
        <span className="text-slate-400 font-medium">Marketing</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Monthly report</span>

        {/* View-Only vs Editor Mode Badge */}
        {isViewOnly ? (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>View-Only Mode</span>
            </span>
            {onUnlockEditor && (
              <button
                type="button"
                onClick={onUnlockEditor}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-[#E11D74] hover:text-white bg-pink-50 hover:bg-[#E11D74] border border-pink-200 transition-colors cursor-pointer"
                title="Enter passcode to unlock editor privileges"
              >
                <Unlock className="w-2.5 h-2.5" />
                <span>Unlock Editor</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Unlock className="w-3 h-3 text-emerald-600" />
              <span>Editor Mode</span>
            </span>
            {onShareViewLink && (
              <button
                type="button"
                onClick={onShareViewLink}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-600 hover:text-[#E11D74] bg-white border border-slate-200 hover:border-pink-300 transition-colors cursor-pointer"
                title="Copy view-only link to share with clients or team"
              >
                <Share2 className="w-2.5 h-2.5" />
                <span>Share View Link</span>
              </button>
            )}
            {onToggleViewPreview && isEditorAuthorized && (
              <button
                type="button"
                onClick={onToggleViewPreview}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
                title="Preview dashboard as a read-only viewer"
              >
                <Eye className="w-2.5 h-2.5" />
                <span>Preview Viewer</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Action Tools */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input with ⌘K badge */}
        <div className="relative min-w-[220px] sm:min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search deliverables..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-12 py-2 text-xs bg-white border border-slate-200/90 rounded-full focus:outline-none focus:ring-2 focus:ring-[#E11D74]/20 focus:border-[#E11D74] shadow-2xs text-slate-800 placeholder:text-slate-400"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>

        {/* Export CSV button */}
        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
        >
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>Export CSV</span>
        </button>

        {/* Open task manager button */}
        <button
          onClick={onOpenTaskManager}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E11D74] hover:bg-[#d01568] text-white font-semibold text-xs transition-all shadow-md shadow-[#E11D74]/20 cursor-pointer active:scale-98"
        >
          {isViewOnly ? (
            <>
              <CheckSquare className="w-4 h-4" />
              <span>View tasks</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Open task manager</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
