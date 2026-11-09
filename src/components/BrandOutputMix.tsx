import React from 'react';
import { WorkItem } from '../types';

interface BrandOutputMixProps {
  works: WorkItem[];
  selectedMonth: string;
  outputMixNote?: string;
  onUpdateOutputMixNote?: (note: string) => void;
  onUpdateWorkItem?: (id: string, updates: Partial<WorkItem>) => void;
  isViewOnly?: boolean;
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
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs mb-6 overflow-hidden w-full">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Output mix</h3>
        <p className="text-xs text-slate-400">
          Share of items • {selectedMonth === 'all' ? 'All Months' : selectedMonth}
        </p>
      </div>

      {/* Main Visual: Donut chart and Legend list with robust responsive containment */}
      <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center sm:items-start lg:items-center xl:items-start gap-4 sm:gap-6 min-w-0">
        {/* Donut Chart SVG */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center mx-auto sm:mx-0 lg:mx-auto xl:mx-0">
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
            <span className="text-2xl font-extrabold text-slate-900 leading-none tabular-nums">
              {totalCount}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5">items</span>
          </div>
        </div>

        {/* Legend / Work List with max-height and custom scroll so it never pushes out of container */}
        <div className="flex-1 w-full min-w-0 max-h-[360px] overflow-y-auto pr-1 space-y-2">
          {visibleWorks.map((item, idx) => {
            const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
            const color = PALETTE[idx % PALETTE.length];

            return (
              <div key={item.id} className="min-w-0">
                <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-slate-700 truncate" title={item.activity}>
                      {item.activity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                    <span className="font-bold text-slate-900 min-w-[18px] text-right">{item.count}</span>
                    <span className="text-slate-400 font-medium min-w-[38px] text-right">{pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
