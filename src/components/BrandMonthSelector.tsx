import React from 'react';
import { WorkItem } from '../types';
import { isSameMonth } from '../utils/monthHelper';

interface BrandMonthSelectorProps {
  availableMonths: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  allWorks: WorkItem[];
}

export const BrandMonthSelector: React.FC<BrandMonthSelectorProps> = ({
  availableMonths,
  selectedMonth,
  onSelectMonth,
  allWorks,
}) => {
  // Compute monthly totals
  const getMonthTotal = (m: string) => {
    if (m === 'all') {
      return allWorks.reduce((acc, curr) => {
        if (curr.monthlyBreakdown && Object.keys(curr.monthlyBreakdown).length > 0) {
          return acc + Object.values(curr.monthlyBreakdown).reduce((a: number, b) => a + (Number(b) || 0), 0);
        }
        return acc + (curr.count || 0);
      }, 0);
    }
    return allWorks.reduce((acc, curr) => {
      if (curr.monthlyBreakdown) {
        for (const [key, count] of Object.entries(curr.monthlyBreakdown)) {
          if (isSameMonth(key, m)) {
            return acc + (Number(count) || 0);
          }
        }
      }
      if (isSameMonth(curr.month, m)) {
        return acc + (curr.count || 0);
      }
      return acc;
    }, 0);
  };

  const months = availableMonths.length > 0 ? availableMonths : ['Sep 2026', 'Oct 2026'];
  const totalAll = getMonthTotal('all');

  return (
    <div className="inline-flex items-center p-1 rounded-full bg-white border border-slate-200/90 shadow-2xs">
      {months.map((m) => {
        const isSelected = selectedMonth === m;
        const count = getMonthTotal(m);

        return (
          <button
            key={m}
            onClick={() => onSelectMonth(m)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#1D1B48] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>{m}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                isSelected
                  ? 'bg-[#FFC83B] text-[#1D1B48]'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}

      {/* All Months Option */}
      <button
        onClick={() => onSelectMonth('all')}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
          selectedMonth === 'all'
            ? 'bg-[#1D1B48] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <span>All months</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            selectedMonth === 'all'
              ? 'bg-[#FFC83B] text-[#1D1B48]'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {totalAll}
        </span>
      </button>
    </div>
  );
};
