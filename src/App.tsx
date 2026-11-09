/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initialDashboardData } from './data/initialData';
import { DashboardData, WorkItem, SyncSettings, TaskItem } from './types';
import { Sidebar } from './components/Sidebar';
import { BrandTopBar } from './components/BrandTopBar';
import { BrandKpiCards } from './components/BrandKpiCards';
import { BrandMonthSelector } from './components/BrandMonthSelector';
import { BrandWorksCompleted } from './components/BrandWorksCompleted';
import { BrandOutputMix } from './components/BrandOutputMix';
import { BrandTasksWidget } from './components/BrandTasksWidget';
import { UploadSheetModal } from './components/UploadSheetModal';
import { TaskManagerPage } from './components/TaskManagerPage';
import { exportToCsv } from './utils/sheetParser';
import { getWorksForSelectedMonth, isSameMonth } from './utils/monthHelper';
import {
  saveDashboardToStorage,
  loadDashboardFromStorage,
  clearDashboardFromStorage,
  StorageMeta,
  loadSyncSettingsFromStorage,
  saveSyncSettingsToStorage,
} from './utils/storage';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  isTaskDeleted,
} from './utils/taskStorage';
import {
  fetchAndParseGoogleSheet,
} from './utils/googleSheetSync';
import { fetchTasksPubliclyFromGoogleSheet } from './utils/googleSheetsTasksSync';
import {
  subscribeToFirestoreTasks,
  subscribeToSharedSheetUrl,
  saveSharedSheetUrl,
  saveSharedDashboardData,
  subscribeToSharedDashboardData,
} from './utils/firestoreTasks';
import {
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData>(initialDashboardData);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialDashboardData.selectedMonth || 'Oct 2026'
  );
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedInStorage, setIsSavedInStorage] = useState(false);
  const [savedMeta, setSavedMeta] = useState<StorageMeta | null>(null);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(loadSyncSettingsFromStorage());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Routing: 'dashboard' or 'tasks'
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'tasks'>(() => {
    return typeof window !== 'undefined' && window.location.hash === '#tasks'
      ? 'tasks'
      : 'dashboard';
  });

  // View-Only Mode determination:
  // Default to true for incognito or new visitors from shared link!
  const [isViewOnly, setIsViewOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === '1' || params.get('mode') === 'edit' || params.get('admin') === '1') {
      try {
        localStorage.setItem('vzone_role', 'editor');
      } catch {}
      return false;
    }
    if (params.get('view') === '1' || params.get('readonly') === '1' || params.get('mode') === 'view') {
      return true;
    }
    try {
      const stored = localStorage.getItem('vzone_role');
      if (stored === 'editor') return false;
      // If the owner has saved dashboard data before on this primary system, maintain editor
      const savedDash = localStorage.getItem('vzone_marketing_dashboard_v2');
      if (savedDash) {
        localStorage.setItem('vzone_role', 'editor');
        return false;
      }
    } catch {}
    // Anyone else defaults to View-Only Mode
    return true;
  });

  const [isEditorAuthorized, setIsEditorAuthorized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('vzone_role') === 'editor';
    } catch {
      return false;
    }
  });

  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Tasks state backed by localStorage
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasksFromStorage());

  // Listen to browser hash changes for Back/Forward and direct URLs
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#tasks') {
        setCurrentPage('tasks');
      } else {
        setCurrentPage('dashboard');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToTasks = () => {
    window.location.hash = 'tasks';
    setCurrentPage('tasks');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDashboard = () => {
    window.location.hash = '';
    setCurrentPage('dashboard');
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateTasks = (updated: TaskItem[]) => {
    setTasks(updated);
    saveTasksToStorage(updated);
  };

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  // Show temporary toast message
  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  const handleUnlockEditor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = unlockPasscode.trim().toLowerCase();
    // Default passcodes: 'vzone' or 'admin' or 'marketing'
    if (clean === 'vzone' || clean === 'admin' || clean === 'marketing') {
      try {
        localStorage.setItem('vzone_role', 'editor');
      } catch {}
      setIsViewOnly(false);
      setIsEditorAuthorized(true);
      setIsUnlockModalOpen(false);
      setUnlockPasscode('');
      setUnlockError(null);
      showToast('Editor mode unlocked! You can now add/edit notes and deliverables.');
    } else {
      setUnlockError('Incorrect passcode. Please try again (passcode: vzone).');
    }
  };

  const handleShareViewLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', '1');
      url.searchParams.delete('edit');
      url.searchParams.delete('admin');
      const shareUrl = url.toString();
      navigator.clipboard.writeText(shareUrl);
      showToast('View-only link copied! Anyone opening this will see read-only mode.');
    } catch {
      showToast('View-only link copied to clipboard!');
    }
  };

  const handleToggleViewPreview = () => {
    setIsViewOnly((prev) => {
      const next = !prev;
      showToast(next ? 'Previewing as Read-Only Viewer' : 'Returned to Editor Mode', 'info');
      return next;
    });
  };

  const dataRef = useRef(data);
  dataRef.current = data;

  const syncSettingsRef = useRef(syncSettings);
  syncSettingsRef.current = syncSettings;


  const handleUpdateSyncSettings = useCallback((newSettings: SyncSettings) => {
    setSyncSettings(newSettings);
    saveSyncSettingsToStorage(newSettings);
  }, []);

  // Core Google Sheet sync function
  const handleSyncGoogleSheet = useCallback(
    async (isSilent = false, overrideUrl?: string) => {
      const currentUrl = overrideUrl || dataRef.current.sheetSourceUrl;
      if (!currentUrl) return;

      if (!isSilent) {
        setIsSyncing(true);
      }
      setSyncError(null);

      try {
        const freshData = await fetchAndParseGoogleSheet(currentUrl);

        // Preserve all user-added notes (task notes, work list notes, custom item notes)
        const existingByActivity = new Map<string, WorkItem>();
        for (const w of dataRef.current.worksCompleted || []) {
          existingByActivity.set(w.activity.trim().toLowerCase(), w);
        }

        const mergedWorks = (freshData.worksCompleted || []).map((w) => {
          const match = existingByActivity.get(w.activity.trim().toLowerCase());
          if (match) {
            return {
              ...w,
              customNote: w.customNote || match.customNote,
              monthlyNotes: { ...(match.monthlyNotes || {}), ...(w.monthlyNotes || {}) },
            };
          }
          return w;
        });

        const mergedNotes = {
          ...(dataRef.current.workListNotes || {}),
          ...(freshData.workListNotes || {}),
        };

        const mergedData: DashboardData = {
          ...freshData,
          worksCompleted: mergedWorks,
          workListNotes: mergedNotes,
        };

        setData(mergedData);

        // Broadcast to Cloud Firestore so any user, device, or incognito tab sees the updated data with notes intact!
        saveSharedDashboardData(mergedData).catch(console.warn);
        if (currentUrl) {
          saveSharedSheetUrl(currentUrl).catch(console.warn);
        }

        if (freshData.tasks && freshData.tasks.length > 0) {
          const validTasks = freshData.tasks.filter((t) => !isTaskDeleted(t.id));
          handleUpdateTasks(validTasks);
        } else {
          try {
            const publicTasks = await fetchTasksPubliclyFromGoogleSheet(currentUrl);
            if (publicTasks.length > 0) {
              const validTasks = publicTasks.filter((t) => !isTaskDeleted(t.id));
              handleUpdateTasks(validTasks);
            }
          } catch {
            // Continue if Tasks tab not present
          }
        }

        const nowFormatted = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const updatedSettings: SyncSettings = {
          ...syncSettingsRef.current,
          lastSyncedAt: nowFormatted,
        };
        handleUpdateSyncSettings(updatedSettings);

        saveDashboardToStorage(mergedData);
        setIsSavedInStorage(true);
        setSavedMeta({
          savedAt: new Date().toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          fileName: mergedData.fileName,
          totalWorks: mergedData.worksCompleted.length,
        });

        if (!isSilent) {
          showToast(`Synced with Google Sheet! Updated ${mergedData.worksCompleted.length} deliverables.`);
        }
      } catch (err: any) {
        console.error('Google Sheet sync error:', err);
        setSyncError(err.message || 'Failed to sync with Google Sheet');
        if (!isSilent) {
          showToast(`Sync failed: ${err.message || 'Please check sheet sharing permissions.'}`, 'error');
        }
      } finally {
        if (!isSilent) {
          setIsSyncing(false);
        }
      }
    },
    [handleUpdateSyncSettings, showToast]
  );

  // Real-time synchronization from Cloud Firestore across all devices and incognito tabs
  useEffect(() => {
    // 1. Subscribe to tasks
    const unsubTasks = subscribeToFirestoreTasks((cloudTasks) => {
      if (Array.isArray(cloudTasks)) {
        const validTasks = cloudTasks.filter((t) => !isTaskDeleted(t.id));
        setTasks(validTasks);
        saveTasksToStorage(validTasks);
      }
    });

    // 2. Subscribe to shared sheet URL
    const unsubSheetUrl = subscribeToSharedSheetUrl((sharedUrl) => {
      if (sharedUrl && sharedUrl !== dataRef.current.sheetSourceUrl) {
        setData((prev) => ({ ...prev, sheetSourceUrl: sharedUrl }));
        if (syncSettingsRef.current.autoSync) {
          handleSyncGoogleSheet(true, sharedUrl);
        }
      }
    });

    // 3. Subscribe to active dashboard state (works completed, selected month, available months)
    const unsubDashboard = subscribeToSharedDashboardData((cloudDashboard) => {
      if (cloudDashboard && Array.isArray(cloudDashboard.worksCompleted) && cloudDashboard.worksCompleted.length > 0) {
        setData((prev) => {
          // Merge workListNotes so any existing notes in local state are never wiped
          const mergedNotes = {
            ...(prev.workListNotes || {}),
            ...(cloudDashboard.workListNotes || {}),
          };

          const existingByActivity = new Map<string, WorkItem>();
          for (const w of prev.worksCompleted || []) {
            existingByActivity.set(w.activity.trim().toLowerCase(), w);
          }

          const mergedWorks = cloudDashboard.worksCompleted.map((w) => {
            const match = existingByActivity.get(w.activity.trim().toLowerCase());
            return {
              ...w,
              customNote: w.customNote || match?.customNote,
              monthlyNotes: { ...(match?.monthlyNotes || {}), ...(w.monthlyNotes || {}) },
            };
          });

          const merged: DashboardData = {
            ...cloudDashboard,
            worksCompleted: mergedWorks,
            workListNotes: mergedNotes,
          };
          saveDashboardToStorage(merged);
          return merged;
        });

        setIsSavedInStorage(true);
        if (cloudDashboard.selectedMonth) {
          setSelectedMonth(cloudDashboard.selectedMonth);
        } else if (cloudDashboard.availableMonths && cloudDashboard.availableMonths.length > 0) {
          setSelectedMonth(cloudDashboard.availableMonths[cloudDashboard.availableMonths.length - 1]);
        }
      }
    });

    return () => {
      unsubTasks();
      unsubSheetUrl();
      unsubDashboard();
    };
  }, [handleSyncGoogleSheet]);

  // Sync selectedMonth when new data arrives
  useEffect(() => {
    if (data.selectedMonth) {
      setSelectedMonth(data.selectedMonth);
    } else if (data.availableMonths && data.availableMonths.length > 0) {
      setSelectedMonth(data.availableMonths[data.availableMonths.length - 1]);
    }
  }, [data.selectedMonth, data.availableMonths]);

  // Load from local storage on startup and broadcast to Firestore so any recipient/incognito tab gets the latest data
  useEffect(() => {
    const loaded = loadDashboardFromStorage();
    if (loaded && loaded.data) {
      // If loaded cache has older version (< 15 deliverables), upgrade to the new template
      if (!loaded.data.worksCompleted || loaded.data.worksCompleted.length < 15) {
        const upgraded = {
          ...initialDashboardData,
          workListNotes: loaded.data.workListNotes || {},
        };
        setData(upgraded);
        saveDashboardToStorage(upgraded);
        saveSharedDashboardData(upgraded).catch(console.warn);
      } else {
        setData(loaded.data);
        // Sync the user's loaded data to Cloud Firestore immediately
        saveSharedDashboardData(loaded.data).catch(console.warn);
        if (loaded.data.sheetSourceUrl) {
          saveSharedSheetUrl(loaded.data.sheetSourceUrl).catch(console.warn);
        }
      }
      setIsSavedInStorage(true);
      setSavedMeta(loaded.meta);

      if (loaded.data.sheetSourceUrl && syncSettingsRef.current.autoSync) {
        const timer = setTimeout(() => {
          handleSyncGoogleSheet(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    } else {
      setData(initialDashboardData);
    }
  }, [handleSyncGoogleSheet]);

  const handleSaveToLocalMemory = () => {
    saveDashboardToStorage(data);
    saveSharedDashboardData(data).catch(console.warn);
    if (data.sheetSourceUrl) {
      saveSharedSheetUrl(data.sheetSourceUrl).catch(console.warn);
    }
    setIsSavedInStorage(true);
    const meta = {
      savedAt: new Date().toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      fileName: data.fileName,
      totalWorks: data.worksCompleted.length,
    };
    setSavedMeta(meta);
    showToast('Dashboard data saved & synced to Cloud Firestore!');
  };

  const handleClearStorage = () => {
    clearDashboardFromStorage();
    setIsSavedInStorage(false);
    setSavedMeta(null);
    showToast('Saved dashboard memory cleared.', 'info');
  };

  const handleUpdateWorkItem = (id: string, updates: Partial<WorkItem>) => {
    if (isViewOnly) return;
    setData((prev) => {
      const updatedWorks = prev.worksCompleted.map((w) => {
        if (w.id === id || w.id.replace(/^all-/, '') === id.replace(/^all-/, '')) {
          const updatedBreakdown = w.monthlyBreakdown
            ? {
                ...w.monthlyBreakdown,
                ...(selectedMonth !== 'all' && updates.count !== undefined
                  ? { [selectedMonth]: updates.count }
                  : {}),
              }
            : undefined;

          // Strictly scope deliverable custom notes to selectedMonth
          const updatedMonthlyNotes = w.monthlyNotes ? { ...w.monthlyNotes } : {};
          if (updates.customNote !== undefined) {
            if (updates.customNote) {
              updatedMonthlyNotes[selectedMonth] = updates.customNote;
            } else {
              delete updatedMonthlyNotes[selectedMonth];
            }
          }

          // Root customNote only reflects when selectedMonth matches the item's primary month
          const rootCustomNote =
            updates.customNote !== undefined
              ? (w.month && isSameMonth(w.month, selectedMonth)) || selectedMonth === 'all'
                ? updates.customNote || undefined
                : w.customNote
              : w.customNote;

          return {
            ...w,
            ...updates,
            customNote: rootCustomNote,
            monthlyBreakdown: updatedBreakdown,
            monthlyNotes: updatedMonthlyNotes,
          };
        }
        return w;
      });
      const updatedDashboard: DashboardData = { ...prev, worksCompleted: updatedWorks };
      saveDashboardToStorage(updatedDashboard);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });
    setIsSavedInStorage(true);
    showToast('Work item updated & synced!');
  };

  const handleUpdateWorkListNote = (listKey: string, noteText: string) => {
    if (isViewOnly) return;
    setData((prev) => {
      const updatedNotes = {
        ...(prev.workListNotes || {}),
        [listKey]: noteText,
      };

      // If updating a task list note, synchronize both global 'tasks' and month-specific keys
      if (listKey === 'tasks' || listKey.startsWith('tasks_')) {
        updatedNotes['tasks'] = noteText;
        if (selectedMonth && selectedMonth !== 'all') {
          updatedNotes[`tasks_${selectedMonth}`] = noteText;
        }
        for (const m of prev.availableMonths || []) {
          updatedNotes[`tasks_${m}`] = noteText;
        }
      }

      const updatedDashboard: DashboardData = {
        ...prev,
        workListNotes: updatedNotes,
      };
      saveDashboardToStorage(updatedDashboard);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });
    setIsSavedInStorage(true);
    showToast(noteText ? 'Note saved!' : 'Note cleared.');
  };

  const handleAddWorkItem = (
    activity: string,
    count: number,
    category: string,
    notes?: string
  ) => {
    if (isViewOnly) return;
    const newId = `work-${Date.now()}`;
    const targetMonth = selectedMonth === 'all' ? (data.availableMonths?.[0] || 'Nov 2026') : selectedMonth;
    const newWork: WorkItem = {
      id: newId,
      activity,
      count,
      category,
      notes,
      customNote: notes || undefined,
      monthlyNotes: notes ? { [targetMonth]: notes } : undefined,
      month: targetMonth,
      monthlyBreakdown: {
        [targetMonth]: count,
      },
    };

    setData((prev) => {
      const updatedDashboard = {
        ...prev,
        worksCompleted: [newWork, ...prev.worksCompleted],
      };
      saveDashboardToStorage(updatedDashboard);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });
    setIsSavedInStorage(true);
    showToast(`Added deliverable "${activity}"!`);
  };

  const handleDeleteWorkItem = (id: string) => {
    if (isViewOnly) return;
    setData((prev) => {
      const updatedDashboard = {
        ...prev,
        worksCompleted: prev.worksCompleted.filter(
          (w) => w.id !== id && w.id.replace(/^all-/, '') !== id.replace(/^all-/, '')
        ),
      };
      saveDashboardToStorage(updatedDashboard);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });
    setIsSavedInStorage(true);
  };

  const handleExportCsv = () => {
    const currentPeriodData: DashboardData = {
      ...data,
      selectedMonth,
      worksCompleted: displayWorks,
    };
    const csvContent = exportToCsv(currentPeriodData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${data.fileName.replace(/\.[^/.]+$/, '')}_${selectedMonth.replace(/\s+/g, '_')}_export.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetData = () => {
    setData(initialDashboardData);
    saveSharedDashboardData(initialDashboardData).catch(console.warn);
    setSelectedMonth(initialDashboardData.selectedMonth || 'Nov 2026');
    setIsSavedInStorage(false);
    showToast('Reloaded sample report data.', 'info');
  };

  const handleDataLoaded = (newData: DashboardData, saveToLocalMemory: boolean = true) => {
    // Preserve any existing custom notes and workListNotes when importing updated counts
    const existingByActivity = new Map<string, WorkItem>();
    for (const w of dataRef.current.worksCompleted || []) {
      existingByActivity.set(w.activity.trim().toLowerCase(), w);
    }

    const mergedWorks = (newData.worksCompleted || []).map((w) => {
      const match = existingByActivity.get(w.activity.trim().toLowerCase());
      if (match) {
        return {
          ...w,
          customNote: w.customNote || match.customNote,
          monthlyNotes: { ...(match.monthlyNotes || {}), ...(w.monthlyNotes || {}) },
        };
      }
      return w;
    });

    const mergedData: DashboardData = {
      ...newData,
      worksCompleted: mergedWorks,
      workListNotes: {
        ...(dataRef.current.workListNotes || {}),
        ...(newData.workListNotes || {}),
      },
    };

    setData(mergedData);
    // Broadcast to Cloud Firestore so all recipients & incognito tabs get the new data in real time!
    saveSharedDashboardData(mergedData).catch(console.warn);
    if (mergedData.sheetSourceUrl) {
      saveSharedSheetUrl(mergedData.sheetSourceUrl).catch(console.warn);
    }

    if (mergedData.tasks && mergedData.tasks.length > 0) {
      handleUpdateTasks(mergedData.tasks);
    }
    if (mergedData.selectedMonth) {
      setSelectedMonth(mergedData.selectedMonth);
    } else if (mergedData.availableMonths && mergedData.availableMonths.length > 0) {
      setSelectedMonth(mergedData.availableMonths[mergedData.availableMonths.length - 1]);
    }

    if (saveToLocalMemory) {
      saveDashboardToStorage(mergedData);
      setIsSavedInStorage(true);
      const meta = {
        savedAt: new Date().toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        fileName: mergedData.fileName,
        totalWorks: mergedData.worksCompleted.length,
      };
      setSavedMeta(meta);
      showToast(`Imported ${mergedData.fileName} & synced to Cloud Firestore!`);
    } else {
      setIsSavedInStorage(false);
      showToast(`Imported ${mergedData.fileName} and broadcast to live dashboard.`);
    }
  };

  // Filtered deliverables for current selected month:
  const monthWorks = getWorksForSelectedMonth(
    data.worksCompleted,
    selectedMonth,
    data.availableMonths || []
  );

  // Filter by search query if any
  const filteredWorks = searchQuery.trim()
    ? monthWorks.filter(
        (w) =>
          w.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : monthWorks;

  const displayWorks = filteredWorks.filter((w) => (w.count || 0) > 0);

  const currentPeriodData: DashboardData = {
    ...data,
    selectedMonth,
    worksCompleted: displayWorks,
  };

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const totalDeliverablesCount = (data.worksCompleted || []).reduce((acc, curr) => acc + (curr.count || 0), 0);

  // If on Task Manager page, render sidebar + Task Manager
  if (currentPage === 'tasks') {
    return (
      <div className="min-h-screen bg-[#F6F8FB] text-slate-800 antialiased font-sans flex flex-col md:flex-row">
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            if (page === 'dashboard') navigateToDashboard();
          }}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          data={data}
          isSavedInStorage={isSavedInStorage}
          onExportCsv={handleExportCsv}
          onSaveToMemory={handleSaveToLocalMemory}
          onResetData={handleResetData}
          onOpenSheetModal={() => setIsSheetModalOpen(true)}
          totalDeliverablesCount={totalDeliverablesCount}
          activeTasksCount={activeTasks.length}
          isViewOnly={isViewOnly}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <TaskManagerPage
            tasks={tasks}
            onUpdateTasks={handleUpdateTasks}
            onBackToDashboard={navigateToDashboard}
            sheetSourceUrl={data.sheetSourceUrl}
            onSheetSourceUrlChange={(newUrl) => {
              setData((prev) => ({ ...prev, sheetSourceUrl: newUrl }));
              saveSharedSheetUrl(newUrl).catch(console.warn);
            }}
            tasksListNote={
              data.workListNotes?.['tasks'] ||
              (selectedMonth ? data.workListNotes?.[`tasks_${selectedMonth}`] : '') ||
              ''
            }
            onUpdateTasksListNote={(note) => handleUpdateWorkListNote('tasks', note)}
            isViewOnly={isViewOnly}
            onUnlockEditor={() => setIsUnlockModalOpen(true)}
            onShareViewLink={handleShareViewLink}
          />
        </main>

        <UploadSheetModal
          isOpen={isSheetModalOpen}
          onClose={() => setIsSheetModalOpen(false)}
          onDataLoaded={handleDataLoaded}
          currentSheetUrl={data.sheetSourceUrl || ''}
          syncSettings={syncSettings}
          onUpdateSyncSettings={handleUpdateSyncSettings}
        />

        {/* Passcode Unlock Editor Modal */}
        {isUnlockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 text-[#E11D74] flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Unlock Editor Mode</h3>
                </div>
                <button
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setUnlockPasscode('');
                    setUnlockError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Enter passcode to unlock editor mode and manage deliverables, tasks, and notes (default: <strong className="text-slate-800">vzone</strong>).
              </p>

              <form onSubmit={handleUnlockEditor} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Passcode
                  </label>
                  <input
                    type="password"
                    placeholder="Enter passcode (e.g. vzone)"
                    value={unlockPasscode}
                    onChange={(e) => {
                      setUnlockPasscode(e.target.value);
                      setUnlockError(null);
                    }}
                    autoFocus
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E11D74]"
                  />
                  {unlockError && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{unlockError}</p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnlockModalOpen(false);
                      setUnlockPasscode('');
                      setUnlockError(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#E11D74] hover:bg-[#c91464] text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Dashboard Main View (Exact match to uploaded brand UI screenshot)
  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-800 antialiased font-sans flex flex-col md:flex-row selection:bg-[#E11D74] selection:text-white">
      {/* LEFT SIDEBAR */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          if (page === 'tasks') navigateToTasks();
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        data={data}
        isSavedInStorage={isSavedInStorage}
        onExportCsv={handleExportCsv}
        onSaveToMemory={handleSaveToLocalMemory}
        onResetData={handleResetData}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        totalDeliverablesCount={totalDeliverablesCount}
        activeTasksCount={activeTasks.length}
        isViewOnly={isViewOnly}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-[1320px] mx-auto">
          {/* Toast Notification */}
          {toastMessage && (
            <div
              className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                toastMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : toastMessage.type === 'info'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMessage.text}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Top Breadcrumb & Action Tools Bar */}
          <BrandTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onExportCsv={handleExportCsv}
            onOpenTaskManager={navigateToTasks}
            isViewOnly={isViewOnly}
            onUnlockEditor={() => setIsUnlockModalOpen(true)}
            onShareViewLink={handleShareViewLink}
            onToggleViewPreview={handleToggleViewPreview}
            isEditorAuthorized={isEditorAuthorized}
          />

          {/* Header Row: Title & Month Segmented Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E11D74]">
                  Monthly Report Dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Latest month</span>
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1D1B48] tracking-tight">
                {selectedMonth === 'all' ? 'All Months Overview' : selectedMonth}
              </h1>

              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
                {displayWorks.reduce((acc, curr) => acc + curr.count, 0)} deliverables completed across{' '}
                {displayWorks.length} work streams.
              </p>
            </div>

            {/* Segmented Month Switcher Pill */}
            <BrandMonthSelector
              availableMonths={data.availableMonths || ['Sep 2026', 'Oct 2026']}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              allWorks={data.worksCompleted}
            />
          </div>

          {/* Sync Error Alert if any */}
          {syncError && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold block">Google Sheet Sync Notice:</span>
                <span>{syncError}</span>
              </div>
            </div>
          )}

          {/* Connect your Google Sheet for live sync Banner (Only for editor) */}
          {!isViewOnly && !isBannerDismissed && (
            <div className="mb-6 p-4 rounded-2xl bg-white border border-rose-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-pink-50 text-[#E11D74] flex items-center justify-center shrink-0">
                  <RefreshCw className={`w-5 h-5 text-[#E11D74] ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Connect your Google Sheet for live sync
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Link it once — the dashboard updates whenever your team edits a row.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-start md:self-center shrink-0">
                <button
                  onClick={() => setIsSheetModalOpen(true)}
                  className="text-xs font-bold text-[#E11D74] hover:text-[#c91464] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Link Google Sheet</span>
                  <span className="text-sm">→</span>
                </button>

                <button
                  onClick={() => setIsBannerDismissed(true)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Top 4 KPI Metric Cards */}
          <BrandKpiCards
            data={currentPeriodData}
            allWorks={data.worksCompleted}
            onScrollToWorks={() => {
              const el = document.getElementById('works-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* Main 2-Column Content Area */}
          <div id="works-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-start">
            {/* Left Column: Works completed (7 cols) */}
            <div className="lg:col-span-7">
              <BrandWorksCompleted
                works={displayWorks}
                availableMonths={data.availableMonths || []}
                selectedMonth={selectedMonth}
                allWorks={data.worksCompleted}
                workListNote={data.workListNotes?.[`works_${selectedMonth}`] || ''}
                onUpdateWorkListNote={(note) =>
                  handleUpdateWorkListNote(`works_${selectedMonth}`, note)
                }
                onAddWorkItem={handleAddWorkItem}
                onUpdateWorkItem={handleUpdateWorkItem}
                onDeleteWorkItem={handleDeleteWorkItem}
                isViewOnly={isViewOnly}
              />
            </div>

            {/* Right Column: Output mix & Tasks widgets (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <BrandOutputMix
                works={displayWorks}
                selectedMonth={selectedMonth}
                outputMixNote={data.workListNotes?.[`mix_${selectedMonth}`] || ''}
                onUpdateOutputMixNote={(note) =>
                  handleUpdateWorkListNote(`mix_${selectedMonth}`, note)
                }
                onUpdateWorkItem={handleUpdateWorkItem}
                isViewOnly={isViewOnly}
              />

              <BrandTasksWidget
                tasks={tasks}
                onOpenTaskManager={navigateToTasks}
                onAddTask={navigateToTasks}
                tasksListNote={
                  data.workListNotes?.['tasks'] ||
                  (selectedMonth ? data.workListNotes?.[`tasks_${selectedMonth}`] : '') ||
                  ''
                }
                onUpdateTasksListNote={(note) => handleUpdateWorkListNote('tasks', note)}
                isViewOnly={isViewOnly}
              />
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-6 pb-8 border-t border-slate-200 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>VZone Marketing • Monthly report workbook & performance dashboard</span>
            <span>Source: {data.fileName || 'VZONE Monthly Report.xlsx'}</span>
          </div>
        </div>
      </main>

      {/* Upload / Link Google Sheet Modal */}
      <UploadSheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        onDataLoaded={handleDataLoaded}
        currentSheetUrl={data.sheetSourceUrl || ''}
        syncSettings={syncSettings}
        onUpdateSyncSettings={handleUpdateSyncSettings}
      />

      {/* Passcode Unlock Editor Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pink-50 text-[#E11D74] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Unlock Editor Mode</h3>
              </div>
              <button
                onClick={() => {
                  setIsUnlockModalOpen(false);
                  setUnlockPasscode('');
                  setUnlockError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Enter passcode to unlock editor privileges and edit deliverables, tasks, or notes (default: <strong className="text-slate-800">vzone</strong>).
            </p>

            <form onSubmit={handleUnlockEditor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Passcode
                </label>
                <input
                  type="password"
                  placeholder="Enter passcode (e.g. vzone)"
                  value={unlockPasscode}
                  onChange={(e) => {
                    setUnlockPasscode(e.target.value);
                    setUnlockError(null);
                  }}
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E11D74]"
                />
                {unlockError && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{unlockError}</p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setUnlockPasscode('');
                    setUnlockError(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#E11D74] hover:bg-[#c91464] text-white shadow-xs transition-colors cursor-pointer"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
