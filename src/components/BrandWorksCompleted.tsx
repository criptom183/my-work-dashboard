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
  StickyNote,
  ChevronDown,
  ChevronRight,
  ListTree,
  FileSpreadsheet,
  CornerDownRight,
  UploadCloud,
} from 'lucide-react';
import { WorkItem, DeliverableSubItem } from '../types';
import { isSameMonth } from '../utils/monthHelper';

interface BrandWorksCompletedProps {
  works: WorkItem[];
  availableMonths?: string[];
  selectedMonth?: string;
  allWorks?: WorkItem[];
  workListNote?: string;
  onUpdateWorkListNote?: (note: string) => void;
  onAddWorkItem: (activity: string, count: number, category: string, notes?: string) => void;
  onUpdateWorkItem?: (id: string, updates: Partial<WorkItem>) => void;
  onDeleteWorkItem?: (id: string) => void;
  onAddSubItem?: (workItemId: string, title: string, note?: string) => void;
  onUpdateSubItem?: (workItemId: string, subItemId: string, updates: { title?: string; note?: string }) => void;
  onDeleteSubItem?: (workItemId: string, subItemId: string) => void;
  onExportSubItemsSheet?: () => void;
  onOpenSyncModal?: () => void;
  onSyncAllTopics?: () => void;
  isSyncingAllTopics?: boolean;
  isViewOnly?: boolean;
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
  selectedMonth = 'Nov 2026',
  allWorks = [],
  workListNote = '',
  onUpdateWorkListNote,
  onAddWorkItem,
  onUpdateWorkItem,
  onDeleteWorkItem,
  onAddSubItem,
  onUpdateSubItem,
  onDeleteSubItem,
  onExportSubItemsSheet,
  onOpenSyncModal,
  onSyncAllTopics,
  isSyncingAllTopics = false,
  isViewOnly = false,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'trend' | 'table'>('chart');
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newActivity, setNewActivity] = useState('');
  const [newCount, setNewCount] = useState('1');
  const [newCategory, setNewCategory] = useState('Social Media');
  const [newNotes, setNewNotes] = useState('');

  // Collapsible sub-items state: which deliverables are expanded
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  // Draft inputs for adding a new topic per deliverable: { [workItemId]: { title: string, note: string } }
  const [topicDrafts, setTopicDrafts] = useState<Record<string, { title: string; note: string }>>({});

  // Editing state for an individual sub-item
  const [editingSubItem, setEditingSubItem] = useState<{
    workItemId: string;
    subItemId: string;
    title: string;
    note: string;
  } | null>(null);

  // Toggle expand/collapse for a deliverable
  const toggleExpand = (id: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateDraftTitle = (workItemId: string, title: string) => {
    setTopicDrafts((prev) => ({
      ...prev,
      [workItemId]: {
        title,
        note: prev[workItemId]?.note || '',
      },
    }));
  };

  const updateDraftNote = (workItemId: string, note: string) => {
    setTopicDrafts((prev) => ({
      ...prev,
      [workItemId]: {
        title: prev[workItemId]?.title || '',
        note,
      },
    }));
  };

  const handleAddSubTopic = (e: React.FormEvent, workItemId: string) => {
    e.preventDefault();
    if (isViewOnly || !onAddSubItem) return;
    const draft = topicDrafts[workItemId];
    if (!draft || !draft.title.trim()) return;

    onAddSubItem(workItemId, draft.title.trim(), draft.note.trim() || undefined);

    // Reset draft for this item
    setTopicDrafts((prev) => ({
      ...prev,
      [workItemId]: { title: '', note: '' },
    }));
  };

  const handleSaveSubItemEdit = () => {
    if (!editingSubItem || isViewOnly || !onUpdateSubItem) return;
    onUpdateSubItem(editingSubItem.workItemId, editingSubItem.subItemId, {
      title: editingSubItem.title.trim(),
      note: editingSubItem.note.trim() || undefined,
    });
    setEditingSubItem(null);
  };

  // Inline quick-note state per work item
  const [inlineNoteId, setInlineNoteId] = useState<string | null>(null);
  const [inlineNoteText, setInlineNoteText] = useState('');

  // Section-level work list note state
  const [isEditingListNote, setIsEditingListNote] = useState(false);
  const [listNoteDraft, setListNoteDraft] = useState(workListNote);

  // Full item editing modal
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [editCount, setEditCount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editCustomNote, setEditCustomNote] = useState('');

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
    if (isViewOnly || !newActivity.trim()) return;
    onAddWorkItem(
      newActivity.trim(),
      parseInt(newCount, 10) || 1,
      newCategory,
      newNotes.trim() || undefined
    );
    setNewActivity('');
    setNewCount('1');
    setNewNotes('');
    setIsAddingOpen(false);
  };

  const openInlineNote = (item: WorkItem) => {
    if (isViewOnly) return;
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

  const clearItemNote = (item: WorkItem) => {
    if (isViewOnly) return;
    if (onUpdateWorkItem) {
      onUpdateWorkItem(item.id, {
        customNote: '',
      });
    }
    setInlineNoteId(null);
    setInlineNoteText('');
  };

  const renderTopicsPanel = (item: WorkItem) => {
    const subList = item.subItems || [];
    const isAdding = !isViewOnly && onAddSubItem;

    return (
      <div className="p-3.5 rounded-xl bg-slate-50/95 border border-indigo-100 shadow-2xs space-y-3 animate-in fade-in duration-150">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              Topics & Sub-Categories
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              ({subList.length} recorded • Target: {item.count})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isViewOnly && onSyncAllTopics && subList.length > 0 && (
              <button
                type="button"
                onClick={onSyncAllTopics}
                disabled={isSyncingAllTopics}
                className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition-colors"
                title="Sync all dashboard topics into your Google Sheet"
              >
                <UploadCloud className="w-2.5 h-2.5 text-indigo-600" />
                <span>Sync to Sheet</span>
              </button>
            )}
            {!isViewOnly && onExportSubItemsSheet && (
              <button
                type="button"
                onClick={onExportSubItemsSheet}
                className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 hover:underline cursor-pointer"
                title="Autosave and download Google Sheet tab with all topics"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                <span>Export Sheet Tab</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleExpand(item.id)}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Existing Sub-items list */}
        {subList.length > 0 ? (
          <div className="space-y-1.5">
            {subList.map((sub, idx) => {
              const isEditingThis =
                editingSubItem?.workItemId === item.id &&
                editingSubItem?.subItemId === sub.id;

              if (isEditingThis) {
                return (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-lg bg-white border border-indigo-300 shadow-2xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editingSubItem.title}
                        onChange={(e) =>
                          setEditingSubItem((prev) =>
                            prev ? { ...prev, title: e.target.value } : null
                          )
                        }
                        placeholder="Topic title..."
                        className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editingSubItem.note}
                        onChange={(e) =>
                          setEditingSubItem((prev) =>
                            prev ? { ...prev, note: e.target.value } : null
                          )
                        }
                        placeholder="Short note (optional)..."
                        className="sm:w-52 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveSubItemEdit}
                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSubItem(null)}
                        className="px-2.5 py-1 rounded text-slate-500 hover:bg-slate-100 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={sub.id}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200/80 flex items-start justify-between gap-2.5 group/sub transition-colors hover:border-indigo-200"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 break-words leading-snug">
                        {sub.title}
                      </p>
                      {sub.note && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed break-words">
                          {sub.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isViewOnly && (
                    <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover/sub:opacity-100 transition-opacity">
                      {onUpdateSubItem && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingSubItem({
                              workItemId: item.id,
                              subItemId: sub.id,
                              title: sub.title,
                              note: sub.note || '',
                            })
                          }
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                          title="Edit topic"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {onDeleteSubItem && (
                        <button
                          type="button"
                          onClick={() => onDeleteSubItem(item.id, sub.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Delete topic"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-1">
            No topics entered yet for this deliverable. You can add them one by one below.
          </p>
        )}

        {/* Inline Add Topic form */}
        {isAdding && (
          <form
            onSubmit={(e) => handleAddSubTopic(e, item.id)}
            className="pt-2.5 border-t border-slate-200/70"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                value={topicDrafts[item.id]?.title || ''}
                onChange={(e) => updateDraftTitle(item.id, e.target.value)}
                placeholder={`Topic #${subList.length + 1} title (e.g. Fuel Monitoring Video)...`}
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
              />
              <input
                type="text"
                value={topicDrafts[item.id]?.note || ''}
                onChange={(e) => updateDraftNote(item.id, e.target.value)}
                placeholder="Short note (optional)..."
                className="sm:w-52 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus className="w-3 h-3" />
                <span>Add topic</span>
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  const handleSaveListNote = () => {
    if (onUpdateWorkListNote) {
      onUpdateWorkListNote(listNoteDraft.trim());
    }
    setIsEditingListNote(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-2xs">
      {/* Header with View Switcher & List Note Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg font-bold text-slate-900">Works completed</h3>
            {!isViewOnly && onUpdateWorkListNote && !isEditingListNote && (
              <button
                type="button"
                onClick={() => {
                  setListNoteDraft(workListNote || '');
                  setIsEditingListNote(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-500 hover:text-[#E11D74] bg-slate-50 hover:bg-pink-50/60 border border-slate-200/80 transition-colors cursor-pointer"
                title="Add or edit a note for this work list"
              >
                <StickyNote className="w-3 h-3 text-[#E11D74]" />
                <span>{workListNote ? 'Edit list note' : '+ Add note'}</span>
              </button>
            )}

            {!isViewOnly && onExportSubItemsSheet && (
              <button
                type="button"
                onClick={onExportSubItemsSheet}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                title="Export Topic Breakdown tab for Google Sheets"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                <span>Export Sheet Tab</span>
              </button>
            )}

            {!isViewOnly && onSyncAllTopics && (
              <button
                type="button"
                onClick={onSyncAllTopics}
                disabled={isSyncingAllTopics}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                title="Push all previously added topics to your Google Sheet now"
              >
                <UploadCloud className={`w-3 h-3 ${isSyncingAllTopics ? 'animate-spin' : ''}`} />
                <span>{isSyncingAllTopics ? 'Syncing...' : 'Sync All Topics to Sheet'}</span>
              </button>
            )}

            {!isViewOnly && onOpenSyncModal && (
              <button
                type="button"
                onClick={onOpenSyncModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                title="Configure Google Sheet Autosave & Apps Script Web App"
              >
                <Zap className="w-3 h-3 text-indigo-600" />
                <span>Sheet Autosave</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Items delivered per activity • {selectedMonth === 'all' ? 'All Months' : selectedMonth}
          </p>
        </div>

        {/* View mode segmented switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-slate-100 border border-slate-200/60 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'chart'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('trend')}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'trend'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Monthly trend
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Section-Level Work List Note Banner / Editor */}
      {!isViewOnly && isEditingListNote ? (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/90">
          <label className="block text-[11px] font-bold text-amber-900 mb-1.5">
            Note for Works Completed ({selectedMonth === 'all' ? 'All Months' : selectedMonth})
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={listNoteDraft}
              onChange={(e) => setListNoteDraft(e.target.value)}
              placeholder="Write a small note for this work list (e.g., key campaign focus, remarks)..."
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#E11D74]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveListNote();
                if (e.key === 'Escape') setIsEditingListNote(false);
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSaveListNote}
                className="px-3 py-1.5 rounded-lg bg-[#1D1B48] hover:bg-[#2a2768] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Save note
              </button>
              {workListNote && (
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateWorkListNote) onUpdateWorkListNote('');
                    setListNoteDraft('');
                    setIsEditingListNote(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditingListNote(false)}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : workListNote ? (
        <div className="mb-5 px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-amber-950 min-w-0">
            <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed break-words">{workListNote}</span>
          </div>
          {!isViewOnly && onUpdateWorkListNote && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setListNoteDraft(workListNote);
                  setIsEditingListNote(true);
                }}
                className="p-1 text-amber-700 hover:text-amber-950 rounded hover:bg-amber-100/70 transition-colors cursor-pointer"
                title="Edit note"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateWorkListNote('')}
                className="p-1 text-amber-700 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                title="Remove note"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Main View Mode Content */}
      {viewMode === 'chart' && (
        <div className="space-y-5">
          {visibleWorks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No completed deliverables registered for this period.
            </div>
          ) : (
            visibleWorks.map((item) => {
              const { icon, bg, barColor } = getActivityIcon(item.activity);
              const percentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
              const isEditingThisNote = !isViewOnly && inlineNoteId === item.id;
              const isExpanded = expandedItemIds.has(item.id);

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
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                          {/* Main Work Title: Bold, prominent, easily readable */}
                          <h4 className="text-[15px] font-extrabold text-[#1D1B48] tracking-tight">
                            {item.activity}
                          </h4>

                          {/* Sub-item Topics Button: High-visibility, prominent interactive button */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                              isExpanded
                                ? 'bg-[#1D1B48] text-white ring-2 ring-indigo-400/50 shadow-xs'
                                : item.subItems && item.subItems.length > 0
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                : !isViewOnly
                                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300'
                                : 'hidden'
                            }`}
                            title={isExpanded ? 'Collapse topic breakdown' : 'Expand topic breakdown'}
                          >
                            <ListTree className={`w-3.5 h-3.5 ${
                              isExpanded || (item.subItems && item.subItems.length > 0)
                                ? 'text-indigo-100'
                                : 'text-indigo-600'
                            }`} />
                            <span>
                              {item.subItems && item.subItems.length > 0
                                ? `${item.subItems.length} ${item.subItems.length === 1 ? 'Topic' : 'Topics'}`
                                : '+ Add Topics'}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 opacity-90" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 opacity-90" />
                            )}
                          </button>

                          {/* Discreet Note action for editors */}
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => openInlineNote(item)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer shrink-0 ${
                                item.customNote
                                  ? 'text-amber-800 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/50'
                                  : 'text-slate-400 hover:text-amber-800 hover:bg-amber-50/50'
                              }`}
                              title={item.customNote ? 'Edit note for this deliverable' : 'Add a note to this deliverable'}
                            >
                              <StickyNote className="w-2.5 h-2.5 text-amber-600/70" />
                              <span>{item.customNote ? 'Note' : '+ Note'}</span>
                            </button>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                          {percentage}%
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 truncate mb-1">
                        {item.notes || `${item.category} deliverables`}
                      </p>

                      {/* Display Attached Note: Soft, compact amber background without dominating */}
                      {item.customNote && !isEditingThisNote && (
                        <div className="mb-2 px-2.5 py-1 rounded-md bg-amber-50/60 border border-amber-200/50 flex items-center justify-between gap-2 text-[11px] text-amber-900/80">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <StickyNote className="w-3 h-3 text-amber-600/70 shrink-0" />
                            <span className="font-normal break-words">{item.customNote}</span>
                          </div>
                          {!isViewOnly && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openInlineNote(item)}
                                className="p-0.5 text-amber-700/70 hover:text-amber-950 cursor-pointer"
                                title="Edit note"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => clearItemNote(item)}
                                className="p-0.5 text-amber-700/70 hover:text-rose-600 cursor-pointer"
                                title="Remove note"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inline Quick Note Input */}
                      {!isViewOnly && isEditingThisNote && (
                        <div className="mb-2 p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5">
                          <StickyNote className="w-3.5 h-3.5 text-[#E11D74] shrink-0" />
                          <input
                            type="text"
                            value={inlineNoteText}
                            onChange={(e) => setInlineNoteText(e.target.value)}
                            placeholder={`Add a small note for ${item.activity}...`}
                            className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#E11D74]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineNote(item);
                              if (e.key === 'Escape') setInlineNoteId(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => saveInlineNote(item)}
                            className="p-1 px-2 rounded bg-[#E11D74] hover:bg-[#c91464] text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineNoteId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

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
                    <div className="text-right shrink-0 min-w-[44px] pl-2 flex flex-col items-end">
                      <span
                        onClick={
                          !isViewOnly
                            ? () => {
                                setEditingItem(item);
                                setEditCount(item.count);
                                setEditNotes(item.notes || '');
                                setEditCustomNote(item.customNote || '');
                              }
                            : undefined
                        }
                        className={`text-xl font-extrabold text-slate-900 tabular-nums transition-colors ${
                          !isViewOnly
                            ? 'cursor-pointer hover:text-[#E11D74]'
                            : 'cursor-default'
                        }`}
                        title={!isViewOnly ? 'Click to edit count or details' : undefined}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Topics Breakdown Panel */}
                  {isExpanded && (
                    <div className="mt-3 ml-0 sm:ml-14">
                      {renderTopicsPanel(item)}
                    </div>
                  )}
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
                <th className="py-3 px-3">Activity & Note</th>
                <th className="py-3 px-3">Category</th>
                {availableMonths.map((m) => (
                  <th key={m} className="py-3 px-3 text-right tabular-nums">
                    {m}
                  </th>
                ))}
                <th className="py-3 px-3 text-right tabular-nums">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(allWorks.length > 0 ? allWorks : visibleWorks).map((w) => {
                const totalAll =
                  w.monthlyBreakdown && Object.keys(w.monthlyBreakdown).length > 0
                    ? Object.values(w.monthlyBreakdown).reduce((a: number, b) => a + (Number(b) || 0), 0)
                    : w.count;
                const isEditingThisNote = inlineNoteId === w.id;

                return (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{w.activity}</span>
                        {!isViewOnly && (
                          <button
                            type="button"
                            onClick={() => openInlineNote(w)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-[#E11D74] hover:bg-pink-50 transition-colors cursor-pointer"
                            title="Add or edit note"
                          >
                            <StickyNote className="w-2.5 h-2.5" />
                            <span>{w.customNote ? 'Edit note' : '+ Note'}</span>
                          </button>
                        )}
                      </div>
                      {w.customNote && !isEditingThisNote && (
                        <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900">
                          <StickyNote className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span>{w.customNote}</span>
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => clearItemNote(w)}
                              className="text-amber-700 hover:text-rose-600 ml-1 cursor-pointer"
                              title="Remove note"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                      {!isViewOnly && isEditingThisNote && (
                        <div className="mt-1.5 flex items-center gap-1.5 max-w-xs">
                          <input
                            type="text"
                            value={inlineNoteText}
                            onChange={(e) => setInlineNoteText(e.target.value)}
                            placeholder="Small note..."
                            className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#E11D74]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineNote(w);
                              if (e.key === 'Escape') setInlineNoteId(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => saveInlineNote(w)}
                            className="px-2 py-1 rounded bg-[#E11D74] text-white text-[10px] font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineNoteId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
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
                        <td key={m} className="py-3 px-3 text-right text-slate-700 font-semibold tabular-nums">
                          {monthVal}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right font-extrabold text-[#E11D74] tabular-nums">
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
                <th className="py-3 px-3">Notes / Remarks</th>
                <th className="py-3 px-3 text-right tabular-nums">Count</th>
                {!isViewOnly && <th className="py-3 px-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleWorks.map((w) => {
                const isEditingThisNote = !isViewOnly && inlineNoteId === w.id;
                const isExpanded = expandedItemIds.has(w.id);

                return (
                  <React.Fragment key={w.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-[#1D1B48] text-sm">{w.activity}</span>
                          <button
                            type="button"
                            onClick={() => toggleExpand(w.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                              isExpanded
                                ? 'bg-[#1D1B48] text-white ring-2 ring-indigo-400/50 shadow-xs'
                                : w.subItems && w.subItems.length > 0
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                : !isViewOnly
                                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300'
                                : 'hidden'
                            }`}
                            title={isExpanded ? 'Collapse topics' : 'Expand topics'}
                          >
                            <ListTree className={`w-3.5 h-3.5 ${
                              isExpanded || (w.subItems && w.subItems.length > 0)
                                ? 'text-indigo-100'
                                : 'text-indigo-600'
                            }`} />
                            <span>
                              {w.subItems && w.subItems.length > 0
                                ? `${w.subItems.length} ${w.subItems.length === 1 ? 'Topic' : 'Topics'}`
                                : '+ Add Topics'}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 opacity-90" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 opacity-90" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{w.category}</td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs">
                        {!isViewOnly && isEditingThisNote ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={inlineNoteText}
                              onChange={(e) => setInlineNoteText(e.target.value)}
                              placeholder="Add a note..."
                              className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#E11D74]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineNote(w);
                                if (e.key === 'Escape') setInlineNoteId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => saveInlineNote(w)}
                              className="px-2 py-1 rounded bg-[#E11D74] text-white text-[10px] font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineNoteId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {w.customNote && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50/60 border border-amber-200/50 text-[11px] font-normal text-amber-900/80">
                                <StickyNote className="w-2.5 h-2.5 text-amber-600/70 shrink-0" />
                                <span>{w.customNote}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="truncate text-slate-500">{w.notes || '—'}</span>
                              {!isViewOnly && (
                                <button
                                  type="button"
                                  onClick={() => openInlineNote(w)}
                                  className="text-[10px] font-semibold text-[#E11D74] hover:underline shrink-0 cursor-pointer"
                                >
                                  {w.customNote ? 'Edit note' : '+ Note'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm tabular-nums">
                        {w.count}
                      </td>
                      {!isViewOnly && (
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setEditingItem(w);
                              setEditCount(w.count);
                              setEditNotes(w.notes || '');
                              setEditCustomNote(w.customNote || '');
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Edit count & notes"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteWorkItem && (
                            <button
                              onClick={() => onDeleteWorkItem(w.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-1 cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Collapsible Topics Row in Table View */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={isViewOnly ? 4 : 5} className="py-3 px-4">
                          {renderTopicsPanel(w)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Card Footer */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 font-medium">
          Total <strong className="text-slate-900 tabular-nums">{totalCount} items</strong> across{' '}
          <strong className="text-slate-900 tabular-nums">{visibleWorks.length} work streams</strong> • Top output:{' '}
          <span className="text-slate-700 font-semibold">{topItem ? topItem.activity : 'None'}</span>
        </span>

        {!isViewOnly && (
          <button
            onClick={() => setIsAddingOpen(true)}
            className="text-[#E11D74] hover:text-[#c91464] font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add activity</span>
          </button>
        )}
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
                  Small Note / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief note or summary of works delivered"
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

      {/* Edit Activity Count & Note Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-3">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Highlighted Small Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Add a quick note near this work item..."
                  value={editCustomNote}
                  onChange={(e) => setEditCustomNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#E11D74] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subtitle / Scope Description
                </label>
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
                      customNote: editCustomNote.trim(),
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
