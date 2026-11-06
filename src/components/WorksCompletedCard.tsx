import React, { useState } from 'react';
import {
  CheckCircle2,
  BarChart3,
  Table as TableIcon,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileText,
  Tag,
  Calendar,
} from 'lucide-react';
import { WorkItem } from '../types';
import { isSameMonth } from '../utils/monthHelper';

interface WorksCompletedCardProps {
  works: WorkItem[];
  availableMonths?: string[];
  selectedMonth?: string;
  allWorks?: WorkItem[];
  onUpdateWorkItem?: (id: string, updates: Partial<WorkItem>) => void;
  onUpdateWorkCount?: (id: string, newCount: number) => void;
  onAddWorkItem: (activity: string, count: number, category: string, notes?: string) => void;
  onDeleteWorkItem: (id: string) => void;
}

const MONTH_COLORS = [
  '#94A3B8', // Slate 400
  '#2DD4BF', // Teal 400
  '#0D9488', // Teal 600
  '#0F766E', // Teal 700
  '#042F2E', // Teal 950
];

export const WorksCompletedCard: React.FC<WorksCompletedCardProps> = ({
  works,
  availableMonths = [],
  selectedMonth = 'Current Month',
  allWorks = [],
  onUpdateWorkItem,
  onUpdateWorkCount,
  onAddWorkItem,
  onDeleteWorkItem,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'trend'>('chart');
  const [isAdding, setIsAdding] = useState(false);
  const [newActivity, setNewActivity] = useState('');
  const [newCount, setNewCount] = useState('1');
  const [newCategory, setNewCategory] = useState('Social Media');
  const [newNotes, setNewNotes] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCountVal, setEditCountVal] = useState('');
  const [editNotesVal, setEditNotesVal] = useState('');
  const [editActivityVal, setEditActivityVal] = useState('');
  const [isDetailEditOpen, setIsDetailEditOpen] = useState(false);

  const hasMultipleMonths = availableMonths.length > 1;

  // 1. Display only works whose count is more than 0. Hide others.
  const visibleWorks = works.filter((w) => (w.count || 0) > 0);
  const hiddenZeroCount = works.length - visibleWorks.length;

  // Total items delivered
  const totalCount = visibleWorks.reduce((sum, w) => sum + w.count, 0);

  // Dynamic top deliverable
  const topItem =
    visibleWorks.length > 0
      ? visibleWorks.reduce((max, curr) => (curr.count > max.count ? curr : max), visibleWorks[0])
      : null;
  const topPercentage =
    totalCount > 0 && topItem && topItem.count > 0
      ? ((topItem.count / totalCount) * 100).toFixed(1)
      : '0.0';

  // Maximum value for axis scaling
  const maxItemCount = Math.max(...visibleWorks.map((w) => w.count), 0);
  const axisMax = Math.max(24, Math.ceil((maxItemCount + 2) / 6) * 6);
  const axisSteps = [0, axisMax * 0.25, axisMax * 0.5, axisMax * 0.75, axisMax];

  const getCountForMonth = (item: WorkItem, month: string): number => {
    if (item.monthlyBreakdown) {
      for (const [mKey, mVal] of Object.entries(item.monthlyBreakdown)) {
        if (isSameMonth(mKey, month)) return Number(mVal || 0);
      }
    }
    if (isSameMonth(item.month, month)) return item.count;
    return 0;
  };

  // Maximum value for trend comparison
  let trendMax = 24;
  if (hasMultipleMonths) {
    for (const w of visibleWorks) {
      for (const m of availableMonths) {
        const num = getCountForMonth(w, m);
        if (num > trendMax) trendMax = num;
      }
    }
  }
  const trendAxisMax = Math.max(24, Math.ceil((trendMax + 2) / 6) * 6);
  const trendAxisSteps = [0, trendAxisMax * 0.25, trendAxisMax * 0.5, trendAxisMax * 0.75, trendAxisMax];


  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.trim()) return;
    const count = parseInt(newCount, 10) || 0;
    onAddWorkItem(newActivity.trim(), count, newCategory, newNotes.trim() || undefined);
    setNewActivity('');
    setNewCount('1');
    setNewNotes('');
    setIsAdding(false);
  };

  const startQuickEditCount = (item: WorkItem) => {
    setEditingId(item.id);
    setEditCountVal(String(item.count));
    setIsDetailEditOpen(false);
  };

  const startFullEdit = (item: WorkItem) => {
    setEditingId(item.id);
    setEditCountVal(String(item.count));
    setEditNotesVal(item.notes || '');
    setEditActivityVal(item.activity);
    setIsDetailEditOpen(true);
  };

  const saveEdit = (id: string) => {
    const val = parseInt(editCountVal, 10);
    const count = isNaN(val) ? 0 : Math.max(0, val);

    if (onUpdateWorkItem) {
      onUpdateWorkItem(id, {
        count,
        activity: editActivityVal.trim() || undefined,
        notes: editNotesVal.trim() || undefined,
      });
    } else if (onUpdateWorkCount) {
      onUpdateWorkCount(id, count);
    }
    setEditingId(null);
    setIsDetailEditOpen(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsDetailEditOpen(false);
  };

  return (
    <div
      id="works-section"
      className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
    >
      <div>
        {/* Header with Title and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/50">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 leading-none">
                  Works completed
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/60">
                  {selectedMonth === 'all' ? 'All Months' : selectedMonth}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {visibleWorks.length} deliverables (count &gt; 0)
                </span>
                {hiddenZeroCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-normal text-slate-400 bg-slate-50 border border-slate-200/60"
                    title={`${hiddenZeroCount} items with 0 count are hidden`}
                  >
                    {hiddenZeroCount} zero-count hidden
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Volume delivered per activity (only showing works with count &gt; 0)
              </p>

            </div>
          </div>

          {/* Controls: Chart / Trend / Table toggle & Add button */}
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'chart'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Chart</span>
              </button>

              {hasMultipleMonths && (
                <button
                  type="button"
                  onClick={() => setViewMode('trend')}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'trend'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="View month-by-month progression bars"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                  <span>Monthly Trend</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
              title="Add deliverable item"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </div>

        {/* Add Deliverable Form */}
        {isAdding && (
          <form
            onSubmit={handleAddSubmit}
            className="mb-5 p-3.5 bg-slate-50/90 rounded-lg border border-slate-200 text-xs flex flex-col gap-2.5 transition-all"
          >
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Activity name (e.g. Website banner images, Reels Video)"
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none"
                autoFocus
              />
              <input
                type="number"
                placeholder="Count"
                min="0"
                value={newCount}
                onChange={(e) => setNewCount(e.target.value)}
                className="w-16 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none text-center"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none text-slate-700"
              >
                <option value="Design & Web">Design & Web</option>
                <option value="Social Media">Social Media</option>
                <option value="Branding & Video">Branding & Video</option>
                <option value="Video Production">Video Production</option>
                <option value="Content">Content</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Details / Notes (e.g. specifications, campaign context, Anwar sir instructions)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none text-slate-700"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-teal-700 text-white rounded-md font-medium hover:bg-teal-800 transition-colors shadow-2xs cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Detailed Edit Modal / Bar if editing item */}
        {editingId && isDetailEditOpen && (
          <div className="mb-4 p-3 bg-teal-50/80 rounded-lg border border-teal-200 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-teal-900 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-teal-700" />
                Edit Deliverable Details
              </span>
              <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-8">
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Activity Name
                </label>
                <input
                  type="text"
                  value={editActivityVal}
                  onChange={(e) => setEditActivityVal(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Delivered Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={editCountVal}
                  onChange={(e) => setEditCountVal(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none font-semibold"
                />
              </div>
              <div className="sm:col-span-12">
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Details & Notes
                </label>
                <input
                  type="text"
                  placeholder="Add specific instructions, notes, or deliverable context"
                  value={editNotesVal}
                  onChange={(e) => setEditNotesVal(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEdit(editingId)}
                className="px-3 py-1 bg-teal-700 text-white rounded font-medium hover:bg-teal-800 transition-colors shadow-2xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* VIEW 1: SINGLE-MONTH BAR CHART */}
        {viewMode === 'chart' && (
          <div className="relative pt-2 pb-4">
            {visibleWorks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No deliverables with count &gt; 0 recorded for {selectedMonth}.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleWorks.map((item) => {
                  const percentage = axisMax > 0 ? (item.count / axisMax) * 100 : 0;


                return (
                  <div
                    key={item.id}
                    className="group relative flex items-start text-xs sm:text-sm pt-0.5"
                  >
                    {/* Left label: Activity title AND Details/Notes prominently visible */}
                    <div className="w-[170px] sm:w-[220px] md:w-[250px] pr-4 text-right leading-snug">
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span
                          className="text-slate-800 font-medium hover:text-teal-700 cursor-pointer transition-colors"
                          onClick={() => startFullEdit(item)}
                          title={`${item.activity} - Click to edit details`}
                        >
                          {item.activity}
                        </span>
                      </div>

                      {/* Details / Notes: Clearly rendered */}
                      {item.notes ? (
                        <div
                          onClick={() => startFullEdit(item)}
                          className="mt-0.5 text-[11px] text-slate-500 font-normal leading-tight break-words cursor-pointer hover:text-teal-800 transition-colors flex items-center justify-end gap-1"
                          title={`Note: ${item.notes}`}
                        >
                          <span className="line-clamp-2 text-slate-500 italic">
                            {item.notes}
                          </span>
                        </div>
                      ) : (
                        <div
                          onClick={() => startFullEdit(item)}
                          className="mt-0.5 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-teal-600"
                        >
                          + Add details
                        </div>
                      )}
                    </div>

                    {/* Bar track with background gridlines */}
                    <div className="flex-1 relative h-7 flex items-center">
                      {/* Grid background reference lines */}
                      <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
                        {axisSteps.map((_, idx) => (
                          <div key={idx} className="h-full border-r border-slate-300" />
                        ))}
                      </div>

                      {/* Teal Bar */}
                      <div className="w-full h-full flex items-center relative z-10">
                        {item.count > 0 ? (
                          <div
                            className="h-4 sm:h-5 bg-[#0D9488] hover:bg-[#0F766E] rounded-r transition-all duration-300 flex items-center justify-end px-2 group cursor-pointer shadow-2xs"
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                            onClick={() => startQuickEditCount(item)}
                            title={`${item.activity}: ${item.count} items (${totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0}% of total) - Click to edit count`}
                          >
                            {percentage > 12 && (
                              <span className="text-[11px] font-semibold text-white tracking-wide">
                                {item.count}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            className="w-2 h-4 sm:h-5 bg-slate-200 rounded-r cursor-pointer"
                            onClick={() => startQuickEditCount(item)}
                            title="0 delivered - click to edit"
                          />
                        )}

                        {/* Numeric value label outside bar if bar is small or 0 */}
                        {(percentage <= 12 || item.count === 0) && (
                          <span
                            className="ml-2 text-xs font-semibold text-slate-700 cursor-pointer hover:text-teal-700"
                            onClick={() => startQuickEditCount(item)}
                          >
                            {item.count}
                          </span>
                        )}
                      </div>

                      {/* Quick action buttons on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex items-center gap-1">
                        <button
                          onClick={() => startFullEdit(item)}
                          className="p-1 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded"
                          title="Edit deliverable & details"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteWorkItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete deliverable"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* Bottom X-Axis */}
            <div className="mt-4 pt-2 border-t border-slate-200 flex text-slate-400 text-[11px] sm:text-xs">
              <div className="w-[170px] sm:w-[220px] md:w-[250px] pr-4 text-right"></div>
              <div className="flex-1 flex justify-between px-0.5">
                {axisSteps.map((step, idx) => (
                  <span key={idx} className="font-mono font-medium">
                    {Math.round(step)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MONTHLY TREND / COMPARISON VIEW */}
        {viewMode === 'trend' && hasMultipleMonths && (
          <div className="relative pt-2 pb-4">
            {/* Trend Legend */}
            <div className="flex flex-wrap items-center justify-end gap-3 mb-4 text-xs font-medium text-slate-600">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Months:
              </span>
              {availableMonths.map((m, idx) => {
                const color = MONTH_COLORS[idx % MONTH_COLORS.length];
                return (
                  <div key={m} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-xs shadow-2xs"
                      style={{ backgroundColor: color }}
                    />
                    <span>{m}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              {visibleWorks.map((item) => {
                return (

                  <div
                    key={item.id}
                    className="group relative flex items-start text-xs sm:text-sm pt-1"
                  >
                    {/* Left label: Activity title */}
                    <div className="w-[170px] sm:w-[220px] md:w-[250px] pr-4 text-right leading-snug">
                      <div className="font-semibold text-slate-800">
                        {item.activity}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.category}
                      </div>
                    </div>

                    {/* Bars container */}
                    <div className="flex-1 space-y-1">
                      {availableMonths.map((m, idx) => {
                        const count = getCountForMonth(item, m);
                        const pct = trendAxisMax > 0 ? (count / trendAxisMax) * 100 : 0;
                        const color = MONTH_COLORS[idx % MONTH_COLORS.length];

                        return (
                          <div key={m} className="flex items-center gap-2 h-4 text-[10px]">
                            <span className="w-14 text-right text-slate-400 font-mono shrink-0">
                              {m}
                            </span>
                            <div className="flex-1 relative h-3 bg-slate-50 rounded-xs flex items-center">
                              {count > 0 ? (
                                <div
                                  className="h-full rounded-r transition-all duration-300 flex items-center justify-end px-1"
                                  style={{
                                    width: `${Math.max(pct, 2)}%`,
                                    backgroundColor: color,
                                  }}
                                  title={`${item.activity} in ${m}: ${count} items`}
                                >
                                  {pct > 15 && (
                                    <span className="text-[9px] font-bold text-white leading-none">
                                      {count}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="w-1.5 h-full bg-slate-200 rounded-r" />
                              )}
                              {(pct <= 15 || count === 0) && (
                                <span className="ml-1 text-[10px] font-semibold text-slate-600">
                                  {count}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom X-Axis for Trend */}
            <div className="mt-4 pt-2 border-t border-slate-200 flex text-slate-400 text-[11px] sm:text-xs">
              <div className="w-[170px] sm:w-[220px] md:w-[250px] pr-4 text-right"></div>
              <div className="flex-1 flex justify-between px-0.5">
                {trendAxisSteps.map((step, idx) => (
                  <span key={idx} className="font-mono font-medium">
                    {Math.round(step)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Category</th>
                  {hasMultipleMonths ? (
                    <>
                      {availableMonths.map((m) => (
                        <th
                          key={m}
                          className={`py-2.5 px-3 text-right ${
                            m === selectedMonth ? 'bg-teal-50 text-teal-900 font-bold' : ''
                          }`}
                        >
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right bg-slate-100 font-bold text-slate-800">
                        Total
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-3 text-right">Volume</th>
                      <th className="py-2.5 px-3 text-right">% Share</th>
                    </>
                  )}
                  <th className="py-2.5 px-3">Details / Notes</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visibleWorks.map((item) => {
                  const itemTotal = item.monthlyBreakdown

                    ? Object.values(item.monthlyBreakdown).reduce<number>((s, v) => s + (Number(v) || 0), 0)
                    : item.count;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.activity}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/50">
                          {item.category}
                        </span>
                      </td>

                      {hasMultipleMonths ? (
                        <>
                          {availableMonths.map((m) => {
                            const val = getCountForMonth(item, m);
                            return (
                              <td
                                key={m}
                                className={`py-2.5 px-3 text-right font-medium ${
                                  isSameMonth(m, selectedMonth)
                                    ? 'bg-teal-50/60 font-bold text-teal-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50/50">
                            {itemTotal}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {item.count}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 font-medium">
                            {totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : 0}%
                          </td>
                        </>
                      )}

                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                        {item.notes ? (
                          <span
                            onClick={() => startFullEdit(item)}
                            className="cursor-pointer hover:text-teal-700 hover:underline leading-relaxed block"
                            title="Click to edit details"
                          >
                            {item.notes}
                          </span>
                        ) : (
                          <button
                            onClick={() => startFullEdit(item)}
                            className="text-slate-400 hover:text-teal-600 italic text-[11px] cursor-pointer"
                          >
                            + Add details
                          </button>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => startFullEdit(item)}
                            className="p-1 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100 cursor-pointer"
                            title="Edit activity & details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteWorkItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-900 text-xs">
                <tr>
                  <td className="py-2.5 px-3 text-slate-900 font-extrabold">
                    Total Delivered
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-medium">
                    All Categories
                  </td>

                  {hasMultipleMonths ? (
                    <>
                      {availableMonths.map((m) => {
                        const mSum = visibleWorks.reduce((sum, item) => sum + getCountForMonth(item, m), 0);
                        return (
                          <td
                            key={m}
                            className={`py-2.5 px-3 text-right ${
                              isSameMonth(m, selectedMonth)
                                ? 'bg-teal-100/80 text-teal-950 font-extrabold'
                                : 'text-slate-900 font-bold'
                            }`}
                          >
                            {mSum}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right bg-slate-200/90 font-black text-slate-950">
                        {visibleWorks.reduce((sum, item) => {
                          const itemTotal = item.monthlyBreakdown
                            ? Object.values(item.monthlyBreakdown).reduce<number>(
                                (s, v) => s + (Number(v) || 0),
                                0
                              )
                            : item.count;
                          return sum + itemTotal;
                        }, 0)}
                      </td>
                    </>
                  ) : (

                    <>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-950">
                        {totalCount}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        100%
                      </td>
                    </>
                  )}

                  <td className="py-2.5 px-3 text-slate-500 font-normal italic text-[11px]">
                    Summary of recorded deliverables
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic Summary Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">
          Total Deliverables ({selectedMonth === 'all' ? 'All Months' : selectedMonth}):{' '}
          <span className="font-bold text-teal-700">{totalCount} items</span> across{' '}
          {works.length} work streams
        </span>
        {topItem && topItem.count > 0 && (
          <span className="text-slate-600">
            Top output:{' '}
            <strong className="text-slate-900">{topItem.activity}</strong> ({topItem.count} delivered,{' '}
            {topPercentage}% of volume)
          </span>
        )}
      </div>
    </div>
  );
};
