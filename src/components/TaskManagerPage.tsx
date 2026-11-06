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
  User,
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
  Flame,
  FileSpreadsheet,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Link2,
  LogOut,
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
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

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
        if (!isCancelled && publicTasks && publicTasks.length > 0) {
          onUpdateTasks(publicTasks);
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

      if (fetchedTasks.length > 0) {
        onUpdateTasks(fetchedTasks);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSheetSyncTime(timeStr);
        setSheetSyncMessage({
          text: `Fetched ${fetchedTasks.length} tasks from the 'Tasks' tab of your Google Sheet! (at ${timeStr})`,
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
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium');
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending');
  const [formCategory, setFormCategory] = useState('Design & Web');
  const [formAssignedTo, setFormAssignedTo] = useState('');
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
  const highPriorityCount = tasks.filter((t) => t.priority === 'High' && t.status !== 'completed').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchAssignee = task.assignedTo?.toLowerCase().includes(q);
      const matchCategory = task.category.toLowerCase().includes(q);
      const matchTags = task.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchAssignee && !matchCategory && !matchTags) {
        return false;
      }
    }

    // Status filter
    if (selectedStatus !== 'all' && task.status !== selectedStatus) {
      return false;
    }

    // Priority filter
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
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
      const updated = tasks.filter((t) => t.id !== taskId);
      onUpdateTasks(updated);

      try {
        await deleteTaskFromFirestore(taskId);
      } catch (err) {
        console.error('Failed to delete task from cloud:', err);
      }
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
    setFormPriority('Medium');
    setFormStatus(presetStatus);
    setFormCategory('Design & Web');
    setFormAssignedTo('');
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
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormCategory(task.category);
    setFormAssignedTo(task.assignedTo || '');
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
        priority: formPriority,
        status: formStatus,
        category: formCategory,
        assignedTo: formAssignedTo.trim() || undefined,
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
        priority: formPriority,
        status: formStatus,
        category: formCategory,
        assignedTo: formAssignedTo.trim() || undefined,
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
    const headers = ['Task ID', 'Title', 'Status', 'Priority', 'Category', 'Assigned To', 'Due Date', 'Subtasks Progress'];
    const rows = tasks.map((t) => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      `"${t.category}"`,
      `"${t.assignedTo || ''}"`,
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
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                Current Tasks & Action Items
              </h1>
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

            <button
              onClick={() => handleOpenAddModal('pending')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Task</span>
            </button>
          </div>
        </div>

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

          <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-xl border border-slate-200/90 border-l-4 border-l-rose-500 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>High Priority</span>
              <Flame className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-900">
              {highPriorityCount}
            </div>
            <p className="mt-1 text-[11px] text-rose-700">Pending urgent delivery</p>
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
                placeholder="Search tasks by title, assignee, category, or tags..."
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

              {/* Priority selector */}
              <div className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Priority:</span>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
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
                  setSelectedPriority('all');
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
                      const completedSubtasks =
                        task.subtasks?.filter((st) => st.completed).length || 0;
                      const totalSubtasks = task.subtasks?.length || 0;

                      return (
                        <div
                          key={task.id}
                          className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group"
                        >
                          <div>
                            {/* Badges: Priority & Category */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  task.priority === 'High'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : task.priority === 'Medium'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {task.priority} Priority
                              </span>

                              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                {task.category}
                              </span>
                            </div>

                            {/* Task Title */}
                            <h4
                              onClick={() => handleOpenEditModal(task)}
                              className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-teal-700 cursor-pointer transition-colors leading-snug"
                            >
                              {task.title}
                            </h4>

                            {/* Task Description */}
                            {task.description && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Subtasks Progress if any */}
                            {totalSubtasks > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
                                  <span>Checklist</span>
                                  <span>
                                    {completedSubtasks}/{totalSubtasks} done
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-teal-600 h-full rounded-full transition-all"
                                    style={{
                                      width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                                    }}
                                  />
                                </div>

                                {/* Checkable subtask list on expand or quick preview */}
                                <div className="mt-2 space-y-1">
                                  {task.subtasks?.map((st) => (
                                    <div
                                      key={st.id}
                                      onClick={() => handleToggleSubtask(task.id, st.id)}
                                      className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer select-none"
                                    >
                                      {st.completed ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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

                          {/* Footer: Assignee, Due date & Quick Status Transition */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              {task.assignedTo ? (
                                <div className="flex items-center gap-1 font-medium text-slate-700">
                                  <div className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 text-[9px] font-bold flex items-center justify-center">
                                    {task.assignedTo.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="truncate max-w-[100px]">
                                    {task.assignedTo}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Unassigned</span>
                              )}

                              {task.dueDate && (
                                <div className="flex items-center gap-1 font-medium text-slate-500">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>{task.dueDate}</span>
                                </div>
                              )}
                            </div>

                            {/* Quick Status Shift Buttons */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                              <div className="flex items-center gap-1">
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
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(task)}
                                  className="p-1 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100"
                                  title="Edit Task"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
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
                            handleChangeStatus(
                              task.id,
                              isCompleted ? 'in-progress' : 'completed'
                            )
                          }
                          className="mt-0.5 text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                          title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
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
                              onClick={() => handleOpenEditModal(task)}
                              className={`text-sm font-bold cursor-pointer transition-colors ${
                                isCompleted
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900 hover:text-teal-700'
                              }`}
                            >
                              {task.title}
                            </span>

                            {/* Priority */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                task.priority === 'High'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : task.priority === 'Medium'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {task.priority}
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

                          {/* Assignee & Due Date Meta */}
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                            {task.assignedTo && (
                              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                                <User className="w-3.5 h-3.5 text-teal-600" />
                                <span>{task.assignedTo}</span>
                              </div>
                            )}

                            {task.dueDate && (
                              <div className="flex items-center gap-1 font-medium text-slate-500">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Due: {task.dueDate}</span>
                              </div>
                            )}

                            {totalSubtasks > 0 && (
                              <button
                                onClick={() => toggleExpand(task.id)}
                                className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                              >
                                <span>
                                  {completedSubtasks}/{totalSubtasks} subtasks
                                </span>
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Subtasks checklist if expanded */}
                          {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2 max-w-xl">
                              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Subtask Checklist:
                              </p>
                              {task.subtasks.map((st) => (
                                <div
                                  key={st.id}
                                  onClick={() => handleToggleSubtask(task.id, st.id)}
                                  className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none"
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
                          )}
                        </div>
                      </div>

                      {/* Right action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
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
                          onClick={() => handleOpenEditModal(task)}
                          className="p-1.5 text-slate-400 hover:text-teal-700 rounded hover:bg-slate-100"
                          title="Edit Task"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

              {/* Status, Priority, Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
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

              {/* Assignee & Due Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Assigned To
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Anwar sir, Media Team, UI Designer"
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

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
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-xs transition-colors"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
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
