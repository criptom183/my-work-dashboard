import React from 'react';
import {
  LayoutGrid,
  ListFilter,
  CheckSquare,
  TrendingUp,
  FileText,
  Download,
  Save,
  RotateCcw,
  Link2,
  FileSpreadsheet,
} from 'lucide-react';
import { DashboardData } from '../types';
import vzoneLogo from '../assets/vzone-logo.png';

interface SidebarProps {
  currentPage: 'dashboard' | 'tasks';
  onNavigate: (page: 'dashboard' | 'tasks') => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  data: DashboardData;
  isSavedInStorage: boolean;
  onExportCsv: () => void;
  onSaveToMemory: () => void;
  onResetData: () => void;
  onOpenSheetModal: () => void;
  totalDeliverablesCount: number;
  activeTasksCount: number;
  isViewOnly?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  activeTab = 'dashboard',
  onSelectTab,
  data,
  isSavedInStorage,
  onExportCsv,
  onSaveToMemory,
  onResetData,
  onOpenSheetModal,
  totalDeliverablesCount,
  activeTasksCount,
  isViewOnly = false,
}) => {
  return (
    <aside className="w-64 bg-[#1D1B48] text-white flex flex-col justify-between shrink-0 min-h-screen border-r border-[#27245A] select-none">
      {/* Top: Logo & Nav items */}
      <div className="p-5">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          {/* VZone Official Geometric Ribbon Logo */}
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1 shadow-md shrink-0">
            <img
              src={vzoneLogo}
              alt="VZone International"
              className="w-full h-full object-contain filter drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = './assets/aistudio/IMG_20260814_221842-removebg-preview_882c4c65.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-extrabold text-base tracking-wider text-white">
                VZONE
              </span>
            </div>
            <div className="text-[10px] font-bold tracking-widest text-slate-300 uppercase leading-none">
              INTERNATIONAL
            </div>
            <div className="text-[8px] font-medium tracking-wider text-indigo-300/80 uppercase mt-0.5">
              World No.1 AI Fleet Management & Telematics
            </div>
          </div>
        </div>

        {/* WORKSPACE SECTION */}
        <div className="mb-7">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8E8CAE] px-3 mb-2.5">
            Workspace
          </p>
          <nav className="space-y-1">
            {/* Dashboard */}
            <button
              onClick={() => {
                onNavigate('dashboard');
                onSelectTab?.('dashboard');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                currentPage === 'dashboard' && activeTab === 'dashboard'
                  ? 'bg-[#E11D74] text-white shadow-md shadow-[#E11D74]/25'
                  : 'text-[#9D9BC2] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </div>
            </button>

            {/* Deliverables */}
            <button
              onClick={() => {
                onNavigate('dashboard');
                onSelectTab?.('deliverables');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                currentPage === 'dashboard' && activeTab === 'deliverables'
                  ? 'bg-white/10 text-white'
                  : 'text-[#9D9BC2] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <ListFilter className="w-4 h-4 shrink-0" />
                <span>Deliverables</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2C2960] text-indigo-200">
                {totalDeliverablesCount}
              </span>
            </button>

            {/* Task manager */}
            <button
              onClick={() => {
                onNavigate('tasks');
                onSelectTab?.('tasks');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                currentPage === 'tasks'
                  ? 'bg-[#E11D74] text-white shadow-md shadow-[#E11D74]/25'
                  : 'text-[#9D9BC2] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckSquare className="w-4 h-4 shrink-0" />
                <span>Task manager</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2C2960] text-indigo-200">
                {activeTasksCount}
              </span>
            </button>

            {/* Monthly trend */}
            <button
              onClick={() => {
                onNavigate('dashboard');
                onSelectTab?.('trend');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                currentPage === 'dashboard' && activeTab === 'trend'
                  ? 'bg-white/10 text-white'
                  : 'text-[#9D9BC2] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Monthly trend</span>
              </div>
            </button>

            {/* Reports */}
            <button
              onClick={() => {
                onNavigate('dashboard');
                onSelectTab?.('reports');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                currentPage === 'dashboard' && activeTab === 'reports'
                  ? 'bg-white/10 text-white'
                  : 'text-[#9D9BC2] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Reports</span>
              </div>
            </button>
          </nav>
        </div>

        {/* DATA SECTION */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8E8CAE] px-3 mb-2.5">
            Data
          </p>
          <nav className="space-y-1">
            <button
              onClick={onExportCsv}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-[#9D9BC2] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export CSV</span>
            </button>

            {!isViewOnly && (
              <>
                <button
                  onClick={onSaveToMemory}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-[#9D9BC2] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>Save to memory</span>
                </button>

                <button
                  onClick={onResetData}
                  title="Restore full 18-deliverable template with Sep & Oct data"
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-[#9D9BC2] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Reset to template</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Bottom: DATA SOURCE CARD */}
      <div className="p-4 border-t border-[#27245A]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8CAE] px-1 mb-2">
          Data Source
        </p>
        <div className="p-3.5 rounded-2xl bg-[#27245A]/90 border border-indigo-400/10">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#18163E] border border-amber-400/30 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-extrabold text-[#FFC83B]">XLSX</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {data.fileName || 'VZONE.XLSX'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    data.sheetSourceUrl ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[10px] text-slate-300 truncate">
                  {data.sheetSourceUrl ? 'Live Sheet Connected' : isSavedInStorage ? 'Saved in storage' : 'Unsaved locally'}
                </span>
              </div>
            </div>
          </div>

          {!isViewOnly ? (
            <button
              onClick={onOpenSheetModal}
              className="w-full py-2.5 px-3 rounded-xl bg-[#FFC83B] hover:bg-[#ffcf55] text-[#1D1B48] font-bold text-xs shadow-md shadow-amber-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Link2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Link Sheet / Upload</span>
            </button>
          ) : (
            <div className="w-full py-2 px-3 rounded-xl bg-[#18163E]/60 text-slate-400 font-medium text-[11px] text-center border border-white/5">
              Read-Only View
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
