import React, { useState } from 'react';
import {
  MessageSquare,
  MapPin,
  Layers,
  Video,
  Zap,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { WorkItem } from '../types';
import { isSameMonth } from '../utils/monthHelper';

interface BrandWorksCompletedProps {
  works: WorkItem[];
  availableMonths?: string[];
  selectedMonth?: string;
  allWorks?: WorkItem[];
  onAddWorkItem: (activity: string, count: number, category: string, notes?: string) => void;
  onUpdateWorkItem?: (id: string, updates: Partial<WorkItem>) => void;
  onDeleteWorkItem?: (id: string) => void;
}

// Map activity names to appropriate icons and bar colors
function getActivityIcon(activityName: string) {
  const lower = activityName.toLowerCase();
  if (lower.includes('social')) {
    return {
      icon: <MessageSquare className="w-4 h-4 text-[#E11D74]" />,
      bg: 'bg-pink-50',
      barColor: '#E11D74',
    };
  }
  if (lower.includes('gmb') || lower.includes('google')) {
    return {
      icon: <MapPin className="w-4 h-4 text-[#1D1B48]" />,
      bg: 'bg-indigo-50',
      barColor: '#1D1B48',
    };
  }
  if (lower.includes('carousel') || lower.includes('corousal')) {
    return {
      icon: <Layers className="w-4 h-4 text-[#2E2A72]" />,
      bg: 'bg-indigo-50',
      barColor: '#2E2A72',
    };
  }
  if (lower.includes('reel') || lower.includes('video')) {
    return {
      icon: <Video className="w-4 h-4 text-[#3F3D8D]" />,
      bg: 'bg-indigo-50',
      barColor: '#3F3D8D',
    };
  }
  if (lower.includes('viral') || lower.includes('clip')) {
    return {
      icon: <Zap className="w-4 h-4 text-[#524F9E]" />,
      bg: 'bg-indigo-50',
      barColor: '#524F9E',
    };
  }
  return {
    icon: <FileText className="w-4 h-4 text-slate-600" />,
    bg: 'bg-slate-100',
    barColor: '#64748B',
  };
}

export const BrandWorksCompleted: React.FC<BrandWorksCompletedProps> = ({
  works,
  availableMonths = [],
  selectedMonth = 'Oct 2026',
  allWorks = [],
  onAddWorkItem,
  onUpdateWorkItem,
  onDeleteWorkItem,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'trend' | 'table'>('chart');
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newActivity, setNewActivity] = useState('');
  const [newCount, setNewCount] = useState('1');
  const [newCategory, setNewCategory] = useState('Social Media');
  const [newNotes, setNewNotes] = useState('');

  // Editing modal
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [editCount, setEditCount] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // Only consider items with count > 0
  const visibleWorks = works.filter((w) => (w.count || 0) > 0);
  const totalCount = visibleWorks.reduce((acc, curr) => acc + curr.count, 0);

  // Top deliverable activity
  const topItem =
    visibleWorks.length > 0
      ? visibleWorks.reduce((max, curr) => (curr.count > max.count ? curr : max), visibleWorks[0])
      : null;

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.trim()) return;
    onAddWorkItem(newActivity.trim(), parseInt(newCount, 10) || 1, newCategory, newNotes.trim() || undefined);
    setNewActivity('');
    setNewCount('1');
    setNewNotes('');
    setIsAddingOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-2xs">
      {/* Header with View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Works completed</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Items delivered per activity • {selectedMonth === 'all' ? 'All Months' : selectedMonth}
          </p>
        </div>

        {/* View mode segmented switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-slate-100 border border-slate-200/60 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              viewMode === 'chart'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('trend')}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              viewMode === 'trend'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Monthly trend
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Main View Mode Content */}
      {viewMode === 'chart' && (
        <div className="space-y-6">
          {visibleWorks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No completed deliverables registered for this period.
            </div>
          ) : (
            visibleWorks.map((item) => {
              const { icon, bg, barColor } = getActivityIcon(item.activity);
              const percentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';

              return (
                <div key={item.id} className="group relative">
                  <div className="flex items-start gap-4">
                    {/* Activity Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0 shadow-xs mt-0.5`}
                    >
                      {icon}
                    </div>

                    {/* Middle Info & Full Width Progress Bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.activity}
                        </h4>
                        <span className="text-xs font-semibold text-slate-400">
                          {percentage}%
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 truncate mb-2">
                        {item.notes || `${item.category} deliverables`}
                      </p>

                      {/* Custom Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(parseFloat(percentage), 3)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Right Big Count */}
                    <div className="text-right shrink-0 min-w-[40px] pl-2">
                      <span className="text-xl font-extrabold text-slate-900">
                        {item.count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Monthly Trend View */}
      {viewMode === 'trend' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-400 font-semibold uppercase text-[11px]">
                <th className="py-3 px-3">Activity</th>
                <th className="py-3 px-3">Category</th>
                {availableMonths.map((m) => (
                  <th key={m} className="py-3 px-3 text-right">
                    {m}
                  </th>
                ))}
                <th className="py-3 px-3 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(allWorks.length > 0 ? allWorks : visibleWorks).map((w) => {
                const totalAll =
                  w.monthlyBreakdown && Object.keys(w.monthlyBreakdown).length > 0
                    ? Object.values(w.monthlyBreakdown).reduce((a: number, b) => a + (Number(b) || 0), 0)
                    : w.count;
                return (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{w.activity}</td>
                    <td className="py-3 px-3 text-slate-500">{w.category}</td>
                    {availableMonths.map((m) => {
                      let monthVal = 0;
                      if (w.monthlyBreakdown) {
                        for (const [bm, count] of Object.entries(w.monthlyBreakdown)) {
                          if (isSameMonth(bm, m)) {
                            monthVal = Number(count || 0);
                            break;
                          }
                        }
                      } else if (isSameMonth(w.month, m)) {
                        monthVal = w.count;
                      }
                      return (
                        <td key={m} className="py-3 px-3 text-right text-slate-700 font-semibold">
                          {monthVal}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right font-extrabold text-[#E11D74]">
                      {totalAll}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Detailed View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-400 font-semibold uppercase text-[11px]">
                <th className="py-3 px-3">Activity</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Notes / Scope</th>
                <th className="py-3 px-3 text-right">Count</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleWorks.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{w.activity}</td>
                  <td className="py-3 px-3 text-slate-500">{w.category}</td>
                  <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{w.notes || '—'}</td>
                  <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                    {w.count}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => {
                        setEditingItem(w);
                        setEditCount(w.count);
                        setEditNotes(w.notes || '');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Edit count"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteWorkItem && (
                      <button
                        onClick={() => onDeleteWorkItem(w.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-1"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card Footer */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 font-medium">
          Total <strong className="text-slate-900">{totalCount} items</strong> across{' '}
          <strong className="text-slate-900">{visibleWorks.length} work streams</strong> • Top output:{' '}
          <span className="text-slate-700 font-semibold">{topItem ? topItem.activity : 'None'}</span>
        </span>

        <button
          onClick={() => setIsAddingOpen(true)}
          className="text-[#E11D74] hover:text-[#c91464] font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add activity</span>
        </button>
      </div>

      {/* Add Activity Modal */}
      {isAddingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Deliverable Activity</h3>
              <button
                onClick={() => setIsAddingOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infographics, Case Studies, Social posts"
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Count *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newCount}
                    onChange={(e) => setNewCount(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                  >
                    <option value="Social Media">Social Media</option>
                    <option value="Video Production">Video Production</option>
                    <option value="Design & Web">Design & Web</option>
                    <option value="Content">Content</option>
                    <option value="Branding & Video">Branding & Video</option>
                    <option value="Lead Gen">Lead Gen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of works delivered"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-[#E11D74] hover:bg-[#c91464] text-white rounded-lg shadow-sm transition-colors"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Activity Count Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Edit "{editingItem.activity}"
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Count</label>
                <input
                  type="number"
                  min="0"
                  value={editCount}
                  onChange={(e) => setEditCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateWorkItem) {
                    onUpdateWorkItem(editingItem.id, {
                      count: editCount,
                      notes: editNotes,
                    });
                  }
                  setEditingItem(null);
                }}
                className="px-5 py-2 text-xs font-semibold bg-[#E11D74] hover:bg-[#c91464] text-white rounded-lg shadow-sm transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
