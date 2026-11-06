/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initialDashboardData } from './data/initialData';
import { DashboardData, WorkItem, SyncSettings, TaskItem } from './types';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { WorksCompletedCard } from './components/WorksCompletedCard';
import { UploadSheetModal } from './components/UploadSheetModal';
import { MonthSelector } from './components/MonthSelector';
import { TaskManagerPage } from './components/TaskManagerPage';
import { exportToCsv } from './utils/sheetParser';
import { getWorksForSelectedMonth } from './utils/monthHelper';
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
} from './utils/taskStorage';
import {
  fetchAndParseGoogleSheet,
  intervalToMilliseconds,
} from './utils/googleSheetSync';
import { fetchTasksPubliclyFromGoogleSheet } from './utils/googleSheetsTasksSync';
import {
  subscribeToFirestoreTasks,
  subscribeToSharedSheetUrl,
  saveSharedSheetUrl,
} from './utils/firestoreTasks';
import {
  HardDrive,
  Save,
  CheckCircle2,
  X,
  RefreshCw,
  Link2,
  ExternalLink,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckSquare,
  ArrowRight,
  ListTodo,
  Flame,
} from 'lucide-react';


export default function App() {
  const [data, setData] = useState<DashboardData>(initialDashboardData);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialDashboardData.selectedMonth || 'Oct 2026'
  );
  const [isSavedInStorage, setIsSavedInStorage] = useState(false);
  const [savedMeta, setSavedMeta] = useState<StorageMeta | null>(null);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(loadSyncSettingsFromStorage());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Separate page routing: 'dashboard' (Home) or 'tasks' (Task Manager)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'tasks'>(() => {
    return typeof window !== 'undefined' && window.location.hash === '#tasks'
      ? 'tasks'
      : 'dashboard';
  });

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateTasks = (updated: TaskItem[]) => {
    setTasks(updated);
    saveTasksToStorage(updated);
  };

  // Real-time synchronization from Cloud Firestore across all devices (no login needed to view)
  useEffect(() => {
    const unsubTasks = subscribeToFirestoreTasks((cloudTasks) => {
      if (cloudTasks && cloudTasks.length > 0) {
        setTasks(cloudTasks);
        saveTasksToStorage(cloudTasks);
      }
    });

    const unsubSheetUrl = subscribeToSharedSheetUrl((sharedUrl) => {
      if (sharedUrl && sharedUrl !== dataRef.current.sheetSourceUrl) {
        setData((prev) => ({ ...prev, sheetSourceUrl: sharedUrl }));
      }
    });

    return () => {
      unsubTasks();
      unsubSheetUrl();
    };
  }, []);


  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);


  // Keep a ref to the latest data and sync settings for interval callbacks
  const dataRef = useRef(data);
  dataRef.current = data;

  const syncSettingsRef = useRef(syncSettings);
  syncSettingsRef.current = syncSettings;

  // Sync selectedMonth with data.selectedMonth when new data arrives
  useEffect(() => {
    if (data.selectedMonth) {
      setSelectedMonth(data.selectedMonth);
    } else if (data.availableMonths && data.availableMonths.length > 0) {
      setSelectedMonth(data.availableMonths[data.availableMonths.length - 1]);
    }
  }, [data.selectedMonth, data.availableMonths]);

  // Show temporary toast message
  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Update sync settings and persist
  const handleUpdateSyncSettings = useCallback((newSettings: SyncSettings) => {
    setSyncSettings(newSettings);
    saveSyncSettingsToStorage(newSettings);
  }, []);

  // Core Google Sheet sync function
  const handleSyncGoogleSheet = useCallback(
    async (isSilent = false) => {
      const currentUrl = dataRef.current.sheetSourceUrl;
      if (!currentUrl) return;

      if (!isSilent) {
        setIsSyncing(true);
      }
      setSyncError(null);

      try {
        const freshData = await fetchAndParseGoogleSheet(currentUrl);

        setData(freshData);

        // Automatically sync tasks if present in Google Sheet without requiring login
        if (freshData.tasks && freshData.tasks.length > 0) {
          handleUpdateTasks(freshData.tasks);
        } else {
          // If freshData was fetched via CSV or didn't bundle Tasks sheet, fetch Tasks tab directly without login
          try {
            const publicTasks = await fetchTasksPubliclyFromGoogleSheet(currentUrl);
            if (publicTasks.length > 0) {
              handleUpdateTasks(publicTasks);
            }
          } catch {
            // Silently continue if Tasks tab not present
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

        // Always sync with local memory if previously saved
        saveDashboardToStorage(freshData);
        setIsSavedInStorage(true);
        setSavedMeta({
          savedAt: new Date().toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          fileName: freshData.fileName,
          totalWorks: freshData.worksCompleted.length,
        });

        if (!isSilent) {
          showToast(
            `Synced with Google Sheet! Updated ${freshData.worksCompleted.length} deliverables.`
          );
        }
      } catch (err: any) {
        console.error('Google Sheet sync error:', err);
        setSyncError(err.message || 'Failed to sync with Google Sheet');
        if (!isSilent) {
          showToast(
            `Sync failed: ${err.message || 'Please check sheet sharing permissions.'}`,
            'error'
          );
        }
      } finally {
        if (!isSilent) {
          setIsSyncing(false);
        }
      }
    },
    [handleUpdateSyncSettings, showToast]
  );

  // Load from local storage on startup if available
  useEffect(() => {
    const loaded = loadDashboardFromStorage();
    if (loaded && loaded.data) {
      setData(loaded.data);
      setIsSavedInStorage(true);
      setSavedMeta(loaded.meta);

      // If there was a linked Google Sheet and auto-sync is on, perform initial sync
      if (loaded.data.sheetSourceUrl && syncSettingsRef.current.autoSync) {
        // Run initial background sync after 1s
        const timer = setTimeout(() => {
          handleSyncGoogleSheet(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [handleSyncGoogleSheet]);

  // Periodic Auto-Sync Timer
  useEffect(() => {
    const currentUrl = data.sheetSourceUrl;
    if (!currentUrl || !syncSettings.autoSync || syncSettings.interval === 'off') {
      return;
    }

    const ms = intervalToMilliseconds(syncSettings.interval);
    if (ms <= 0) return;

    const intervalId = setInterval(() => {
      handleSyncGoogleSheet(true);
    }, ms);

    return () => clearInterval(intervalId);
  }, [data.sheetSourceUrl, syncSettings.autoSync, syncSettings.interval, handleSyncGoogleSheet]);

  // Sync on tab focus
  useEffect(() => {
    const onFocus = () => {
      if (dataRef.current.sheetSourceUrl && syncSettingsRef.current.autoSync) {
        handleSyncGoogleSheet(true);
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [handleSyncGoogleSheet]);

  // Explicit Save to Local Memory Handler
  const handleSaveToLocalMemory = () => {
    try {
      saveDashboardToStorage(data);
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
      showToast('Dashboard workbook & settings saved to browser local memory!');
    } catch {
      showToast('Could not save to local memory (storage might be full)', 'error');
    }
  };

  // Clear Storage Handler
  const handleClearStorage = () => {
    if (window.confirm('Are you sure you want to clear saved dashboard data from local memory?')) {
      clearDashboardFromStorage();
      setIsSavedInStorage(false);
      setSavedMeta(null);
      showToast('Saved local memory cleared. Reverted to default sample.', 'info');
      setData(initialDashboardData);
    }
  };

  // Disconnect Google Sheet
  const handleDisconnectSheet = () => {
    setData((prev) => ({
      ...prev,
      sheetSourceUrl: undefined,
      fileName: 'Unlinked Report Data',
    }));
    handleUpdateSyncSettings({
      autoSync: false,
      interval: '1m',
      lastSyncedAt: undefined,
    });
    setIsSavedInStorage(false);
    showToast('Disconnected Google Sheet. Auto-sync is paused.', 'info');
  };

  // Update Work Item (count, notes, activity)
  const handleUpdateWorkItem = (id: string, updates: Partial<WorkItem>) => {
    setData((prev) => ({
      ...prev,
      worksCompleted: prev.worksCompleted.map((w) => {
        if (w.id === id || w.id.replace(/^all-/, '') === id.replace(/^all-/, '')) {
          const updated = { ...w, ...updates };
          if (updates.count !== undefined && selectedMonth !== 'all') {
            updated.monthlyBreakdown = {
              ...(w.monthlyBreakdown || {}),
              [selectedMonth]: updates.count,
            };
          }
          return updated;
        }
        return w;
      }),
    }));
    setIsSavedInStorage(false);
  };

  // Add Deliverable
  const handleAddWorkItem = (activity: string, count: number, category: string, notes?: string) => {
    const currentM =
      selectedMonth === 'all'
        ? (data.availableMonths?.[data.availableMonths.length - 1] || 'Oct 2026')
        : selectedMonth;

    setData((prev) => ({
      ...prev,
      worksCompleted: [
        ...prev.worksCompleted,
        {
          id: `w-${Date.now()}`,
          activity,
          count,
          category,
          notes: notes?.trim() || undefined,
          month: currentM,
          monthlyBreakdown: { [currentM]: count },
        },
      ],
    }));
    setIsSavedInStorage(false);
  };

  // Delete Deliverable
  const handleDeleteWorkItem = (id: string) => {
    setData((prev) => ({
      ...prev,
      worksCompleted: prev.worksCompleted.filter(
        (w) => w.id !== id && w.id.replace(/^all-/, '') !== id.replace(/^all-/, '')
      ),
    }));
    setIsSavedInStorage(false);
  };

  // Export to CSV
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

  // Reset to initial sample
  const handleResetData = () => {
    setData(initialDashboardData);
    setSelectedMonth(initialDashboardData.selectedMonth || 'Oct 2026');
    setIsSavedInStorage(false);
    showToast('Reloaded sample report data.', 'info');
  };

  const handleDataLoaded = (newData: DashboardData, saveToLocalMemory: boolean = true) => {
    setData(newData);
    if (newData.tasks && newData.tasks.length > 0) {
      handleUpdateTasks(newData.tasks);
    }
    if (newData.selectedMonth) {
      setSelectedMonth(newData.selectedMonth);
    } else if (newData.availableMonths && newData.availableMonths.length > 0) {
      setSelectedMonth(newData.availableMonths[newData.availableMonths.length - 1]);
    }

    if (saveToLocalMemory) {
      saveDashboardToStorage(newData);
      setIsSavedInStorage(true);
      const meta = {
        savedAt: new Date().toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        fileName: newData.fileName,
        totalWorks: newData.worksCompleted.length,
      };
      setSavedMeta(meta);
      showToast(`Imported ${newData.fileName} and saved to local memory!`);
    } else {
      setIsSavedInStorage(false);
      showToast(`Imported ${newData.fileName}. Click "Save to Memory" to keep it.`);
    }
  };

  const handleOpenSheetModal = () => {
    setIsSheetModalOpen(true);
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isGoogleSheetConnected = Boolean(data.sheetSourceUrl);

  // Filtered deliverables for current selected month:
  // 1. Display only works whose count is more than 0. Hide others.
  const monthWorks = getWorksForSelectedMonth(
    data.worksCompleted,
    selectedMonth,
    data.availableMonths || []
  );
  const displayWorks = monthWorks.filter((w) => (w.count || 0) > 0);

  const currentPeriodData: DashboardData = {
    ...data,
    selectedMonth,
    worksCompleted: displayWorks,
  };

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const highPriorityTasks = tasks.filter(
    (t) => t.priority === 'High' && t.status !== 'completed'
  );

  // If on Task Manager separate page, render the dedicated Task Manager
  if (currentPage === 'tasks') {
    return (
      <>
        {/* Toast Alert Banner */}
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

        <TaskManagerPage
          tasks={tasks}
          onUpdateTasks={handleUpdateTasks}
          onBackToDashboard={navigateToDashboard}
          sheetSourceUrl={data.sheetSourceUrl}
          onSheetSourceUrlChange={(newUrl) => {
            setData((prev) => ({ ...prev, sheetSourceUrl: newUrl }));
            saveSharedSheetUrl(newUrl).catch(console.warn);
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-800 antialiased font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Toast Alert Banner */}
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

        {/* Header: Title, File status, Sync indicators, Actions, and Task Manager Link */}
        <Header
          data={data}
          onOpenGoogleSheetModal={handleOpenSheetModal}
          onResetData={handleResetData}
          onExportCsv={handleExportCsv}
          onSaveToLocalMemory={handleSaveToLocalMemory}
          isSavedInStorage={isSavedInStorage}
          savedMeta={savedMeta}
          onClearStorage={handleClearStorage}
          syncSettings={syncSettings}
          isSyncing={isSyncing}
          onSyncNow={() => handleSyncGoogleSheet(false)}
          onNavigateToTasks={navigateToTasks}
          activeTasksCount={activeTasks.length}
        />


        {/* Live Google Sheet Sync Status Bar */}
        {isGoogleSheetConnected ? (
          <div className="mb-6 p-3.5 rounded-xl bg-teal-50/90 border border-teal-200 text-teal-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-teal-950">
                    Live Google Sheet Connected
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Auto-Sync Active
                  </span>
                </div>
                <p className="text-xs text-teal-800 mt-0.5">
                  Edits made in your Google Sheet sync directly into this dashboard.
                  {syncSettings.lastSyncedAt && (
                    <span className="text-slate-500 ml-1">
                      (Last checked at {syncSettings.lastSyncedAt})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button
                onClick={() => handleSyncGoogleSheet(false)}
                disabled={isSyncing}
                title="Fetch updates right now"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs shadow-xs cursor-pointer active:scale-98 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <button
                onClick={handleOpenSheetModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-teal-200 text-teal-900 hover:bg-teal-50 text-xs font-medium transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-teal-700" />
                <span>Sync Settings</span>
              </button>

              {data.sheetSourceUrl && (
                <a
                  href={data.sheetSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-teal-200 text-teal-900 hover:bg-teal-50 text-xs font-medium transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
                  <span className="hidden sm:inline">Edit in Google Sheets</span>
                  <span className="sm:hidden">Edit</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Promotion Card: Link your Google Sheet for Auto-Updates */
          <div className="mb-6 p-4 rounded-xl bg-white border border-slate-200/90 text-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Connect your Google Sheet for real-time live sync
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link any Google Sheet once, and this dashboard will automatically update whenever your team updates rows.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button
                onClick={handleOpenSheetModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs shadow-xs cursor-pointer active:scale-98 transition-all"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link Google Sheet</span>
              </button>
            </div>
          </div>
        )}

        {/* Sync Error Alert if any */}
        {syncError && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold block">Google Sheet Sync Notice:</span>
              <span>{syncError}</span>
              <p className="mt-1 text-rose-700">
                Make sure the sheet is shared as <strong>"Anyone with the link can view"</strong>, or re-link via the Google Sheet menu.
              </p>
            </div>
          </div>
        )}

        {/* Local Memory Quick Action Banner (Shown if user imported but hasn't saved yet) */}
        {!isSavedInStorage && data.fileName !== initialDashboardData.fileName && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  You have imported data that is not yet saved to local memory
                </p>
                <p className="text-xs text-amber-700">
                  Save it now so your report and live link persist when you refresh or reopen this browser.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={handleSaveToLocalMemory}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs shadow-xs cursor-pointer active:scale-98 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Local Memory</span>
              </button>
            </div>
          </div>
        )}

        {/* Month / Timeline Selector & MoM Stats */}
        <MonthSelector
          availableMonths={data.availableMonths || ['Oct 2026']}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          allWorks={data.worksCompleted}
        />

        {/* 4 Deliverable KPI Cards */}
        <KpiCards
          data={currentPeriodData}
          onScrollToSection={scrollToSection}
        />

        {/* Current Tasks & Action Items Link Card on Home Page */}
        <div className="mb-6 bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shrink-0">
                <ListTodo className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">
                    Current Tasks & Action Items
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {activeTasks.length} active tasks
                  </span>
                  {highPriorityTasks.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-rose-500" />
                      <span>{highPriorityTasks.length} high priority</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Manage team assignments, video reels, link-in-bio setups, and pending deliverables.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <button
                onClick={navigateToTasks}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer group active:scale-98"
              >
                <span>Open Task Manager</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Quick preview of top tasks */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                onClick={navigateToTasks}
                className="p-3 rounded-lg bg-slate-50 hover:bg-teal-50/60 border border-slate-200/70 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        task.priority === 'High'
                          ? 'text-rose-600'
                          : task.priority === 'Medium'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200/60">
                      {task.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-2">
                    {task.title}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate max-w-[120px] font-medium text-slate-600">
                    {task.assignedTo || 'Unassigned'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      task.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : task.status === 'in-progress'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Works Completed Section (Full-Width Deliverables Table & Chart) */}
        <div id="works-section" className="mb-8">
          <WorksCompletedCard
            works={displayWorks}
            availableMonths={data.availableMonths || []}
            selectedMonth={selectedMonth}
            allWorks={data.worksCompleted}
            onUpdateWorkItem={handleUpdateWorkItem}
            onAddWorkItem={handleAddWorkItem}
            onDeleteWorkItem={handleDeleteWorkItem}
          />
        </div>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-slate-200 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VZone Marketing • Monthly Report Workbook & Performance Dashboard</span>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <button
              onClick={navigateToTasks}
              className="text-teal-700 hover:text-teal-900 font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Task Manager ({activeTasks.length})</span>
            </button>
            <span>•</span>
            <button
              onClick={handleOpenSheetModal}
              className="hover:text-teal-700 transition-colors cursor-pointer"
            >
              {isGoogleSheetConnected ? 'Sync Settings' : 'Connect Google Sheet'}
            </button>
            <span>•</span>
            <button
              onClick={handleSaveToLocalMemory}
              className="hover:text-teal-700 transition-colors cursor-pointer"
            >
              Save to Memory
            </button>
            {isSavedInStorage && (
              <>
                <span>•</span>
                <button
                  onClick={handleClearStorage}
                  className="hover:text-rose-600 transition-colors cursor-pointer"
                  title="Clear saved browser local storage"
                >
                  Clear Saved Memory
                </button>
              </>
            )}
            <span>•</span>
            <button
              onClick={handleResetData}
              className="hover:text-teal-700 transition-colors cursor-pointer"
            >
              Reload Sample
            </button>
          </div>
        </footer>

      </div>

      {/* Google Sheet Live Link Modal */}
      <UploadSheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        onDataLoaded={handleDataLoaded}
        currentSheetUrl={data.sheetSourceUrl || ''}
        syncSettings={syncSettings}
        onUpdateSyncSettings={handleUpdateSyncSettings}
        onDisconnectSheet={handleDisconnectSheet}
      />
    </div>
  );
}
