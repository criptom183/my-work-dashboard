import React from 'react';
import { WorkItem } from '../types';

interface BrandOutputMixProps {
  works: WorkItem[];
  selectedMonth: string;
}

const PALETTE = [
  '#E11D74', // Social posts - hot pink
  '#1D1B48', // GMB posts - dark navy
  '#8B1E63', // Carousels - deep magenta
  '#F59E0B', // Reels video - amber
  '#64748B', // Viral clips - slate
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#EC4899', // Pink
];

export const BrandOutputMix: React.FC<BrandOutputMixProps> = ({
  works,
  selectedMonth,
}) => {
  const visibleWorks = works.filter((w) => (w.count || 0) > 0);
  const totalCount = visibleWorks.reduce((acc, curr) => acc + curr.count, 0);

  // Calculate percentage and arc offsets for donut chart
  let cumulativeAngle = 0;
  const radius = 38;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs mb-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Output mix</h3>
        <p className="text-xs text-slate-400">
          Share of items • {selectedMonth === 'all' ? 'All Months' : selectedMonth}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart SVG */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {totalCount === 0 ? (
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth={strokeWidth}
              />
            ) : (
              visibleWorks.map((item, idx) => {
                const fraction = item.count / totalCount;
                const strokeDasharray = `${fraction * circumference} ${circumference}`;
                const strokeDashoffset = -cumulativeAngle * circumference;
                cumulativeAngle += fraction;
                const color = PALETTE[idx % PALETTE.length];

                return (
                  <circle
                    key={item.id}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500"
                  />
                );
              })
            )}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-extrabold text-slate-900 leading-none">
              {totalCount}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5">items</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-2.5">
          {visibleWorks.map((item, idx) => {
            const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
            const color = PALETTE[idx % PALETTE.length];

            return (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-slate-700 truncate">{item.activity}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-slate-900">{item.count}</span>
                  <span className="text-slate-400 font-medium w-10 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
