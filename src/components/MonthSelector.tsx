import React from 'react';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronLeft,
  ChevronRight,
  History,
  Sigma,
  RotateCcw,
} from 'lucide-react';
import { WorkItem } from '../types';
import { computeMoMStats, getWorksForSelectedMonth, sortMonthsChronologically } from '../utils/monthHelper';

interface MonthSelectorProps {
  availableMonths: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  allWorks: WorkItem[];
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  availableMonths,
  selectedMonth,
  onSelectMonth,
  allWorks,
}) => {
  const sortedMonths = sortMonthsChronologically(availableMonths.length > 0 ? availableMonths : ['Oct 2026']);
  const latestMonth = sortedMonths[sortedMonths.length - 1];
  const previousMonths = sortedMonths.slice(0, sortedMonths.length - 1);
  const isViewingTotal = selectedMonth === 'all';
  const isViewingPrevious = !isViewingTotal && selectedMonth !== latestMonth && sortedMonths.includes(selectedMonth);

  const momStats = computeMoMStats(allWorks, selectedMonth, sortedMonths);

  // Calculate cumulative grand total count across all months
  const allConsolidatedWorks = getWorksForSelectedMonth(allWorks, 'all', sortedMonths);
  const grandTotalCount = allConsolidatedWorks.reduce((sum, w) => sum + w.count, 0);

  // Current selected view total
  const currentWorks = getWorksForSelectedMonth(allWorks, selectedMonth, sortedMonths);
  const currentTotal = currentWorks.reduce((sum, w) => sum + w.count, 0);

  // Month navigation: previous and next
  const currentIndex = sortedMonths.indexOf(selectedMonth);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < sortedMonths.length - 1;

  const handlePrevMonth = () => {
    if (isViewingTotal) {
      // Go to latest month first
      onSelectMonth(latestMonth);
    } else if (canGoPrev) {
      onSelectMonth(sortedMonths[currentIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      onSelectMonth(sortedMonths[currentIndex + 1]);
    }
  };

  return (
    <div className="mb-6 bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
      {/* Top row: Status header, Scope toggle, and Quick action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shrink-0">
            {isViewingTotal ? (
              <Sigma className="w-5 h-5 text-teal-700" />
            ) : isViewingPrevious ? (
              <History className="w-5 h-5 text-amber-700" />
            ) : (
              <Calendar className="w-5 h-5 text-teal-700" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Timeline & Reporting Period
              </span>

              {isViewingTotal ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-white shadow-2xs">
                  Total Datas View (All Months)
                </span>
              ) : isViewingPrevious ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                  <History className="w-3 h-3 text-amber-700" />
                  Previous Month Archive
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-900 border border-teal-200">
                  Latest Month Active
                </span>
              )}
            </div>

            <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span>
                {isViewingTotal
                  ? `Cumulative Total (${sortedMonths.length} Months Combined)`
                  : selectedMonth}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {currentTotal} items
              </span>
            </p>
          </div>
        </div>

        {/* Right side controls: Quick Total toggle & Step navigation */}
        <div className="flex items-center flex-wrap gap-2.5 self-start lg:self-center">
          {/* Previous / Next Month Navigation Buttons */}
          <div className="inline-flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={handlePrevMonth}
              disabled={!canGoPrev && !isViewingTotal}
              title={
                canGoPrev
                  ? `View previous month: ${sortedMonths[currentIndex - 1]}`
                  : 'No earlier month'
              }
              className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-2 text-slate-600 select-none">
              {isViewingTotal ? 'History' : `${currentIndex + 1} of ${sortedMonths.length}`}
            </span>
            <button
              onClick={handleNextMonth}
              disabled={!canGoNext}
              title={
                canGoNext
                  ? `View next month: ${sortedMonths[currentIndex + 1]}`
                  : 'Already at latest month'
              }
              className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle between Total Datas and Latest Month */}
          {isViewingTotal ? (
            <button
              onClick={() => onSelectMonth(latestMonth)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Current Month ({latestMonth})</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectMonth('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-98"
              title="See total cumulative deliverables across all months"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>See Total Datas ({grandTotalCount})</span>
            </button>
          )}

          {/* MoM delta pill when viewing a single month */}
          {!isViewingTotal && momStats.prevMonth && momStats.deltaCount !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              {momStats.deltaCount >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>
                <strong>
                  {momStats.deltaCount >= 0 ? `+${momStats.deltaCount}` : momStats.deltaCount}
                </strong>{' '}
                vs {momStats.prevMonth}
                {momStats.percentChange !== null && (
                  <span className="ml-1 opacity-80">
                    ({momStats.percentChange >= 0 ? '+' : ''}
                    {momStats.percentChange.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Clear Month Tabs with Previous Months & Total Data options */}
      <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {/* Latest Month Button */}
          {latestMonth && (
            <button
              onClick={() => onSelectMonth(latestMonth)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                selectedMonth === latestMonth
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100'
              }`}
            >
              <span>{latestMonth}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-900/20 text-current">
                Current
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  selectedMonth === latestMonth
                    ? 'bg-teal-800 text-teal-100'
                    : 'bg-white text-teal-800 border border-teal-200'
                }`}
              >
                {getWorksForSelectedMonth(allWorks, latestMonth, sortedMonths).reduce((s, w) => s + w.count, 0)}
              </span>
            </button>
          )}

          {/* Previous Months Section */}
          {previousMonths.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pl-1 sm:pl-2 sm:border-l sm:border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
                Previous:
              </span>
              {previousMonths.map((m) => {
                const isSelected = selectedMonth === m;
                const mWorks = getWorksForSelectedMonth(allWorks, m, sortedMonths);
                const mTotal = mWorks.reduce((s, w) => s + w.count, 0);

                return (
                  <button
                    key={m}
                    onClick={() => onSelectMonth(m)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <span>{m}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                        isSelected
                          ? 'bg-amber-800/80 text-amber-100'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {mTotal}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Total Datas Button */}
          <div className="pl-1 sm:pl-2 sm:border-l sm:border-slate-200">
            <button
              onClick={() => onSelectMonth('all')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                isViewingTotal
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>Total Datas (All Months)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  isViewingTotal
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {grandTotalCount}
              </span>
            </button>
          </div>
        </div>

        {/* Context caption */}
        <p className="text-[11px] text-slate-400 sm:text-right">
          {isViewingTotal
            ? 'Viewing consolidated totals across all recorded months'
            : isViewingPrevious
            ? `Viewing historical archive for ${selectedMonth}`
            : `Viewing active deliverables for ${selectedMonth}`}
        </p>
      </div>
    </div>
  );
};
