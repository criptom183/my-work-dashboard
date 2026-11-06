import React from 'react';
import { Video, Check, Plus, ArrowRight } from 'lucide-react';
import { TaskItem } from '../types';

interface BrandTasksWidgetProps {
  tasks: TaskItem[];
  onOpenTaskManager: () => void;
  onAddTask: () => void;
}

export const BrandTasksWidget: React.FC<BrandTasksWidgetProps> = ({
  tasks,
  onOpenTaskManager,
  onAddTask,
}) => {
  const activeCount = tasks.filter((t) => t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  // Grab the top task to display (or default to sample if empty)
  const displayTask = tasks.length > 0 ? tasks[0] : {
    id: 'sample-task',
    title: 'Last mile delivery reels',
    category: 'Reels',
    priority: 'Medium' as const,
    assignedTo: 'Unassigned',
    status: 'completed' as const,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-slate-900">Tasks & action items</h3>
        <button
          onClick={onOpenTaskManager}
          className="text-xs font-semibold text-[#E11D74] hover:text-[#c91464] transition-colors cursor-pointer flex items-center gap-1"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        {activeCount} active • {completedCount} completed
      </p>

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

              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                {displayTask.assignedTo || 'Unassigned'}
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
