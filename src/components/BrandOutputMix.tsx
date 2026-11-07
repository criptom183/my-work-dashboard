import React, { useState } from 'react';
import { StickyNote, Edit2, X, Check } from 'lucide-react';
import { WorkItem } from '../types';

interface BrandOutputMixProps {
  works: WorkItem[];
  selectedMonth: string;
  outputMixNote?: string;
  onUpdateOutputMixNote?: (note: string) => void;
  onUpdateWorkItem?: (id: string, updates: Partial<WorkItem>) => void;
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
  outputMixNote = '',
  onUpdateOutputMixNote,
  onUpdateWorkItem,
}) => {
  const [isEditingMixNote, setIsEditingMixNote] = useState(false);
  const [mixNoteDraft, setMixNoteDraft] = useState(outputMixNote);

  const [inlineNoteId, setInlineNoteId] = useState<string | null>(null);
  const [inlineNoteText, setInlineNoteText] = useState('');

  const visibleWorks = works.filter((w) => (w.count || 0) > 0);
  const totalCount = visibleWorks.reduce((acc, curr) => acc + curr.count, 0);

  // Calculate percentage and arc offsets for donut chart
  let cumulativeAngle = 0;
  const radius = 38;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  const handleSaveMixNote = () => {
    if (onUpdateOutputMixNote) {
      onUpdateOutputMixNote(mixNoteDraft.trim());
    }
    setIsEditingMixNote(false);
  };

  const openInlineNote = (item: WorkItem) => {
    setInlineNoteId(item.id);
    setInlineNoteText(item.customNote || '');
  };

  const saveInlineNote = (item: WorkItem) => {
    if (onUpdateWorkItem) {
      onUpdateWorkItem(item.id, {
        customNote: inlineNoteText.trim(),
      });
    }
    setInlineNoteId(null);
    setInlineNoteText('');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs mb-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">Output mix</h3>
          {onUpdateOutputMixNote && !isEditingMixNote && (
            <button
              type="button"
              onClick={() => {
                setMixNoteDraft(outputMixNote || '');
                setIsEditingMixNote(true);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-500 hover:text-[#E11D74] bg-slate-50 hover:bg-pink-50/60 border border-slate-200/80 transition-colors cursor-pointer"
              title="Add or edit a note for Output mix"
            >
              <StickyNote className="w-3 h-3 text-[#E11D74]" />
              <span>{outputMixNote ? 'Edit note' : '+ Add note'}</span>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Share of items • {selectedMonth === 'all' ? 'All Months' : selectedMonth}
        </p>
      </div>

      {/* Section Note Banner / Editor */}
      {isEditingMixNote ? (
        <div className="mb-4 p-3 rounded-xl bg-amber-50/60 border border-amber-200/90">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={mixNoteDraft}
              onChange={(e) => setMixNoteDraft(e.target.value)}
              placeholder="Add a note for Output mix..."
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#E11D74]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveMixNote();
                if (e.key === 'Escape') setIsEditingMixNote(false);
              }}
            />
            <div className="flex items-center justify-end gap-1.5">
              {outputMixNote && (
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateOutputMixNote) onUpdateOutputMixNote('');
                    setMixNoteDraft('');
                    setIsEditingMixNote(false);
                  }}
                  className="px-2 py-1 rounded text-rose-600 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditingMixNote(false)}
                className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 text-[11px] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMixNote}
                className="px-2.5 py-1 rounded bg-[#1D1B48] hover:bg-[#2a2768] text-white text-[11px] font-semibold cursor-pointer"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : outputMixNote ? (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 text-xs text-amber-950 min-w-0">
            <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="font-medium break-words">{outputMixNote}</span>
          </div>
          {onUpdateOutputMixNote && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMixNoteDraft(outputMixNote);
                  setIsEditingMixNote(true);
                }}
                className="p-0.5 text-amber-700 hover:text-amber-950 cursor-pointer"
                title="Edit note"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateOutputMixNote('')}
                className="p-0.5 text-amber-700 hover:text-rose-600 cursor-pointer"
                title="Remove note"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : null}

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
            <span className="text-2xl font-extrabold text-slate-900 leading-none tabular-nums">
              {totalCount}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5">items</span>
          </div>
        </div>

        {/* Legend / Work List */}
        <div className="flex-1 w-full space-y-2">
          {visibleWorks.map((item, idx) => {
            const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
            const color = PALETTE[idx % PALETTE.length];
            const isEditingThis = inlineNoteId === item.id;

            return (
              <div key={item.id} className="group">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-slate-700 truncate">{item.activity}</span>
                    {onUpdateWorkItem && (
                      <button
                        type="button"
                        onClick={() => openInlineNote(item)}
                        className={`p-0.5 rounded transition-opacity cursor-pointer shrink-0 ${
                          item.customNote
                            ? 'text-amber-600 hover:text-amber-800 opacity-100'
                            : 'text-slate-300 hover:text-[#E11D74] opacity-0 group-hover:opacity-100'
                        }`}
                        title={item.customNote ? `Note: ${item.customNote} (Click to edit)` : 'Add small note'}
                      >
                        <StickyNote className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400 font-medium w-10 text-right">{pct}%</span>
                  </div>
                </div>

                {item.customNote && !isEditingThis && (
                  <div
                    onClick={() => openInlineNote(item)}
                    className="ml-4 mt-0.5 text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200/60 rounded px-2 py-0.5 flex items-center justify-between gap-1 cursor-pointer hover:bg-amber-100/60 transition-colors"
                  >
                    <span className="truncate">{item.customNote}</span>
                    <Edit2 className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                  </div>
                )}

                {isEditingThis && (
                  <div className="ml-4 mt-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={inlineNoteText}
                      onChange={(e) => setInlineNoteText(e.target.value)}
                      placeholder="Small note..."
                      className="flex-1 min-w-0 px-2 py-0.5 text-[11px] bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#E11D74]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineNote(item);
                        if (e.key === 'Escape') setInlineNoteId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveInlineNote(item)}
                      className="p-1 rounded bg-[#E11D74] text-white cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineNoteId(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
