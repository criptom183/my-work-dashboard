import React from 'react';
import { Search, Download, Plus } from 'lucide-react';

interface BrandTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExportCsv: () => void;
  onOpenTaskManager: () => void;
}

export const BrandTopBar: React.FC<BrandTopBarProps> = ({
  searchQuery,
  onSearchChange,
  onExportCsv,
  onOpenTaskManager,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 font-medium">Marketing</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Monthly report</span>
      </div>

      {/* Right Action Tools */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input with ⌘K badge */}
        <div className="relative min-w-[240px] sm:min-w-[280px]">
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
        >
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>Export CSV</span>
        </button>

        {/* Open task manager button */}
        <button
          onClick={onOpenTaskManager}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E11D74] hover:bg-[#d01568] text-white font-semibold text-xs transition-all shadow-md shadow-[#E11D74]/20 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Open task manager</span>
        </button>
      </div>
    </div>
  );
};
