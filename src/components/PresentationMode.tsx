import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Star,
  CheckCircle2,
  Clock,
  Video,
  MessageSquare,
  FileText,
  Palette,
  ExternalLink,
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
  const [activeDetailModal, setActiveDetailModal] = useState<WorkItem | null>(null);

  const availableMonths = data.availableMonths || ['Sep 2026', 'Oct 2026', 'Nov 2026'];
  const currentWorks = useMemo(
    () =>
      getWorksForSelectedMonth(
        data.worksCompleted || [],
        selectedMonth,
        availableMonths
      ).filter((w) => (w.count || 0) > 0),
    [data.worksCompleted, selectedMonth, availableMonths]
  );

  const totalDelivered = useMemo(
    () => currentWorks.reduce((sum, w) => sum + (w.count || 0), 0),
    [currentWorks]
  );

  const momStats = useMemo(
    () => computeMoMStats(data.worksCompleted || [], selectedMonth, availableMonths),
    [data.worksCompleted, selectedMonth, availableMonths]
  );

  // Category distribution
  const { categoryTotals, categoryList } = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const w of currentWorks) {
      const cat = w.category || 'General';
      totals[cat] = (totals[cat] || 0) + (w.count || 0);
    }
    const list = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    return { categoryTotals: totals, categoryList: list };
  }, [currentWorks]);

  // Color mapping helper
  const getCategoryMeta = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('video')) {
      return {
        name: 'Video',
        color: '#6366F1',
        bgPill: 'bg-[#6366F1]',
        textPill: 'text-[#6366F1]',
        icon: Video,
      };
    }
    if (c.includes('social')) {
      return {
        name: 'Social',
        color: '#E11D74',
        bgPill: 'bg-[#E11D74]',
        textPill: 'text-[#E11D74]',
        icon: MessageSquare,
      };
    }
    if (c.includes('market')) {
      return {
        name: 'Marketing',
        color: '#F59E0B',
        bgPill: 'bg-[#F59E0B]',
        textPill: 'text-[#F59E0B]',
        icon: FileText,
      };
    }
    if (c.includes('design') || c.includes('web')) {
      return {
        name: 'Design & web',
        color: '#10B981',
        bgPill: 'bg-[#10B981]',
        textPill: 'text-[#10B981]',
        icon: Palette,
      };
    }
    return {
      name: cat,
      color: '#8B5CF6',
      bgPill: 'bg-[#8B5CF6]',
      textPill: 'text-[#8B5CF6]',
      icon: FileText,
    };
  };

  // Sorted work items for top output streams
  const sortedWorks = useMemo(
    () => [...currentWorks].sort((a, b) => (b.count || 0) - (a.count || 0)),
    [currentWorks]
  );

  const topWork = sortedWorks[0] || null;
  const topWorksMax = sortedWorks.length > 0 ? sortedWorks[0].count : 1;

  // Filtered deliverables for slide 2
  const filteredWorks = useMemo(() => {
    if (selectedCategory === 'all') return currentWorks;
    return currentWorks.filter((w) => {
      const c = (w.category || '').toLowerCase();
      if (selectedCategory === 'video') return c.includes('video');
      if (selectedCategory === 'social') return c.includes('social');
      if (selectedCategory === 'marketing') return c.includes('market');
      if (selectedCategory === 'design') return c.includes('design') || c.includes('web');
      return (w.category || 'General') === selectedCategory;
    });
  }, [currentWorks, selectedCategory]);

  // Grouped works by main functions for Slide 2
  const videoWorks = currentWorks.filter((w) => (w.category || '').toLowerCase().includes('video'));
  const socialWorks = currentWorks.filter((w) => (w.category || '').toLowerCase().includes('social'));
  const marketingWorks = currentWorks.filter((w) => (w.category || '').toLowerCase().includes('market'));
  const designWorks = currentWorks.filter(
    (w) => (w.category || '').toLowerCase().includes('design') || (w.category || '').toLowerCase().includes('web')
  );
  const otherWorks = currentWorks.filter(
    (w) =>
      !(w.category || '').toLowerCase().includes('video') &&
      !(w.category || '').toLowerCase().includes('social') &&
      !(w.category || '').toLowerCase().includes('market') &&
      !(w.category || '').toLowerCase().includes('design') &&
      !(w.category || '').toLowerCase().includes('web')
  );

  // Task lists for slide 3
  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'completed'),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'completed'),
    [tasks]
  );

  const totalTasks = tasks.length || 1;
  const roadmapPct = Math.round((completedTasks.length / totalTasks) * 100);

  // Fullscreen toggle handler
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDetailModal) {
          setActiveDetailModal(null);
        } else {
          onClose();
        }
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
  }, [onClose, activeDetailModal]);

  // Stepper labels
  const steps = [
    { id: 0, label: '01 Overview' },
    { id: 1, label: '02 Work streams & deliverables' },
    { id: 2, label: '03 Active tasks' },
  ];

  // SVG Donut calculation
  const donutRadius = 52;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumulatedAngle = 0;

  const donutSegments = categoryList.map((cat) => {
    const count = categoryTotals[cat];
    const pct = totalDelivered > 0 ? count / totalDelivered : 0;
    const strokeDash = pct * donutCircumference;
    const strokeOffset = -accumulatedAngle * donutCircumference;
    accumulatedAngle += pct;
    return {
      category: cat,
      count,
      pct: Math.round(pct * 100),
      strokeDash,
      strokeOffset,
      meta: getCategoryMeta(cat),
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#0B091F] text-white flex flex-col overflow-hidden select-none font-sans">
      {/* 1. TOP PRESENTATION BAR */}
      <header className="px-6 py-3.5 bg-[#0D0B21] border-b border-[#211D44] flex items-center justify-between gap-4 shrink-0">
        {/* Left: VZone Brand and Meeting Mode Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5 shadow-md shrink-0">
            <img
              src={vzoneLogo}
              alt="VZone International"
              className="w-full h-full object-contain filter drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  './assets/aistudio/IMG_20260814_221842-removebg-preview_882c4c65.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                VZONE MARKETING
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#E11D74]/20 text-[#FF2D8D] border border-[#E11D74]/50">
                MEETING MODE
              </span>
            </div>
            <p className="text-[11px] text-[#8E8CAE] font-medium hidden sm:block">
              Client &amp; Executive Review ·{' '}
              {selectedMonth === 'all' ? 'All Months Overview' : selectedMonth}
            </p>
          </div>
        </div>

        {/* Center: Month Selector Pills */}
        <div className="flex items-center p-1 rounded-full bg-[#171433] border border-[#2B2555] text-xs">
          {availableMonths.map((m) => (
            <button
              key={m}
              onClick={() => onSelectMonth(m)}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                selectedMonth === m
                  ? 'bg-[#E11D74] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
          <button
            onClick={() => onSelectMonth('all')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
              selectedMonth === 'all'
                ? 'bg-[#E11D74] text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            All months
          </button>
        </div>

        {/* Right Tools: Fullscreen + Exit */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-xl bg-[#171433] hover:bg-[#201C46] border border-[#2B2555] text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-[#241328] hover:bg-[#341838] border border-pink-500/30 text-pink-200 hover:text-white flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer"
            title="Exit Presentation Mode (Esc)"
          >
            <X className="w-3.5 h-3.5 text-pink-300" />
            <span>Exit</span>
            <span className="text-[10px] text-pink-300/60 font-mono">Esc</span>
          </button>
        </div>
      </header>

      {/* 2. PROGRESS STEPPER NAVIGATION UNDERLINE */}
      <nav className="px-8 pt-3 pb-1 bg-[#0D0B21] border-b border-[#211D44] shrink-0">
        <div className="grid grid-cols-3 gap-6 max-w-[1400px] mx-auto">
          {steps.map((s) => {
            const isActive = currentSlide === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(s.id)}
                className="group text-left cursor-pointer transition-all"
              >
                <div
                  className={`text-xs font-bold tracking-wide transition-colors ${
                    isActive ? 'text-white' : 'text-[#7E76B5] group-hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </div>
                <div
                  className={`mt-2 rounded-full transition-all duration-300 ${
                    isActive ? 'h-1 bg-[#E11D74]' : 'h-0.5 bg-[#231F47] group-hover:bg-[#352F66]'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3. MAIN SLIDE CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 max-w-[1440px] w-full mx-auto flex flex-col justify-center">
        {/* ============================================================== */}
        {/* SLIDE 0: EXECUTIVE OVERVIEW */}
        {/* ============================================================== */}
        {currentSlide === 0 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Slide Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#7E76B5] mb-1.5">
                  EXECUTIVE PERFORMANCE SUMMARY
                </p>
                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
                  {selectedMonth === 'all' ? 'All Months ' : `${selectedMonth} `}
                  <span className="text-[#E11D74]">performance</span>
                </h1>
                <p className="text-sm text-slate-400 mt-2 max-w-2xl">
                  Deliverable throughput, month-on-month velocity and how output was split across functions.
                </p>
              </div>

              {/* Status pill on right */}
              <div className="bg-[#141D2E] border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 self-start md:self-auto shrink-0 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span>Reporting period closed</span>
              </div>
            </div>

            {/* 3 Hero Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Total Deliverables Completed */}
              <div className="bg-[#131131] border border-[#272352] rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[380px]">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#7E76B5]">
                    TOTAL DELIVERABLES COMPLETED
                  </p>
                  <div className="flex items-baseline mt-3">
                    <span className="text-6xl sm:text-7xl font-black text-white tracking-tight">
                      {totalDelivered}
                    </span>
                    <span className="text-base text-slate-300 font-medium ml-3">
                      units delivered
                    </span>
                  </div>

                  {/* MoM Velocity Pill */}
                  <div className="mt-4 flex items-center gap-2">
                    {momStats.percentChange !== null ? (
                      <>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            momStats.percentChange >= 0
                              ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                              : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                          }`}
                        >
                          {momStats.percentChange >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {momStats.percentChange >= 0 ? '+' : ''}
                            {momStats.percentChange.toFixed(1)}%
                          </span>
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          vs {momStats.prevMonth}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Baseline tracking period</span>
                    )}
                  </div>
                </div>

                {/* Bottom 3-column stats */}
                <div className="pt-6 border-t border-[#231F47] grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-2xl font-black text-white">{currentWorks.length}</div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Work streams
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{categoryList.length}</div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Functions
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{pendingTasks.length}</div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Open actions
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Functional Output Mix */}
              <div className="bg-[#131131] border border-[#272352] rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[380px]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#7E76B5]">
                    FUNCTIONAL OUTPUT MIX
                  </p>
                  <span className="text-xs text-slate-400 font-medium">
                    {categoryList.length} functions
                  </span>
                </div>

                {/* Center SVG Donut Chart */}
                <div className="my-2 flex items-center justify-center">
                  <div className="relative w-36 h-36">
                    <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90 transform">
                      <circle
                        cx="70"
                        cy="70"
                        r={donutRadius}
                        fill="transparent"
                        stroke="#1D1A40"
                        strokeWidth="18"
                      />
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.category}
                          cx="70"
                          cy="70"
                          r={donutRadius}
                          fill="transparent"
                          stroke={seg.meta.color}
                          strokeWidth="18"
                          strokeDasharray={`${seg.strokeDash} ${donutCircumference}`}
                          strokeDashoffset={seg.strokeOffset}
                          className="transition-all duration-500"
                        />
                      ))}
                    </svg>
                    {/* Centered text inside donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-white tracking-tight leading-none">
                        {totalDelivered}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                        units
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend list below */}
                <div className="space-y-2 pt-2 border-t border-[#231F47]">
                  {donutSegments.slice(0, 4).map((seg) => (
                    <div
                      key={seg.category}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: seg.meta.color }}
                        />
                        <span className="font-semibold text-slate-200">{seg.category}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-bold text-white">{seg.count}</span>
                        <span className="text-slate-400 w-8 text-right font-medium">
                          {seg.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 3: Highest Output Streams */}
              <div className="bg-[#131131] border border-[#272352] rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[380px]">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#7E76B5]">
                      HIGHEST OUTPUT STREAMS
                    </p>
                    <Star className="w-4 h-4 text-[#E11D74]" />
                  </div>

                  {/* Highlight headline */}
                  <div className="mt-4">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                      {topWork ? topWork.activity : 'No deliverables'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="text-[#E11D74] font-bold">
                        {topWork ? `${topWork.count} units each` : '0 units'}
                      </span>{' '}
                      ·{' '}
                      {topWork && totalDelivered > 0
                        ? `${Math.round((topWork.count / totalDelivered) * 100)}% of output apiece`
                        : '0%'}{' '}
                      · {topWork?.category || 'General'}
                    </p>
                  </div>
                </div>

                {/* Progress bars list for top streams */}
                <div className="mt-5 space-y-3 pt-3 border-t border-[#231F47]">
                  {sortedWorks.slice(0, 4).map((w) => {
                    const meta = getCategoryMeta(w.category || 'General');
                    const barWidth = Math.max(
                      10,
                      Math.round(((w.count || 0) / topWorksMax) * 100)
                    );

                    return (
                      <div key={w.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 truncate pr-2">
                            {w.activity}
                          </span>
                          <span className="font-bold text-white tabular-nums">{w.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#1C183E] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: meta.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SLIDE 1: WORK STREAMS & DELIVERABLES */}
        {/* ============================================================== */}
        {currentSlide === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header + Category Tabs */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#7E76B5] mb-1">
                  {currentWorks.length} WORK STREAMS · {totalDelivered} UNITS
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Work streams &amp; deliverables
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Every unit completed in {selectedMonth === 'all' ? 'all months' : selectedMonth}, grouped by function.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#6366F1] text-white shadow-sm'
                      : 'bg-[#171433] border border-[#2B2555] text-slate-300 hover:text-white'
                  }`}
                >
                  All {totalDelivered}
                </button>
                <button
                  onClick={() => setSelectedCategory('video')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCategory === 'video'
                      ? 'bg-[#6366F1] text-white shadow-sm'
                      : 'bg-[#171433] border border-[#2B2555] text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-xs bg-[#6366F1]" />
                  <span>Video {categoryTotals['Video production'] || 0}</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('social')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCategory === 'social'
                      ? 'bg-[#E11D74] text-white shadow-sm'
                      : 'bg-[#171433] border border-[#2B2555] text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-xs bg-[#E11D74]" />
                  <span>Social {categoryTotals['Social media'] || 0}</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('marketing')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCategory === 'marketing'
                      ? 'bg-[#F59E0B] text-white shadow-sm'
                      : 'bg-[#171433] border border-[#2B2555] text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-xs bg-[#F59E0B]" />
                  <span>Marketing {categoryTotals['Marketing'] || 0}</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('design')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCategory === 'design'
                      ? 'bg-[#10B981] text-white shadow-sm'
                      : 'bg-[#171433] border border-[#2B2555] text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-xs bg-[#10B981]" />
                  <span>Design &amp; web {categoryTotals['Design & web'] || 0}</span>
                </button>
              </div>
            </div>

            {/* 2-Column Grouped Layout matching design */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[64vh] overflow-y-auto pr-1">
              {/* Column 1: Video Production */}
              {(selectedCategory === 'all' || selectedCategory === 'video') && (
                <div className="bg-[#131131] border border-[#272352] rounded-2xl p-6 shadow-xl space-y-5">
                  {/* Category Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#231F47]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Video className="w-4 h-4" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Video production</h3>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-white">
                        {categoryTotals['Video production'] || 0}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {totalDelivered > 0
                          ? `${Math.round(((categoryTotals['Video production'] || 0) / totalDelivered) * 100)}%`
                          : '0%'}
                      </span>
                    </div>
                  </div>

                  {/* Deliverables rows */}
                  <div className="space-y-4">
                    {videoWorks.map((w) => {
                      const count = w.count || 0;
                      const subItems = w.subItems || [];
                      const barWidth = Math.max(10, Math.round((count / topWorksMax) * 100));

                      return (
                        <div key={w.id} className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-white truncate">{w.activity}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                              {w.customNote &&
                                (w.customNote.toLowerCase().includes('pending') ? (
                                  <span className="bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    ● {w.customNote}
                                  </span>
                                ) : (
                                  <span>{w.customNote}</span>
                                ))}
                              {w.customNote &&
                                !w.customNote.toLowerCase().includes('pending') &&
                                subItems.length > 0 && <span>·</span>}
                              {subItems.length > 0 && (
                                <button
                                  onClick={() => setActiveDetailModal(w)}
                                  className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                                >
                                  {subItems.length} {subItems.length === 1 ? 'detail' : 'details'} ›
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Bar + Count */}
                          <div className="flex items-center gap-3 shrink-0 w-32 sm:w-44">
                            <div className="flex-1 h-2 rounded-full bg-[#1C183E] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#6366F1]"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="font-bold text-white text-sm w-4 text-right tabular-nums">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Column 2: Social Media + Marketing + Design */}
              <div className="space-y-6">
                {/* Social media card */}
                {(selectedCategory === 'all' || selectedCategory === 'social') && (
                  <div className="bg-[#131131] border border-[#272352] rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-[#231F47]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-[#E11D74]">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Social media</h3>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-white">
                          {categoryTotals['Social media'] || 0}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {totalDelivered > 0
                            ? `${Math.round(((categoryTotals['Social media'] || 0) / totalDelivered) * 100)}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {socialWorks.map((w) => {
                        const count = w.count || 0;
                        const subItems = w.subItems || [];
                        const barWidth = Math.max(10, Math.round((count / topWorksMax) * 100));

                        return (
                          <div key={w.id} className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-white truncate">{w.activity}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                                {w.customNote && <span>{w.customNote}</span>}
                                {w.customNote && subItems.length > 0 && <span>·</span>}
                                {subItems.length > 0 && (
                                  <button
                                    onClick={() => setActiveDetailModal(w)}
                                    className="text-pink-400 hover:text-pink-300 font-semibold cursor-pointer"
                                  >
                                    {subItems.length} {subItems.length === 1 ? 'detail' : 'details'} ›
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 w-32 sm:w-44">
                              <div className="flex-1 h-2 rounded-full bg-[#1C183E] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#E11D74]"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="font-bold text-white text-sm w-4 text-right tabular-nums">
                                {count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Marketing & Design Cards stacked */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Marketing */}
                  {(selectedCategory === 'all' || selectedCategory === 'marketing') && (
                    <div className="bg-[#131131] border border-[#272352] rounded-2xl p-5 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-[#231F47]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]" />
                          <h4 className="font-bold text-white text-sm">Marketing</h4>
                        </div>
                        <span className="text-xl font-black text-white">
                          {categoryTotals['Marketing'] || 0}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {marketingWorks.map((w) => (
                          <div key={w.id} className="text-xs">
                            <span className="font-bold text-white block">{w.activity}</span>
                            {w.customNote && (
                              <p className="text-slate-400 mt-0.5 leading-snug">{w.customNote}</p>
                            )}
                            <div className="text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span>{w.count} {w.count === 1 ? 'unit' : 'units'}</span>
                              {w.subItems && w.subItems.length > 0 && (
                                <>
                                  <span>·</span>
                                  <button
                                    onClick={() => setActiveDetailModal(w)}
                                    className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                                  >
                                    {w.subItems.length} {w.subItems.length === 1 ? 'detail' : 'details'} ›
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Design & web */}
                  {(selectedCategory === 'all' || selectedCategory === 'design') && (
                    <div className="bg-[#131131] border border-[#272352] rounded-2xl p-5 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-[#231F47]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
                          <h4 className="font-bold text-white text-sm">Design &amp; web</h4>
                        </div>
                        <span className="text-xl font-black text-white">
                          {categoryTotals['Design & web'] || 0}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {designWorks.map((w) => (
                          <div key={w.id} className="text-xs">
                            <span className="font-bold text-white block">{w.activity}</span>
                            {w.customNote && (
                              <p className="text-slate-400 mt-0.5 leading-snug">{w.customNote}</p>
                            )}
                            {w.subItems && w.subItems.length > 0 && (
                              <div className="mt-1">
                                <button
                                  onClick={() => setActiveDetailModal(w)}
                                  className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                                >
                                  {w.subItems.length} {w.subItems.length === 1 ? 'detail' : 'details'} ›
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SLIDE 2: ACTION PLAN */}
        {/* ============================================================== */}
        {currentSlide === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header + Roadmap Progress Widget */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#7E76B5] mb-1">
                  NEXT STEPS &amp; EXECUTION ROADMAP
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Active tasks
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Deliverables in progress and milestones ready for client review.
                </p>
              </div>

              {/* Roadmap Progress Box */}
              <div className="bg-[#131131] border border-[#272352] rounded-2xl px-5 py-3.5 flex items-center justify-between gap-6 shadow-xl shrink-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-semibold">Roadmap progress</span>
                    <span className="font-bold text-white">
                      {completedTasks.length} of {totalTasks} done
                    </span>
                  </div>
                  {/* Multi-segment bar */}
                  <div className="flex items-center gap-1 w-44">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${Math.max(15, (completedTasks.length / totalTasks) * 100)}%`,
                      }}
                    />
                    <div
                      className="h-2 rounded-full bg-amber-500 transition-all flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-emerald-400" />
                      <span>Done {completedTasks.length}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-amber-400" />
                      <span>In progress {pendingTasks.length}</span>
                    </span>
                  </div>
                </div>

                <div className="text-4xl font-black text-white tracking-tight tabular-nums">
                  {roadmapPct}%
                </div>
              </div>
            </div>

            {/* 2-Column Action Plan Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[64vh] overflow-y-auto pr-1">
              {/* Left Column: In Progress & Planned */}
              <div className="bg-[#131131] border border-[#272352] rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[#231F47]">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-white text-base">
                    In progress &amp; planned · {pendingTasks.length}
                  </h3>
                </div>

                <div className="space-y-3">
                  {pendingTasks.map((t, idx) => (
                    <div
                      key={t.id}
                      className="bg-[#171438] border border-[#2B2655] rounded-xl p-4 flex items-center gap-4 hover:border-amber-500/30 transition-all"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/10 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-white truncate">{t.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>In progress</span>
                          </span>
                          {t.assignedTo && (
                            <span className="text-xs text-slate-400">· {t.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingTasks.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      All action items completed.
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Completed */}
              <div className="bg-[#131131] border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[#231F47]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-emerald-400 text-base">
                    Completed · {completedTasks.length}
                  </h3>
                </div>

                <div className="space-y-3">
                  {completedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="bg-[#171438] border border-[#2B2655] rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-white truncate">{t.title}</h4>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Done</span>
                        </span>
                      </div>
                      <span className="border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full shrink-0 tracking-wider">
                        READY FOR REVIEW
                      </span>
                    </div>
                  ))}
                  {completedTasks.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      No completed tasks in this view.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. DETAILS POPOVER / MODAL */}
      {activeDetailModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#141133] border border-white/20 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E11D74]">
                  {activeDetailModal.category || 'General'}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {activeDetailModal.activity}
                </h3>
              </div>
              <button
                onClick={() => setActiveDetailModal(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2 pr-1">
              {(activeDetailModal.subItems || []).map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs"
                >
                  <div className="font-semibold text-white">
                    {idx + 1}. {s.title}
                  </div>
                  {s.note && (
                    <div className="text-indigo-200/80 mt-1 pl-4 border-l-2 border-indigo-500/50">
                      {s.note}
                    </div>
                  )}
                  {s.createdAt && (
                    <div className="text-[10px] text-slate-400 mt-1.5">{s.createdAt}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setActiveDetailModal(null)}
                className="px-4 py-2 rounded-xl bg-[#E11D74] hover:bg-[#C91866] text-white text-xs font-bold cursor-pointer"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. BOTTOM NAVIGATION CONTROLLER FOOTER */}
      <footer className="px-8 py-4 bg-[#0D0B21] border-t border-[#211D44] flex items-center justify-between gap-4 shrink-0">
        {/* Left: Previous Slide */}
        <button
          onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
          disabled={currentSlide === 0}
          className="px-4 py-2 rounded-xl bg-[#171433] hover:bg-[#201C46] border border-[#2B2555] text-slate-300 hover:text-white text-xs font-bold transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>
            {currentSlide === 1 ? 'Overview' : currentSlide === 2 ? 'Deliverables' : 'Previous'}
          </span>
        </button>

        {/* Center: Slide indicator + Keyboard shortcut */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-400">
            <strong className="text-white font-bold">{currentSlide + 1}</strong> / 3 ·{' '}
            {currentSlide === 0
              ? 'Overview'
              : currentSlide === 1
              ? 'Work streams & deliverables'
              : 'Active tasks'}
          </span>
          <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
            ← → navigate · Esc exit
          </span>
        </div>

        {/* Right: Next Slide or End review */}
        {currentSlide < 2 ? (
          <button
            onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, 2))}
            className="bg-[#E11D74] hover:bg-[#C91866] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-[#E11D74]/25 cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <span>
              {currentSlide === 0 ? 'Next: Deliverables' : 'Next: Active tasks'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="bg-[#241328] hover:bg-[#341838] border border-pink-500/40 text-pink-200 hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            End review
          </button>
        )}
      </footer>
    </div>
  );
};
