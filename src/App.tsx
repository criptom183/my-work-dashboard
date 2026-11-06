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
} from './utils/googleSheetSync';
import { fetchTasksPubliclyFromGoogleSheet } from './utils/googleSheetsTasksSync';
import {
  subscribeToFirestoreTasks,
  subscribeToSharedSheetUrl,
  saveSharedSheetUrl,
} from './utils/firestoreTasks';
import {
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
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

  const dataRef = useRef(data);
  dataRef.current = data;

  const syncSettingsRef = useRef(syncSettings);
  syncSettingsRef.current = syncSettings;

  // Sync selectedMonth when new data arrives
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

        if (freshData.tasks && freshData.tasks.length > 0) {
          handleUpdateTasks(freshData.tasks);
        } else {
          try {
            const publicTasks = await fetchTasksPubliclyFromGoogleSheet(currentUrl);
            if (publicTasks.length > 0) {
              handleUpdateTasks(publicTasks);
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
          showToast(`Synced with Google Sheet! Updated ${freshData.worksCompleted.length} deliverables.`);
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

  // Load from local storage on startup if available
  useEffect(() => {
    const loaded = loadDashboardFromStorage();
    if (loaded && loaded.data) {
      setData(loaded.data);
      setIsSavedInStorage(true);
      setSavedMeta(loaded.meta);

      if (loaded.data.sheetSourceUrl && syncSettingsRef.current.autoSync) {
        const timer = setTimeout(() => {
          handleSyncGoogleSheet(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [handleSyncGoogleSheet]);

  const handleSaveToLocalMemory = () => {
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
    showToast('Dashboard data saved to browser local memory!');
  };

  const handleClearStorage = () => {
    clearDashboardFromStorage();
    setIsSavedInStorage(false);
    setSavedMeta(null);
    showToast('Saved dashboard memory cleared.', 'info');
  };

  const handleUpdateWorkItem = (id: string, updates: Partial<WorkItem>) => {
    setData((prev) => ({
      ...prev,
      worksCompleted: prev.worksCompleted.map((w) => {
        if (w.id === id || w.id.replace(/^all-/, '') === id.replace(/^all-/, '')) {
          const updatedBreakdown = w.monthlyBreakdown
            ? {
                ...w.monthlyBreakdown,
                ...(selectedMonth !== 'all' && updates.count !== undefined
                  ? { [selectedMonth]: updates.count }
                  : {}),
              }
            : undefined;

          return {
            ...w,
            ...updates,
            monthlyBreakdown: updatedBreakdown,
          };
        }
        return w;
      }),
    }));
    setIsSavedInStorage(false);
  };

  const handleAddWorkItem = (
    activity: string,
    count: number,
    category: string,
    notes?: string
  ) => {
    const newId = `work-${Date.now()}`;
    const targetMonth = selectedMonth === 'all' ? (data.availableMonths?.[0] || 'Oct 2026') : selectedMonth;
    const newWork: WorkItem = {
      id: newId,
      activity,
      count,
      category,
      notes,
      month: targetMonth,
      monthlyBreakdown: {
        [targetMonth]: count,
      },
    };

    setData((prev) => ({
      ...prev,
      worksCompleted: [newWork, ...prev.worksCompleted],
    }));
    setIsSavedInStorage(false);
    showToast(`Added deliverable "${activity}"!`);
  };

  const handleDeleteWorkItem = (id: string) => {
    setData((prev) => ({
      ...prev,
      worksCompleted: prev.worksCompleted.filter(
        (w) => w.id !== id && w.id.replace(/^all-/, '') !== id.replace(/^all-/, '')
      ),
    }));
    setIsSavedInStorage(false);
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

          {/* Connect your Google Sheet for live sync Banner */}
          {!isBannerDismissed && (
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
                  className="text-slate-400 hover:text-slate-600 p-1"
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
                onAddWorkItem={handleAddWorkItem}
                onUpdateWorkItem={handleUpdateWorkItem}
                onDeleteWorkItem={handleDeleteWorkItem}
              />
            </div>

            {/* Right Column: Output mix & Tasks widgets (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <BrandOutputMix
                works={displayWorks}
                selectedMonth={selectedMonth}
              />

              <BrandTasksWidget
                tasks={tasks}
                onOpenTaskManager={navigateToTasks}
                onAddTask={navigateToTasks}
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
    </div>
  );
}
