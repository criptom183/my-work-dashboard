import React from 'react';
import { AlignLeft, Star, BarChart2 } from 'lucide-react';
import { DashboardData, WorkItem } from '../types';
import { computeMoMStats } from '../utils/monthHelper';

interface BrandKpiCardsProps {
  data: DashboardData;
  allWorks?: WorkItem[];
  onScrollToWorks?: () => void;
}

export const BrandKpiCards: React.FC<BrandKpiCardsProps> = ({
  data,
  allWorks,
  onScrollToWorks,
}) => {
  const works = (data.worksCompleted || []).filter((w) => (w.count || 0) > 0);
  const totalItemsDelivered = works.reduce((acc, curr) => acc + curr.count, 0);
  const totalWorkStreams = works.length;

  const selectedMonth = data.selectedMonth || 'Oct 2026';
  const availableMonths = data.availableMonths || [];
  const worksForMoM = allWorks && allWorks.length > 0 ? allWorks : data.worksCompleted;
  const momStats = computeMoMStats(worksForMoM, selectedMonth, availableMonths);

  // Categories count
  const categories = Array.from(new Set(works.map((w) => w.category).filter(Boolean)));

  // Top deliverable activity
  const topItem =
    works.length > 0
      ? works.reduce((max, curr) => (curr.count > max.count ? curr : max), works[0])
      : null;

  const topPercentage =
    totalItemsDelivered > 0 && topItem && topItem.count > 0
      ? ((topItem.count / totalItemsDelivered) * 100).toFixed(1)
      : '0';

  // Average volume per stream
  const avgPerStream =
    totalWorkStreams > 0 ? (totalItemsDelivered / totalWorkStreams).toFixed(1) : '0.0';

  const hasMoM =
    momStats.prevMonth !== null &&
    momStats.deltaCount !== null &&
    momStats.percentChange !== null;
  const prevMonthName = momStats.prevMonth || 'Sep 2026';
  const prevMonthTotal = momStats.prevTotal ?? 100;
  const isNegative = (momStats.deltaCount ?? 0) < 0;
  const deltaFormatted = Math.abs(momStats.deltaCount ?? 0);
  const percentFormatted =
    momStats.percentChange !== null && momStats.percentChange !== undefined
      ? `${momStats.percentChange >= 0 ? '+' : ''}${momStats.percentChange.toFixed(1)}%`
      : '0.0%';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* CARD 1: Dark Navy Featured Delivered Card with Sparkline */}
      <div
        onClick={onScrollToWorks}
        className="bg-[#1D1B48] text-white rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-[#E11D74]/40 transition-all min-h-[160px]"
      >
        <div>
          <p className="text-xs font-semibold text-indigo-200/80">
            Delivered in {selectedMonth === 'all' ? 'All Months' : selectedMonth}
          </p>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {totalItemsDelivered}
            </span>
            <span className="text-sm font-medium text-slate-300">items</span>
          </div>
        </div>

        {/* Sparkline curve visualization */}
        <div className="my-2 relative w-full h-11">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 180 40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparklineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="60%" stopColor="#FB7185" />
                <stop offset="100%" stopColor="#E11D74" />
              </linearGradient>
            </defs>
            {hasMoM ? (
              isNegative ? (
                <>
                  {/* Downward Curve */}
                  <path
                    d="M 10 12 C 55 12, 110 32, 160 32"
                    fill="none"
                    stroke="url(#sparklineGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="12" r="2.5" fill="#F59E0B" />
                  <circle cx="160" cy="32" r="5" fill="#E11D74" />
                  <circle cx="160" cy="32" r="2.5" fill="#FFFFFF" />
                  <text x="10" y="7" fill="#9D9BC2" fontSize="8" fontWeight="600">
                    {prevMonthName.slice(0, 3)}
                  </text>
                  <text x="150" y="24" fill="#9D9BC2" fontSize="8" fontWeight="600">
                    {selectedMonth.slice(0, 3)}
                  </text>
                </>
              ) : (
                <>
                  {/* Upward Curve */}
                  <path
                    d="M 10 30 C 55 30, 110 12, 160 12"
                    fill="none"
                    stroke="url(#sparklineGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="30" r="2.5" fill="#F59E0B" />
                  <circle cx="160" cy="12" r="5" fill="#E11D74" />
                  <circle cx="160" cy="12" r="2.5" fill="#FFFFFF" />
                  <text x="10" y="38" fill="#9D9BC2" fontSize="8" fontWeight="600">
                    {prevMonthName.slice(0, 3)} ({prevMonthTotal})
                  </text>
                  <text x="140" y="7" fill="#E11D74" fontSize="8" fontWeight="bold">
                    {selectedMonth.slice(0, 3)} ({totalItemsDelivered})
                  </text>
                </>
              )
            ) : (
              <>
                <path
                  d="M 10 20 L 160 20"
                  fill="none"
                  stroke="#433F85"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <circle cx="160" cy="20" r="4" fill="#E11D74" />
                <circle cx="160" cy="20" r="2" fill="#FFFFFF" />
                <text x="12" y="14" fill="#9D9BC2" fontSize="8" fontWeight="600">
                  {selectedMonth === 'all' ? 'Cumulative Volume' : `${selectedMonth} Baseline`}
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Bottom MoM Comparison Pill */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/10">
            {hasMoM ? (
              <>
                <span className={isNegative ? 'text-rose-300' : 'text-emerald-300'}>
                  {isNegative ? '↓' : '↑'} {deltaFormatted} • {percentFormatted}
                </span>
                <span className="text-slate-300">vs {prevMonthName} ({prevMonthTotal})</span>
              </>
            ) : (
              <span className="text-slate-200">
                {selectedMonth === 'all'
                  ? 'Cumulative total across periods'
                  : `Base period (${totalItemsDelivered} items)`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: Active work streams */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Active work streams</span>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <AlignLeft className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4 mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {totalWorkStreams}
            </span>
            <span className="text-sm font-medium text-slate-500">streams</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-medium">
          {categories.length} functional categories
        </p>
      </div>

      {/* CARD 3: Leading deliverable */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Leading deliverable</span>
          <div className="w-8 h-8 rounded-lg bg-pink-50 text-[#E11D74] flex items-center justify-center">
            <Star className="w-4 h-4 fill-[#E11D74]/20 text-[#E11D74]" />
          </div>
        </div>

        <div className="mt-4 mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {topItem ? topItem.count : 0}
            </span>
            <span className="text-sm font-bold text-slate-700 truncate max-w-[130px]">
              {topItem ? topItem.activity : 'None'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-medium">
          {topPercentage}% of monthly volume
        </p>
      </div>

      {/* CARD 4: Avg. volume / stream */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Avg. volume / stream</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4 mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {avgPerStream}
            </span>
            <span className="text-sm font-medium text-slate-500">items / stream</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-medium">
          Delivery intensity in {selectedMonth === 'all' ? 'All Months' : selectedMonth}
        </p>
      </div>
    </div>
  );
};
