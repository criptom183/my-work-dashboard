import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Star,
  CheckCircle2,
  Clock,
  ListTree,
  ChevronDown,
  ChevronUp,
  PieChart,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { DashboardData, WorkItem, TaskItem } from '../types';
import { computeMoMStats, getWorksForSelectedMonth } from '../utils/monthHelper';
import vzoneLogo from '../assets/vzone-logo.png';

interface PresentationModeProps {
  data: DashboardData;
  tasks: TaskItem[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  data,
  tasks,
  selectedMonth,
  onSelectMonth,
  onClose,
}) => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedWorkId, setExpandedWorkId] = useState<string | null>(null);

  const availableMonths = data.availableMonths || ['Sep 2026', 'Oct 2026', 'Nov 2026'];
  const currentWorks = getWorksForSelectedMonth(
    data.worksCompleted || [],
    selectedMonth,
    availableMonths
  ).filter((w) => (w.count || 0) > 0);

  const totalDelivered = currentWorks.reduce((sum, w) => sum + w.count, 0);
  const momStats = computeMoMStats(data.worksCompleted || [], selectedMonth, availableMonths);

  const topWork = currentWorks.length > 0
    ? currentWorks.reduce((max, curr) => (curr.count > max.count ? curr : max), currentWorks[0])
    : null;

  // Category distribution
  const categoryTotals: Record<string, number> = {};
  for (const w of currentWorks) {
    const cat = w.category || 'General';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + w.count;
  }
  const categoriesList = Object.keys(categoryTotals);

  // Filtered deliverables for slide 2
  const filteredWorks = selectedCategory === 'all'
    ? currentWorks
    : currentWorks.filter((w) => (w.category || 'General') === selectedCategory);

  // Active high-priority tasks
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Keyboard navigation (Esc to exit, Arrow keys to navigate slides, F for fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentSlide((prev) => Math.min(prev + 1, 2));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
        toggleFullscreen();
      }
    };

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [onClose]);

  const slideTitles = [
    '1. Executive Performance Overview',
    '2. Work Streams & Deliverable Details',
    '3. Action Items & High-Priority Tasks',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0B091F] text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
      {/* TOP PRESENTATION BAR */}
      <header className="px-6 py-4 bg-[#141133]/90 border-b border-white/10 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center p-1.5 shadow-md shrink-0">
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
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                VZONE MARKETING
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#E11D74]/20 text-[#E11D74] border border-[#E11D74]/30">
                Meeting Mode
              </span>
            </div>
            <p className="text-[11px] text-indigo-200/70 hidden sm:block">
              Client &amp; Executive Review • {selectedMonth === 'all' ? 'All Months Overview' : selectedMonth}
            </p>
          </div>
        </div>

        {/* Center: Month Selector Pills */}
        <div className="hidden md:flex items-center p-1 rounded-full bg-white/5 border border-white/10 text-xs">
          {availableMonths.map((m) => (
            <button
              key={m}
              onClick={() => onSelectMonth(m)}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                selectedMonth === m
                  ? 'bg-[#E11D74] text-white shadow-xs'
                  : 'text-indigo-200/70 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
          <button
            onClick={() => onSelectMonth('all')}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              selectedMonth === 'all'
                ? 'bg-[#E11D74] text-white shadow-xs'
                : 'text-indigo-200/70 hover:text-white'
            }`}
          >
            All Months
          </button>
        </div>

        {/* Right Tools: Fullscreen + Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-200 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold text-xs transition-colors cursor-pointer"
            title="Exit Presentation Mode (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Exit (Esc)</span>
          </button>
        </div>
      </header>

      {/* MAIN SLIDE CONTENT */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 max-w-[1400px] w-full mx-auto flex flex-col justify-center">
        {/* SLIDE 0: EXECUTIVE OVERVIEW */}
        {currentSlide === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header Title */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Executive Performance Summary</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                {selectedMonth === 'all' ? 'Cumulative Marketing Output' : `${selectedMonth} Performance Report`}
              </h1>
              <p className="text-sm sm:text-base text-indigo-200/70 mt-1">
                High-level deliverable throughput, growth velocity, and functional output distribution.
              </p>
            </div>

            {/* 3 Executive Hero Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Total Volume */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1E194D] to-[#151238] border border-white/10 shadow-xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300/80">
                      Total Deliverables Completed
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="flex items-baseline gap-2.5 mt-3">
                    <span className="text-5xl sm:text-6xl font-black text-white tracking-tight">
                      {totalDelivered}
                    </span>
                    <span className="text-base font-semibold text-indigo-200/70">items delivered</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-indigo-200/70">
                    Across {currentWorks.length} active deliverables
                  </span>
                  {momStats.percentChange !== null && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        momStats.percentChange >= 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {momStats.percentChange >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {momStats.percentChange >= 0 ? '+' : ''}
                        {momStats.percentChange.toFixed(1)}% vs {momStats.prevMonth}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Top Deliverable */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#24133A] to-[#180E2B] border border-pink-500/20 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-pink-300/80">
                      Highest Output Stream
                    </span>
                    <Star className="w-4 h-4 text-[#E11D74] fill-[#E11D74]/30" />
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl sm:text-4xl font-black text-white truncate">
                      {topWork ? topWork.activity : 'N/A'}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-[#E11D74]">
                        {topWork ? topWork.count : 0} units
                      </span>
                      <span className="text-xs text-indigo-200/60 font-medium">
                        ({topWork && totalDelivered > 0 ? ((topWork.count / totalDelivered) * 100).toFixed(0) : 0}% of output)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 text-xs text-indigo-200/70">
                  Category: <strong className="text-white">{topWork?.category || 'General'}</strong>
                </div>
              </div>

              {/* Card 3: Output Mix Summary */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1A1844] to-[#110F2E] border border-white/10 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300/80">
                      Functional Output Mix
                    </span>
                    <PieChart className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {categoriesList.slice(0, 3).map((cat) => {
                      const count = categoryTotals[cat];
                      const pct = totalDelivered > 0 ? ((count / totalDelivered) * 100).toFixed(0) : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-200 truncate">{cat}</span>
                            <span className="text-indigo-300 tabular-nums">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-[#E11D74] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 text-xs text-indigo-200/70">
                  Total Categories: <strong className="text-white">{categoriesList.length} operational areas</strong>
                </div>
              </div>
            </div>

            {/* Note banner if available */}
            {data.workListNotes?.[`works_${selectedMonth}`] && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex items-start gap-2.5">
                <span className="font-bold text-amber-300 shrink-0">Meeting Note:</span>
                <span>{data.workListNotes[`works_${selectedMonth}`]}</span>
              </div>
            )}
          </div>
        )}

        {/* SLIDE 1: DELIVERABLES & DETAIL BREAKDOWN */}
        {currentSlide === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header + Category Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Work Streams &amp; Deliverables
                </h2>
                <p className="text-xs sm:text-sm text-indigo-200/70 mt-0.5">
                  Detailed view of individual work units completed in {selectedMonth}.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-200/70 hover:text-white'
                  }`}
                >
                  All ({currentWorks.length})
                </button>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-indigo-200/70 hover:text-white'
                    }`}
                  >
                    {cat} ({categoryTotals[cat]})
                  </button>
                ))}
              </div>
            </div>

            {/* Deliverables Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-1">
              {filteredWorks.map((w) => {
                const isExpanded = expandedWorkId === w.id;
                const subList = w.subItems || [];

                return (
                  <div
                    key={w.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-400/40 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                          {w.category || 'General'}
                        </span>
                        <span className="text-xl font-black text-white tabular-nums">
                          {w.count}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white leading-snug group-hover:text-pink-300 transition-colors">
                        {w.activity}
                      </h3>

                      {w.customNote && (
                        <p className="text-xs text-amber-200/90 mt-1 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                          {w.customNote}
                        </p>
                      )}

                      {/* Detail sub-items if expanded */}
                      {isExpanded && subList.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 animate-in fade-in duration-150">
                          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                            Recorded Details ({subList.length})
                          </span>
                          {subList.map((s, idx) => (
                            <div
                              key={s.id || idx}
                              className="px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs text-slate-200 flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-white block truncate">
                                  {idx + 1}. {s.title}
                                </span>
                                {s.note && (
                                  <span className="text-[11px] text-indigo-200/70 block truncate">
                                    {s.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom toggle for details */}
                    {subList.length > 0 && (
                      <button
                        onClick={() => setExpandedWorkId(isExpanded ? null : w.id)}
                        className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-indigo-300 hover:text-white cursor-pointer w-full"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <ListTree className="w-3.5 h-3.5 text-[#E11D74]" />
                          <span>More Details ({subList.length})</span>
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SLIDE 2: ACTION ITEMS & TASKS */}
        {currentSlide === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-400/30 mb-2">
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                <span>Next Steps &amp; Execution Roadmap</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Active Tasks &amp; Action Plan
              </h2>
              <p className="text-sm sm:text-base text-indigo-200/70 mt-1">
                Prioritized marketing deliverables, in-progress tasks, and upcoming deadlines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Left Column: Pending / In Progress */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-sm text-white">
                      In Progress &amp; Planned ({pendingTasks.length})
                    </span>
                  </div>
                  <span className="text-xs text-indigo-200/60 font-semibold">Immediate Priority</span>
                </div>

                {pendingTasks.length > 0 ? (
                  <div className="space-y-2.5">
                    {pendingTasks.slice(0, 6).map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-3 hover:border-amber-400/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{t.title}</h4>
                          {t.description && (
                            <p className="text-xs text-indigo-200/70 mt-0.5 line-clamp-1">{t.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {t.priority}
                            </span>
                            {t.assignedTo && (
                              <span className="text-[11px] text-slate-300 font-medium">
                                Assigned: {t.assignedTo}
                              </span>
                            )}
                          </div>
                        </div>

                        {t.dueDate && (
                          <span className="text-[11px] text-indigo-300 font-semibold shrink-0 bg-white/5 px-2 py-1 rounded">
                            Due {t.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-4">No active pending tasks recorded.</p>
                )}
              </div>

              {/* Right Column: Completed Highlights */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-extrabold text-sm text-white">
                      Completed Milestones ({completedTasks.length})
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">Ready for Review</span>
                </div>

                {completedTasks.length > 0 ? (
                  <div className="space-y-2.5">
                    {completedTasks.slice(0, 6).map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-3 opacity-80"
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-200 line-through truncate">{t.title}</h4>
                          <span className="text-[11px] text-emerald-300 mt-1 inline-flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Done</span>
                          </span>
                        </div>
                        {t.assignedTo && (
                          <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                            {t.assignedTo}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-4">Completed items will appear here.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM SLIDE CONTROLLER FOOTER */}
      <footer className="px-6 py-4 bg-[#141133]/90 border-t border-white/10 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, 2))}
            disabled={currentSlide === 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D74] hover:bg-[#d01568] disabled:opacity-30 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-[#E11D74]/20"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Indicator Dots + Title */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-indigo-200/80 hidden sm:inline">
            {slideTitles[currentSlide]}
          </span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  currentSlide === idx ? 'bg-[#E11D74] w-6' : 'bg-white/20 hover:bg-white/40'
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="text-[11px] text-indigo-300/60 hidden md:flex items-center gap-3">
          <span>Use <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">→</kbd> to navigate</span>
          <span>•</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Esc</kbd> to exit</span>
        </div>
      </footer>
    </div>
  );
};
