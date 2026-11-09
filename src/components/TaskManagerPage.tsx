import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  CheckSquare,
  Square,
  Calendar,
  Tag,
  Trash2,
  Edit3,
  Kanban,
  List as ListIcon,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Download,
  RotateCcw,
  Check,
  X,
  Layers,
  ArrowUpRight,
  FileSpreadsheet,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Link2,
  LogOut,
  StickyNote,
  Edit2,
  Copy,
  ChevronUp,
  ListChecks,
} from 'lucide-react';
import { TaskItem, TaskPriority, TaskStatus, TaskSubtask } from '../types';
import {
  fetchTasksPubliclyFromGoogleSheet,
} from '../utils/googleSheetsTasksSync';
import { extractGoogleSheetId } from '../utils/sheetParser';
import {
  saveTaskToFirestore,
  deleteTaskFromFirestore,
  saveSharedSheetUrl,
} from '../utils/firestoreTasks';
import {
  isTaskDeleted,
  markTaskAsDeleted,
} from '../utils/taskStorage';
import {
  signInWithGoogle,
  signOutUser,
  onAuthUserChanged,
} from '../utils/googleAuth';
import type { User as FirebaseUser } from 'firebase/auth';

interface TaskManagerPageProps {
  tasks: TaskItem[];
  onUpdateTasks: (updatedTasks: TaskItem[]) => void;
  onBackToDashboard: () => void;
  sheetSourceUrl?: string;
  onSheetSourceUrlChange?: (newUrl: string) => void;
  tasksListNote?: string;
  onUpdateTasksListNote?: (note: string) => void;
  isViewOnly?: boolean;
  onUnlockEditor?: () => void;
  onShareViewLink?: () => void;
}

const STATUS_COLUMNS: {
  id: TaskStatus;
  title: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'pending',
    title: 'Pending / To Do',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300',
    icon: <Clock className="w-4 h-4 text-slate-500" />,
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    borderColor: 'border-amber-400',
    icon: <Clock className="w-4 h-4 text-amber-600 animate-spin-slow" />,
  },
  {
    id: 'in-review',
    title: 'In Review',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderColor: 'border-purple-400',
    icon: <AlertCircle className="w-4 h-4 text-purple-600" />,
  },
  {
    id: 'completed',
    title: 'Completed',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderColor: 'border-emerald-500',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  },
];

const CATEGORIES = [
  'All',
  'Video Production',
  'Design & Web',
  'Social Media',
  'Lead Gen',
  'Strategy',
  'Branding',
];

export const TaskManagerPage: React.FC<TaskManagerPageProps> = ({
  tasks,
  onUpdateTasks,
  onBackToDashboard,
  sheetSourceUrl,
  onSheetSourceUrlChange,
  tasksListNote = '',
  onUpdateTasksListNote,
  isViewOnly = false,
  onUnlockEditor,
  onShareViewLink,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  // Task list note state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(tasksListNote);

  useEffect(() => {
    setNoteDraft(tasksListNote || '');
  }, [tasksListNote]);

  // Google Sheets Tasks Sync state (100% public, no Firebase or OAuth needed)
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [sheetSyncMessage, setSheetSyncMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [lastSheetSyncTime, setLastSheetSyncTime] = useState<string | null>(null);
  const [targetSheetUrl, setTargetSheetUrl] = useState(sheetSourceUrl || '');
  const [isSettingSheetUrl, setIsSettingSheetUrl] = useState(false);

  // Optional Google Auth state for editors
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthUserChanged((user) => {
      setAuthUser(user);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoggingIn(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Sync targetSheetUrl if sheetSourceUrl changes
  useEffect(() => {
    if (sheetSourceUrl && !targetSheetUrl) {
      setTargetSheetUrl(sheetSourceUrl);
    }
  }, [sheetSourceUrl, targetSheetUrl]);

  const activeSheetUrl = targetSheetUrl || sheetSourceUrl || '';
  const { sheetId } = extractGoogleSheetId(activeSheetUrl);

  // Automatically fetch tasks publicly on initial load or sheet link change (NO LOGIN REQUIRED)
  useEffect(() => {
    let isCancelled = false;
    if (!activeSheetUrl) return;

    const loadPublicTasks = async () => {
      try {
        setIsPublicLoading(true);
        const publicTasks = await fetchTasksPubliclyFromGoogleSheet(activeSheetUrl);
        const validTasks = (publicTasks || []).filter((t) => !isTaskDeleted(t.id));
        if (!isCancelled && validTasks.length > 0) {
          onUpdateTasks(validTasks);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSheetSyncTime(timeStr);
        }
      } catch (err) {
        console.warn('Auto public task fetch note:', err);
      } finally {
        if (!isCancelled) setIsPublicLoading(false);
      }
    };

    loadPublicTasks();
    return () => {
      isCancelled = true;
    };
  }, [activeSheetUrl]);

  // Load tasks from Google Sheet (100% public, NO LOGIN NEEDED)
  const handleLoadFromSheet = async () => {
    if (!activeSheetUrl) {
      setIsSettingSheetUrl(true);
      return;
    }
    setIsSyncingSheets(true);
    setSheetSyncMessage(null);

    try {
      const fetchedTasks = await fetchTasksPubliclyFromGoogleSheet(activeSheetUrl);
      const validTasks = (fetchedTasks || []).filter((t) => !isTaskDeleted(t.id));

      if (validTasks.length > 0) {
        onUpdateTasks(validTasks);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSheetSyncTime(timeStr);
        setSheetSyncMessage({
          text: `Fetched ${validTasks.length} tasks from the 'Tasks' tab of your Google Sheet! (at ${timeStr})`,
          type: 'success',
        });
      } else {
        setSheetSyncMessage({
          text: "The 'Tasks' tab in your Google Sheet is currently empty or has not been created yet.",
          type: 'info',
        });
      }
    } catch (err: any) {
      console.error('Error loading tasks from Google Sheet:', err);
      setSheetSyncMessage({
        text: err.message || 'Failed to load tasks from Google Sheet. Ensure the sheet is shared with "Anyone with the link can view".',
        type: 'error',
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending');
  const [formCategory, setFormCategory] = useState('Design & Web');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<TaskSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Statistics
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in-progress').length;
  const inReviewCount = tasks.filter((t) => t.status === 'in-review').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchCategory = task.category.toLowerCase().includes(q);
      const matchTags = task.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchCategory && !matchTags) {
        return false;
      }
    }

    // Status filter
    if (selectedStatus !== 'all' && task.status !== selectedStatus) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'All' && task.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  // Toggle subtask completion (persists in real-time to Cloud Firestore)
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    let updatedTaskItem: TaskItem | null = null;
    const updated = tasks.map((t) => {
      if (t.id !== taskId || !t.subtasks) return t;
      const updatedSubtasks = t.subtasks.map((st) =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      );
      // Auto-update status if all subtasks completed
      const allDone = updatedSubtasks.every((st) => st.completed);
      updatedTaskItem = {
        ...t,
        subtasks: updatedSubtasks,
        status: allDone && t.status !== 'completed' ? ('completed' as TaskStatus) : t.status,
      };
      return updatedTaskItem;
    });
    onUpdateTasks(updated);

    if (updatedTaskItem) {
      try {
        await saveTaskToFirestore(updatedTaskItem);
      } catch (err) {
        console.error('Failed to sync subtask to cloud:', err);
      }
    }
  };

  // Change task status (persists in real-time to Cloud Firestore)
  const handleChangeStatus = async (taskId: string, newStatus: TaskStatus) => {
    let updatedTaskItem: TaskItem | null = null;
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        updatedTaskItem = {
          ...t,
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
        };
        return updatedTaskItem;
      }
      return t;
    });
    onUpdateTasks(updated);

    if (updatedTaskItem) {
      try {
        await saveTaskToFirestore(updatedTaskItem);
      } catch (err) {
        console.error('Failed to sync status change to cloud:', err);
      }
    }
  };

  // Delete task (removes from Cloud Firestore so all devices update live)
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      markTaskAsDeleted(taskId);
      const updated = tasks.filter((t) => t.id !== taskId);
      onUpdateTasks(updated);

      try {
        await deleteTaskFromFirestore(taskId);
      } catch (err) {
        console.error('Failed to delete task from cloud:', err);
      }
    }
  };

  // Duplicate an existing task
  const handleDuplicateTask = async (task: TaskItem, openForEditing: boolean = false) => {
    const newId = `task-${Date.now()}`;
    const duplicatedSubtasks: TaskSubtask[] = (task.subtasks || []).map((st, idx) => ({
      id: `st-${Date.now()}-${idx}`,
      title: st.title,
      completed: false, // Reset completion status for fresh task
    }));

    const duplicatedItem: TaskItem = {
      ...task,
      id: newId,
      title: `${task.title} (Copy)`,
      description: task.description || '',
      notes: task.notes || '',
      priority: task.priority,
      status: task.status === 'completed' ? 'pending' : task.status,
      category: task.category,
      dueDate: task.dueDate || '',
      subtasks: duplicatedSubtasks,
      tags: task.tags ? [...task.tags] : [],
      createdAt: new Date().toISOString(),
      completedAt: undefined,
    };

    const updated = [duplicatedItem, ...tasks];
    onUpdateTasks(updated);

    try {
      await saveTaskToFirestore(duplicatedItem);
    } catch (err) {
      console.error('Failed to sync duplicated task to cloud:', err);
    }

    setSheetSyncMessage({
      type: 'success',
      text: `Duplicated "${task.title}". New copy "${duplicatedItem.title}" created.`,
    });
    setTimeout(() => {
      setSheetSyncMessage(null);
    }, 4500);

    if (openForEditing) {
      handleOpenEditModal(duplicatedItem);
    } else if (isModalOpen) {
      setIsModalOpen(false);
    }
  };

  // Toggle expanded details
  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Open modal for new task
  const handleOpenAddModal = (presetStatus: TaskStatus = 'pending') => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormStatus(presetStatus);
    setFormCategory('Design & Web');
    setFormDueDate('');
    setFormTags('');
    setFormSubtasks([]);
    setNewSubtaskTitle('');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormStatus(task.status);
    setFormCategory(task.category);
    setFormDueDate(task.dueDate || '');
    setFormTags(task.tags ? task.tags.join(', ') : '');
    setFormSubtasks(task.subtasks || []);
    setNewSubtaskTitle('');
    setIsModalOpen(true);
  };

  // Add subtask to form
  const handleAddFormSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setFormSubtasks((prev) => [
      ...prev,
      { id: `st-${Date.now()}`, title: newSubtaskTitle.trim(), completed: false },
    ]);
    setNewSubtaskTitle('');
  };

  // Remove subtask from form
  const handleRemoveFormSubtask = (id: string) => {
    setFormSubtasks((prev) => prev.filter((st) => st.id !== id));
  };

  // Save task from modal (immediately propagates across all devices via Firestore)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    let savedItem: TaskItem;

    if (editingTask) {
      // Update existing
      savedItem = {
        ...editingTask,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        priority: 'Medium',
        status: formStatus,
        category: formCategory,
        dueDate: formDueDate || undefined,
        subtasks: formSubtasks.length > 0 ? formSubtasks : undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        completedAt: formStatus === 'completed' ? editingTask.completedAt || new Date().toISOString() : undefined,
      };
      const updated = tasks.map((t) => (t.id === editingTask.id ? savedItem : t));
      onUpdateTasks(updated);
    } else {
      // Create new
      savedItem = {
        id: `task-${Date.now()}`,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        priority: 'Medium',
        status: formStatus,
        category: formCategory,
        dueDate: formDueDate || undefined,
        subtasks: formSubtasks.length > 0 ? formSubtasks : undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        createdAt: new Date().toISOString(),
        completedAt: formStatus === 'completed' ? new Date().toISOString() : undefined,
      };
      onUpdateTasks([savedItem, ...tasks]);
    }

    setIsModalOpen(false);

    try {
      await saveTaskToFirestore(savedItem);
      setSheetSyncMessage({
        text: `Task "${savedItem.title}" saved & synced across all devices!`,
        type: 'success',
      });
    } catch (err: any) {
      console.warn('Failed to sync task to cloud:', err);
      setSheetSyncMessage({
        text: `Task "${savedItem.title}" saved locally.`,
        type: 'success',
      });
    }
  };

  // Export tasks as CSV
  const handleExportCsv = () => {
    const headers = ['Task ID', 'Title', 'Status', 'Category', 'Due Date', 'Subtasks Progress'];
    const rows = tasks.map((t) => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      `"${t.category}"`,
      t.dueDate || '',
      t.subtasks ? `${t.subtasks.filter((s) => s.completed).length}/${t.subtasks.length}` : '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vzone_tasks_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-800 antialiased font-sans pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* View-Only Notice Banner */}
        {isViewOnly && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-amber-950">
                  Viewing in Read-Only Mode
                </p>
                <p className="text-[11px] text-amber-800">
                  Tasks, subtasks, notes, and statuses cannot be modified by viewers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onShareViewLink && (
                <button
                  type="button"
                  onClick={onShareViewLink}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                >
                  Share View Link
                </button>
              )}
              {onUnlockEditor && (
                <button
                  type="button"
                  onClick={onUnlockEditor}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Unlock Editor
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Bar & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
          <div className="flex items-start sm:items-center gap-3">
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-teal-800 hover:bg-teal-50 hover:border-teal-300 font-medium text-xs sm:text-sm shadow-2xs transition-all cursor-pointer group"
              title="Return to deliverables dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-5 w-px bg-slate-300 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-900 uppercase tracking-wider">
                  Task Manager
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  VZone Marketing Operations
                </span>
                {isViewOnly && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    Read-Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                  Current Tasks & Action Items
                </h1>
                {!isViewOnly && onUpdateTasksListNote && !isEditingNote && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft(tasksListNote || '');
                      setIsEditingNote(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-teal-800 bg-slate-100 hover:bg-teal-50 border border-slate-200 transition-colors cursor-pointer"
                    title="Add or edit a note for Tasks"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-teal-600" />
                    <span>{tasksListNote ? 'Edit note' : '+ Note'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
              title="Download tasks as CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {!isViewOnly && (
              <button
                onClick={() => handleOpenAddModal('pending')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Task List Note Banner / Editor */}
        {!isViewOnly && isEditingNote ? (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-300">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-amber-900">Task List Note</label>
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note for Tasks & action items..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (onUpdateTasksListNote) onUpdateTasksListNote(noteDraft.trim());
                    setIsEditingNote(false);
                  }
                  if (e.key === 'Escape') setIsEditingNote(false);
                }}
              />
              <div className="flex items-center justify-end gap-2">
                {tasksListNote && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateTasksListNote) onUpdateTasksListNote('');
                      setNoteDraft('');
                      setIsEditingNote(false);
                    }}
                    className="px-2.5 py-1 rounded text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingNote(false)}
                  className="px-2.5 py-1 rounded text-slate-500 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateTasksListNote) onUpdateTasksListNote(noteDraft.trim());
                    setIsEditingNote(false);
                  }}
                  className="px-3 py-1 rounded bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Save note
                </button>
              </div>
            </div>
          </div>
        ) : tasksListNote ? (
          <div className="mb-5 px-3.5 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-amber-950 min-w-0">
              <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="font-medium break-words leading-relaxed">{tasksListNote}</span>
            </div>
            {!isViewOnly && onUpdateTasksListNote && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(tasksListNote);
                    setIsEditingNote(true);
                  }}
                  className="p-1 text-amber-700 hover:text-amber-950 cursor-pointer"
                  title="Edit note"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateTasksListNote('')}
                  className="p-1 text-amber-700 hover:text-rose-600 cursor-pointer"
                  title="Remove note"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Sync notification message banner if present */}
        {sheetSyncMessage && (
          <div
            className={`mb-5 p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 shadow-2xs transition-all ${
              sheetSyncMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : sheetSyncMessage.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {sheetSyncMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{sheetSyncMessage.text}</span>
            </div>
            <button
              onClick={() => setSheetSyncMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Real-Time Cloud Database & Google Sheets Sync Bar */}
        <div className="mb-6 p-4 rounded-xl bg-white border border-teal-200/90 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900">
                    Real-Time Cloud & Sheet Sync
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Live Cloud Sync: All Devices
                  </span>
                  {authUser ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      Signed in: {authUser.email}
                    </span>
                  ) : null}
                  {lastSheetSyncTime && (
                    <span className="text-[11px] text-slate-400">
                      (Last synced at {lastSheetSyncTime})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tasks are automatically synchronized across all computers and phones in real time via Cloud Firestore. Anyone on any device can see updates immediately without logging in!
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
              {/* Fetch / Refresh from Sheet (NO LOGIN NEEDED) */}
              <button
                onClick={handleLoadFromSheet}
                disabled={isSyncingSheets || isPublicLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Fetch latest tasks from the Google Sheet without requiring any login"
              >
                <DownloadCloud className={`w-3.5 h-3.5 text-white ${isPublicLoading ? 'animate-spin' : ''}`} />
                <span>{isPublicLoading ? 'Loading Tasks...' : 'Fetch from Sheet'}</span>
              </button>

              {/* Export tasks as CSV */}
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                title="Export current tasks to CSV file"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              {!authUser ? (
                /* Google Sign In option */
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Sign in with Google"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>{isLoggingIn ? 'Connecting...' : 'Sign in'}</span>
                </button>
              ) : (
                /* Sign out */
                <button
                  onClick={handleGoogleSignOut}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title={`Sign out (${authUser.email})`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Edit Sheet link */}
              <button
                onClick={() => setIsSettingSheetUrl(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
                title="Change linked Google Sheet URL"
              >
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{sheetId ? 'Sheet Link' : 'Set Sheet Link'}</span>
              </button>

              {/* Open Google Sheet in new tab */}
              {activeSheetUrl && (
                <a
                  href={activeSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
                  title="Open Google Sheet in a new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Open Sheet</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Task Statistics KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Tasks</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {totalTasks}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">All registered tasks</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>In Progress</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-900">
              {inProgressCount}
            </div>
            <p className="mt-1 text-[11px] text-amber-700">Actively being worked on</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-l-4 border-l-purple-500 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>In Review</span>
              <AlertCircle className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-purple-900">
              {inReviewCount}
            </div>
            <p className="mt-1 text-[11px] text-purple-700">Awaiting review/approval</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-900">
              {completedCount}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                {completionPercentage}%
              </span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Pending Tasks</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-900">
              {pendingCount}
            </div>
            <p className="mt-1 text-[11px] text-amber-700">Awaiting kick-off</p>
          </div>
        </div>

        {/* Toolbar: Search, Filters, View Modes */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks by title, category, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns and View Switch */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category selector */}
              <div className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Tabs if in list view */}
              {viewMode === 'list' && (
                <div className="inline-flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-medium">Status:</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="in-review">In Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              )}

              {/* View Switch: Kanban vs List */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs ml-auto sm:ml-0">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    viewMode === 'kanban'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Kanban columns view"
                >
                  <Kanban className="w-3.5 h-3.5 text-teal-700" />
                  <span>Kanban</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Detailed list view"
                >
                  <ListIcon className="w-3.5 h-3.5 text-teal-700" />
                  <span>List</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Empty Search / Filter State */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No matching tasks found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No tasks matched your current search filters. Try clearing the search query or reset your filters.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStatus('all');
                  setSelectedCategory('All');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                Clear all filters
              </button>
              <button
                onClick={() => handleOpenAddModal('pending')}
                className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
              >
                Create new task
              </button>
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          /* ============================================================== */
          /* VIEW 1: KANBAN BOARD VIEW */
          /* ============================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {STATUS_COLUMNS.map((col) => {
              const columnTasks = filteredTasks.filter((t) => t.status === col.id);

              return (
                <div
                  key={col.id}
                  className={`bg-slate-50/80 rounded-xl border ${col.borderColor} p-3.5 flex flex-col min-h-[500px] shadow-2xs`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      {col.icon}
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        {col.title}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${col.badgeBg} ${col.badgeText}`}
                    >
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tasks in Column */}
                  <div className="space-y-3 flex-1">
                    {columnTasks.map((task) => {
                      const isExpanded = expandedTaskIds.has(task.id);
                      const completedSubtasks =
                        task.subtasks?.filter((st) => st.completed).length || 0;
                      const totalSubtasks = task.subtasks?.length || 0;

                      return (
                        <div
                          key={task.id}
                          className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group"
                        >
                          <div>
                            {/* Badges: Category */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {task.category}
                              </span>
                            </div>

                            {/* Task Title */}
                            <h4
                              onClick={!isViewOnly ? () => handleOpenEditModal(task) : undefined}
                              className={`text-xs sm:text-sm font-bold text-slate-900 leading-snug transition-colors ${
                                !isViewOnly ? 'group-hover:text-teal-700 cursor-pointer' : 'cursor-default'
                              }`}
                            >
                              {task.title}
                            </h4>

                            {/* Task Description */}
                            {task.description && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Subtasks Progress & Prominent Collapsible Toggle */}
                            {totalSubtasks > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5">
                                  <span className="font-semibold text-slate-600">
                                    Subtasks ({completedSubtasks}/{totalSubtasks})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(task.id)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${
                                      isExpanded
                                        ? 'bg-teal-700 text-white border-teal-800 hover:bg-teal-800'
                                        : 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100 hover:border-teal-400'
                                    }`}
                                    title={isExpanded ? 'Collapse subtask checklist' : 'Expand subtask checklist'}
                                  >
                                    <ListChecks className="w-3.5 h-3.5" />
                                    <span>{isExpanded ? 'Hide' : 'Expand'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-teal-600 h-full rounded-full transition-all"
                                    style={{
                                      width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                                    }}
                                  />
                                </div>

                                {/* Collapsible checkable subtask list */}
                                {isExpanded && (
                                  <div className="mt-2 p-2.5 bg-slate-50/90 rounded-lg border border-slate-200/90 space-y-1.5 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      <span>Checklist items</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleExpand(task.id)}
                                        className="text-teal-700 hover:text-teal-900 cursor-pointer font-bold"
                                      >
                                        Collapse
                                      </button>
                                    </div>
                                    <div className="space-y-1 mt-1">
                                      {task.subtasks?.map((st) => (
                                        <div
                                          key={st.id}
                                          onClick={!isViewOnly ? () => handleToggleSubtask(task.id, st.id) : undefined}
                                          className={`flex items-center gap-1.5 text-[11px] text-slate-700 select-none py-0.5 ${
                                            !isViewOnly ? 'hover:text-slate-900 cursor-pointer' : 'cursor-default'
                                          }`}
                                        >
                                          {st.completed ? (
                                            <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                          ) : (
                                            <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          )}
                                          <span
                                            className={
                                              st.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                            }
                                          >
                                            {st.title}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer: Due date & Quick Status Transition */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                            {task.dueDate && (
                              <div className="flex items-center gap-1 font-medium text-slate-500 text-[11px]">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>Due: {task.dueDate}</span>
                              </div>
                            )}

                            {/* Quick Status Shift Buttons */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                              <div className="flex items-center gap-1">
                                {isViewOnly ? (
                                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {task.status}
                                  </span>
                                ) : (
                                  <select
                                    value={task.status}
                                    onChange={(e) =>
                                      handleChangeStatus(task.id, e.target.value as TaskStatus)
                                    }
                                    className="text-[10px] font-medium bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="in-review">In Review</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                )}
                              </div>

                              {!isViewOnly && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDuplicateTask(task)}
                                    className="p-1 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Duplicate Task"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditModal(task)}
                                    className="p-1 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Edit Task"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {columnTasks.length === 0 && (
                      <div className="h-28 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs">
                        <span>No tasks in this stage</span>
                      </div>
                    )}
                  </div>

                  {/* Add Task Quick Button at bottom of column */}
                  <button
                    onClick={() => handleOpenAddModal(col.id)}
                    className="mt-3 w-full py-1.5 px-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-teal-800 hover:border-teal-400 hover:bg-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to {col.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW 2: LIST VIEW */
          /* ============================================================== */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const isExpanded = expandedTaskIds.has(task.id);
                const completedSubtasks =
                  task.subtasks?.filter((st) => st.completed).length || 0;
                const totalSubtasks = task.subtasks?.length || 0;
                const isCompleted = task.status === 'completed';

                return (
                  <div
                    key={task.id}
                    className={`p-4 transition-colors hover:bg-slate-50/70 ${
                      isCompleted ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Checkbox & Details */}
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() =>
                            !isViewOnly &&
                            handleChangeStatus(
                              task.id,
                              isCompleted ? 'in-progress' : 'completed'
                            )
                          }
                          className={`mt-0.5 text-slate-400 transition-colors shrink-0 ${
                            !isViewOnly ? 'hover:text-teal-600 cursor-pointer' : 'cursor-default opacity-80'
                          }`}
                          title={!isViewOnly ? (isCompleted ? 'Mark incomplete' : 'Mark completed') : undefined}
                          disabled={isViewOnly}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-teal-600" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {/* Title */}
                            <span
                              onClick={!isViewOnly ? () => handleOpenEditModal(task) : undefined}
                              className={`text-sm font-bold transition-colors ${
                                !isViewOnly ? 'cursor-pointer hover:text-teal-700' : 'cursor-default'
                              } ${
                                isCompleted
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {task.title}
                            </span>

                            {/* Status */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                task.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : task.status === 'in-progress'
                                  ? 'bg-amber-50 text-amber-800'
                                  : task.status === 'in-review'
                                  ? 'bg-purple-50 text-purple-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {task.status}
                            </span>

                            {/* Category */}
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                              {task.category}
                            </span>
                          </div>

                          {/* Description */}
                          {task.description && (
                            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                              {task.description}
                            </p>
                          )}

                          {/* Due Date & Subtasks Meta */}
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">

                            {task.dueDate && (
                              <div className="flex items-center gap-1 font-medium text-slate-500">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Due: {task.dueDate}</span>
                              </div>
                            )}

                            {totalSubtasks > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(task.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                                  isExpanded
                                    ? 'bg-teal-700 text-white border-teal-800 hover:bg-teal-800'
                                    : 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100 hover:border-teal-400'
                                }`}
                                title={isExpanded ? 'Collapse subtasks checklist' : 'Expand subtasks checklist'}
                              >
                                <ListChecks className="w-3.5 h-3.5" />
                                <span>
                                  {isExpanded
                                    ? `Hide Subtasks (${completedSubtasks}/${totalSubtasks})`
                                    : `View Subtasks (${completedSubtasks}/${totalSubtasks})`}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Subtasks checklist if expanded */}
                          {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                            <div className="mt-3 p-3 bg-slate-50/90 rounded-lg border border-slate-200/90 space-y-2 max-w-xl animate-in fade-in duration-150">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                  Subtask Checklist ({completedSubtasks}/{totalSubtasks} done):
                                </p>
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(task.id)}
                                  className="text-xs text-teal-700 hover:text-teal-900 font-bold cursor-pointer"
                                >
                                  Collapse
                                </button>
                              </div>
                              <div className="space-y-1 mt-1">
                              {task.subtasks.map((st) => (
                                <div
                                  key={st.id}
                                  onClick={!isViewOnly ? () => handleToggleSubtask(task.id, st.id) : undefined}
                                  className={`flex items-center gap-2 text-xs text-slate-700 select-none ${
                                    !isViewOnly ? 'hover:text-slate-900 cursor-pointer' : 'cursor-default'
                                  }`}
                                >
                                  {st.completed ? (
                                    <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <span
                                    className={
                                      st.completed ? 'line-through text-slate-400' : ''
                                    }
                                  >
                                    {st.title}
                                  </span>
                                </div>
                              ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isViewOnly ? (
                          <span className="text-xs font-semibold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600">
                            {task.status}
                          </span>
                        ) : (
                          <>
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleChangeStatus(task.id, e.target.value as TaskStatus)
                              }
                              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            >
                              <option value="pending">Pending</option>
                              <option value="in-progress">In Progress</option>
                              <option value="in-review">In Review</option>
                              <option value="completed">Completed</option>
                            </select>

                            <button
                              onClick={() => handleDuplicateTask(task)}
                              className="p-1.5 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Duplicate Task"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(task)}
                              className="p-1.5 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Task"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* ADD / EDIT TASK MODAL */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <span>{editingTask ? 'Edit Task Details' : 'Create New Task'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Organize deliverables, assign responsibility, and track execution steps.
            </p>

            <form onSubmit={handleSaveModal} className="mt-4 space-y-4">
              {/* Task Title */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Produce 2 Reels demonstrating fuel level alerts"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description & Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide background, guidelines, client instructions, or deliverables details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Status & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="in-review">In Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Video Production"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Subtasks / Checklist */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Subtask Checklist
                </label>
                <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
                  {formSubtasks.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded border border-slate-200 text-xs"
                    >
                      <span className="truncate">{st.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormSubtask(st.id)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add checklist item (e.g. Voiceover audio recording)"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newSubtaskTitle.trim()) {
                          setFormSubtasks((prev) => [
                            ...prev,
                            {
                              id: `st-${Date.now()}`,
                              title: newSubtaskTitle.trim(),
                              completed: false,
                            },
                          ]);
                          setNewSubtaskTitle('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFormSubtask}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Video, Instagram, Q4 Campaign"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
                <div>
                  {editingTask && (
                    <button
                      type="button"
                      onClick={() => handleDuplicateTask(editingTask, true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors cursor-pointer"
                      title="Duplicate this task and edit the copy"
                    >
                      <Copy className="w-3.5 h-3.5 text-teal-700" />
                      <span>Duplicate Task</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    {editingTask ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Link/Change Google Sheet URL Modal */}
      {isSettingSheetUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
                  <Link2 className="w-4 h-4 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Google Sheet for Tasks
                  </h3>
                  <p className="text-xs text-slate-500">
                    Specify which Google Sheet to store and sync your tasks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingSheetUrl(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Google Sheet URL or ID
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs..."
                  value={targetSheetUrl}
                  onChange={(e) => setTargetSheetUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="bg-teal-50 p-3 rounded-lg border border-teal-200 text-xs text-teal-900 leading-relaxed">
                <p className="font-semibold mb-1">What happens when you link a sheet:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-teal-800">
                  <li>A dedicated <span className="font-semibold">'Tasks'</span> tab is created automatically in the spreadsheet.</li>
                  <li>Tasks can be saved or loaded anytime with your Google account.</li>
                  <li>Ensure your Google account has edit permissions on the spreadsheet.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsSettingSheetUrl(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (targetSheetUrl.trim()) {
                    if (onSheetSourceUrlChange) {
                      onSheetSourceUrlChange(targetSheetUrl.trim());
                    }
                    saveSharedSheetUrl(targetSheetUrl.trim()).catch(console.warn);
                  }
                  setIsSettingSheetUrl(false);
                }}
                className="px-5 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-xs transition-colors"
              >
                Save Sheet Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
