import React, { useState } from 'react';
import { Video, Check, Plus, ArrowRight, StickyNote, Edit2, X } from 'lucide-react';
import { TaskItem } from '../types';

interface BrandTasksWidgetProps {
  tasks: TaskItem[];
  onOpenTaskManager: () => void;
  onAddTask: () => void;
  tasksListNote?: string;
  onUpdateTasksListNote?: (note: string) => void;
}

export const BrandTasksWidget: React.FC<BrandTasksWidgetProps> = ({
  tasks,
  onOpenTaskManager,
  onAddTask,
  tasksListNote = '',
  onUpdateTasksListNote,
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(tasksListNote);

  const activeCount = tasks.filter((t) => t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  // Grab the top task to display (or default to sample if empty)
  const displayTask =
    tasks.length > 0
      ? tasks[0]
      : {
          id: 'sample-task',
          title: 'Last mile delivery reels',
          category: 'Reels',
          priority: 'Medium' as const,
          status: 'completed' as const,
          createdAt: new Date().toISOString(),
        };

  const handleSaveNote = () => {
    if (onUpdateTasksListNote) {
      onUpdateTasksListNote(noteDraft.trim());
    }
    setIsEditingNote(false);
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900">Tasks & action items</h3>
          {onUpdateTasksListNote && !isEditingNote && (
            <button
              type="button"
              onClick={() => {
                setNoteDraft(tasksListNote || '');
                setIsEditingNote(true);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-500 hover:text-[#E11D74] bg-slate-50 hover:bg-pink-50/60 border border-slate-200/80 transition-colors cursor-pointer"
              title="Add or edit a note for Tasks"
            >
              <StickyNote className="w-3 h-3 text-[#E11D74]" />
              <span>{tasksListNote ? 'Edit note' : '+ Note'}</span>
            </button>
          )}
        </div>
        <button
          onClick={onOpenTaskManager}
          className="text-xs font-semibold text-[#E11D74] hover:text-[#c91464] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        {activeCount} active • {completedCount} completed
      </p>

      {/* Section Note Banner / Editor */}
      {isEditingNote ? (
        <div className="mb-4 p-3 rounded-xl bg-amber-50/60 border border-amber-200/90">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add a note for Tasks & action items..."
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#E11D74]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote();
                if (e.key === 'Escape') setIsEditingNote(false);
              }}
            />
            <div className="flex items-center justify-end gap-1.5">
              {tasksListNote && (
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateTasksListNote) onUpdateTasksListNote('');
                    setNoteDraft('');
                    setIsEditingNote(false);
                  }}
                  className="px-2 py-1 rounded text-rose-600 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditingNote(false)}
                className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 text-[11px] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-2.5 py-1 rounded bg-[#1D1B48] hover:bg-[#2a2768] text-white text-[11px] font-semibold cursor-pointer"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : tasksListNote ? (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 text-xs text-amber-950 min-w-0">
            <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="font-medium break-words">{tasksListNote}</span>
          </div>
          {onUpdateTasksListNote && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setNoteDraft(tasksListNote);
                  setIsEditingNote(true);
                }}
                className="p-0.5 text-amber-700 hover:text-amber-950 cursor-pointer"
                title="Edit note"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateTasksListNote('')}
                className="p-0.5 text-amber-700 hover:text-rose-600 cursor-pointer"
                title="Remove note"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Task Card matching uploaded brand UI */}
      <div className="p-3.5 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all shadow-2xs mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1D1B48] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Video className="w-4 h-4 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {displayTask.title}
            </h4>

            {/* Tags row */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2 mb-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                {displayTask.category || 'Reels'}
              </span>

              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{displayTask.priority || 'Medium'} priority</span>
              </span>
            </div>

            {/* Status indicator */}
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span className="capitalize">{displayTask.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button: + Add a task */}
      <button
        onClick={onAddTask}
        className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#E11D74] hover:text-[#E11D74] text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-slate-50/50 hover:bg-pink-50/20"
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Add a task</span>
      </button>
    </div>
  );
};
