import React from 'react';
import { Layers, CheckCircle2, TrendingUp, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { DashboardData } from '../types';
import { computeMoMStats } from '../utils/monthHelper';

interface KpiCardsProps {
  data: DashboardData;
  onScrollToSection?: (sectionId: string) => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  data,
  onScrollToSection,
}) => {
  // Only consider works whose count is more than 0 (hide others)
  const works = (data.worksCompleted || []).filter((w) => (w.count || 0) > 0);
  const totalItemsDelivered = works.reduce((acc, curr) => acc + curr.count, 0);
  const totalWorkStreams = works.length;

  const selectedMonth = data.selectedMonth || 'Current Month';
  const availableMonths = data.availableMonths || [];
  const momStats = computeMoMStats(data.worksCompleted, selectedMonth, availableMonths);


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
    totalWorkStreams > 0 ? (totalItemsDelivered / totalWorkStreams).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Items Delivered */}
      <div
        onClick={() => onScrollToSection?.('works-section')}
        className="bg-white rounded-xl border border-slate-200/80 border-t-4 border-t-emerald-500 p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 tracking-wide truncate">
            {selectedMonth === 'all'
              ? 'Total items delivered (Cumulative)'
              : `Delivered in ${selectedMonth}`}
          </p>
          <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {totalItemsDelivered}
          </span>
          <span className="text-xs font-medium text-slate-500">items</span>
          {selectedMonth === 'all' ? (
            <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-100">
              Total Datas
            </span>
          ) : momStats.deltaCount !== null ? (
            <span
              className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
                momStats.deltaCount >= 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
              title={`Change compared to ${momStats.prevMonth}`}
            >
              {momStats.deltaCount >= 0 ? '+' : ''}
              {momStats.deltaCount} MoM
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Across {totalWorkStreams} work streams
          {selectedMonth === 'all' ? (
            <span className="text-slate-400 ml-1">
              ({availableMonths.length} recorded months)
            </span>
          ) : momStats.prevMonth ? (
            <span className="text-slate-400 ml-1">vs {momStats.prevMonth}</span>
          ) : null}
        </p>
      </div>

      {/* Card 2: Active Work Streams */}
      <div
        onClick={() => onScrollToSection?.('works-section')}
        className="bg-white rounded-xl border border-slate-200/80 border-t-4 border-t-teal-500 p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 tracking-wide">
            Active work streams
          </p>
          <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {totalWorkStreams}
          </span>
          <span className="text-xs font-medium text-slate-500">streams</span>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">
          {categories.length} functional categories
        </p>
      </div>

      {/* Card 3: Top Deliverable Activity */}
      <div
        onClick={() => onScrollToSection?.('works-section')}
        className="bg-white rounded-xl border border-slate-200/80 border-t-4 border-t-blue-500 p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 tracking-wide">
            Leading deliverable
          </p>
          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate max-w-[170px]"
            title={topItem?.activity || 'None'}
          >
            {topItem ? `${topItem.count}` : '—'}
          </span>
          <span className="text-xs font-medium text-slate-500">
            ({topPercentage}% volume)
          </span>
        </div>
        <p
          className="mt-2 text-xs font-medium text-slate-500 truncate"
          title={topItem?.activity || 'None'}
        >
          {topItem ? topItem.activity : 'No deliverables recorded'}
        </p>
      </div>

      {/* Card 4: Average Volume Per Stream */}
      <div
        onClick={() => onScrollToSection?.('works-section')}
        className="bg-white rounded-xl border border-slate-200/80 border-t-4 border-t-indigo-500 p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 tracking-wide">
            Avg. volume / stream
          </p>
          <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PieChart className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {avgPerStream}
          </span>
          <span className="text-xs font-medium text-slate-500">items / stream</span>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Delivery intensity in {selectedMonth === 'all' ? 'All Months' : selectedMonth}
        </p>
      </div>
    </div>
  );
};
