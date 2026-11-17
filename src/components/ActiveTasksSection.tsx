import React, { useState, useEffect } from 'react';
import { Calendar, Check, ClipboardList, Edit2, Save, Trash2 } from 'lucide-react';
import { ActiveTaskUpdate } from '../types';

interface ActiveTasksSectionProps {
  activeTaskUpdate: ActiveTaskUpdate | null;
  onSaveActiveTaskUpdate: (date: string, tasks: string) => void;
  onClearActiveTaskUpdate?: () => void;
  isViewOnly?: boolean;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return dateStr;
}

function formatUpdatedTimestamp(iso?: string): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ActiveTasksSection: React.FC<ActiveTasksSectionProps> = ({
  activeTaskUpdate,
  onSaveActiveTaskUpdate,
  onClearActiveTaskUpdate,
  isViewOnly = false,
}) => {
  const [dateInput, setDateInput] = useState<string>(() => getTodayIsoDate());
  const [tasksInput, setTasksInput] = useState<string>('');
  const [justSaved, setJustSaved] = useState<boolean>(false);

  useEffect(() => {
    if (!dateInput) {
      setDateInput(getTodayIsoDate());
    }
  }, [dateInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    const cleanTasks = tasksInput.trim();
    const cleanDate = dateInput.trim() || getTodayIsoDate();
    if (!cleanTasks) return;

    onSaveActiveTaskUpdate(cleanDate, cleanTasks);
    setTasksInput('');
    setDateInput(getTodayIsoDate());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  };

  const handleLoadCurrentForEdit = () => {
    if (!activeTaskUpdate) return;
    setDateInput(activeTaskUpdate.date || getTodayIsoDate());
    setTasksInput(activeTaskUpdate.tasks || '');
  };

  return (
    <section
      aria-label="Active tasks"
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs"
    >
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#E11D74] shrink-0" />
            <h3 className="text-base font-bold text-slate-900">Active tasks</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Current tasks snapshot — stays visible until the next update
          </p>
        </div>

        {activeTaskUpdate?.updatedAt && (
          <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0 mt-0.5">
            Updated {formatUpdatedTimestamp(activeTaskUpdate.updatedAt)}
          </span>
        )}
      </div>

      {/* Persisted Current Active Tasks Display */}
      {activeTaskUpdate && activeTaskUpdate.tasks ? (
        <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 mb-4">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/70">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1D1B48] tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-[#E11D74] shrink-0" />
              <span>{formatReadableDate(activeTaskUpdate.date)}</span>
            </div>

            {!isViewOnly && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleLoadCurrentForEdit}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-600 hover:text-[#1D1B48] hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  title="Edit current active tasks"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                {onClearActiveTaskUpdate && (
                  <button
                    type="button"
                    onClick={onClearActiveTaskUpdate}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Clear current active tasks"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="text-xs sm:text-[13px] text-slate-800 font-medium leading-relaxed whitespace-pre-line break-words">
            {activeTaskUpdate.tasks}
          </div>
        </div>
      ) : (
        <div className="px-3.5 py-3 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-xs text-slate-400 mb-4">
          No active tasks update saved yet.
        </div>
      )}

      {/* Entry Form for Editor */}
      {!isViewOnly && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="active-tasks-date"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Date
            </label>
            <input
              id="active-tasks-date"
              type="date"
              required
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#E11D74] focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="active-tasks-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tasks
            </label>
            <textarea
              id="active-tasks-input"
              rows={3}
              required
              value={tasksInput}
              onChange={(e) => setTasksInput(e.target.value)}
              placeholder="Enter today's active tasks or next update..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E11D74] focus:border-transparent resize-y"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] text-slate-400">
              {justSaved ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved until next update</span>
                </span>
              ) : (
                'Replaces previous display on Save'
              )}
            </span>

            <button
              type="submit"
              disabled={!tasksInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1D1B48] hover:bg-[#2a2768] disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
