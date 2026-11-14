/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  initialDashboardData,
  DEFAULT_GOOGLE_SHEET_URL,
  DEPRECATED_SHEET_IDS,
} from './data/initialData';
import { DashboardData, WorkItem, SyncSettings, TaskItem, DeliverableSubItem } from './types';
import { Sidebar } from './components/Sidebar';
import { BrandTopBar } from './components/BrandTopBar';
import { BrandKpiCards } from './components/BrandKpiCards';
import { BrandMonthSelector } from './components/BrandMonthSelector';
import { BrandWorksCompleted } from './components/BrandWorksCompleted';
import { BrandOutputMix } from './components/BrandOutputMix';
import { BrandTasksWidget } from './components/BrandTasksWidget';
import { UploadSheetModal } from './components/UploadSheetModal';
import { TaskManagerPage } from './components/TaskManagerPage';
import { PresentationMode } from './components/PresentationMode';
import { exportToCsv, downloadWorkbookWithSubItemsTab } from './utils/sheetParser';
import { getWorksForSelectedMonth, isSameMonth } from './utils/monthHelper';
import {
  saveDashboardToStorage,
  loadDashboardFromStorage,
  clearDashboardFromStorage,
  StorageMeta,
  loadSyncSettingsFromStorage,
  saveSyncSettingsToStorage,
  saveTopicsBackup,
  updateWorkNoteInBackup,
  removeSubItemFromBackup,
  restoreTopicsFromBackup,
  buildTopicSyncKey,
  buildTopicContentSignature,
  getSyncedTopicKeys,
  getSyncedTopicSignatures,
  markTopicsAsSynced,
  markTopicSignaturesAsSynced,
  deduplicateSubItems,
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
  saveDeliverableDetailsToFirestore,
  subscribeToDeliverableDetails,
  saveSharedSyncSettings,
  subscribeToSharedSyncSettings,
  saveSharedSyncedTopics,
  subscribeToSharedSyncedTopics,
  saveDeliverableNotesToFirestore,
  subscribeToDeliverableNotes,
  StoredDeliverableNote,
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
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

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
      setUnlockError('Incorrect passcode. Please try again.');
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

  // Keyboard shortcut: Press 'P' to toggle Meeting / Presentation Mode
  useEffect(() => {
    const handleGlobalPresentationKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }
        setIsPresentationOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalPresentationKey);
    return () => window.removeEventListener('keydown', handleGlobalPresentationKey);
  }, []);

  const dataRef = useRef(data);
  dataRef.current = data;

  const isViewOnlyRef = useRef(isViewOnly);
  isViewOnlyRef.current = isViewOnly;

  const syncSettingsRef = useRef(syncSettings);
  syncSettingsRef.current = syncSettings;

  // Permanent in-memory mirror of Firestore config/deliverable_notes vault
  const cloudDeliverableNotesRef = useRef<{
    itemNotes: Record<string, StoredDeliverableNote>;
    workListNotes: Record<string, string>;
  }>({
    itemNotes: {},
    workListNotes: {},
  });

  // Helper to merge notes & sub-items from current state, cloud vault, and initialDashboardData
  const enrichWorkWithSavedNotesAndDetails = useCallback(
    (
      w: WorkItem,
      existingByActivity: Map<string, WorkItem>,
      initialByActivity: Map<string, WorkItem>
    ): WorkItem => {
      const key = w.activity.trim().toLowerCase();
      let match = existingByActivity.get(key);
      if (!match && key.startsWith('news or awareness reels')) {
        match = existingByActivity.get('news or awareness reels');
      }
      let initMatch = initialByActivity.get(key);
      if (!initMatch && key.startsWith('news or awareness reels')) {
        initMatch = initialByActivity.get('news or awareness reels');
      }
      const vaultNote =
        cloudDeliverableNotesRef.current.itemNotes[key] ||
        (key.startsWith('news or awareness reels')
          ? cloudDeliverableNotesRef.current.itemNotes['news or awareness reels']
          : undefined);

      // Merge monthly sub items without dropping anything and deduplicate strictly by title
      const allMonthlySources = [
        initMatch?.monthlySubItems,
        match?.monthlySubItems,
        w.monthlySubItems,
      ];
      const allMonthKeys = new Set<string>();
      for (const s of allMonthlySources) {
        if (s) {
          for (const k of Object.keys(s)) allMonthKeys.add(k);
        }
      }

      const mergedMonthly: Record<string, DeliverableSubItem[]> = {};
      for (const m of allMonthKeys) {
        const collected: DeliverableSubItem[] = [];
        for (const source of allMonthlySources) {
          if (source && source[m]) {
            collected.push(...source[m]);
          }
        }
        mergedMonthly[m] = deduplicateSubItems(collected);
      }

      // Merge monthlyNotes (vaultNote takes top precedence, then current item, then local backup; never hardcoded initMatch)
      const mergedMonthlyNotes: Record<string, string> = {};
      for (const noteSource of [
        match?.monthlyNotes,
        w.monthlyNotes,
        vaultNote?.monthlyNotes,
      ]) {
        if (noteSource && typeof noteSource === 'object') {
          for (const [m, txt] of Object.entries(noteSource)) {
            if (typeof txt === 'string' && txt.trim() && txt.trim() !== 'undefined') {
              mergedMonthlyNotes[m] = txt.trim();
            }
          }
        }
      }

      const cleanVaultCustomNote =
        vaultNote?.customNote && vaultNote.customNote.trim() !== 'undefined'
          ? vaultNote.customNote.trim()
          : undefined;
      const cleanWCustomNote =
        w.customNote && w.customNote.trim() !== 'undefined'
          ? w.customNote.trim()
          : undefined;
      const cleanMatchCustomNote =
        match?.customNote && match.customNote.trim() !== 'undefined'
          ? match.customNote.trim()
          : undefined;

      const resolvedCustomNote =
        cleanVaultCustomNote || cleanWCustomNote || cleanMatchCustomNote || undefined;

      const cleanVaultNotes =
        vaultNote?.notes && vaultNote.notes.trim() !== 'undefined'
          ? vaultNote.notes.trim()
          : undefined;
      const cleanWNotes =
        w.notes && w.notes.trim() !== 'undefined'
          ? w.notes.trim()
          : undefined;
      const cleanMatchNotes =
        match?.notes && match.notes.trim() !== 'undefined'
          ? match.notes.trim()
          : undefined;

      const resolvedNotes =
        cleanVaultNotes || cleanWNotes || cleanMatchNotes || undefined;

      // Merge monthlyDriveLinks (vaultNote takes top precedence, then current item, then local backup)
      const mergedMonthlyDriveLinks: Record<string, string> = {};
      for (const linkSource of [
        match?.monthlyDriveLinks,
        w.monthlyDriveLinks,
        vaultNote?.monthlyDriveLinks,
      ]) {
        if (linkSource && typeof linkSource === 'object') {
          for (const [m, linkTxt] of Object.entries(linkSource)) {
            if (typeof linkTxt === 'string' && linkTxt.trim() && linkTxt.trim() !== 'undefined') {
              mergedMonthlyDriveLinks[m] = linkTxt.trim();
            }
          }
        }
      }

      const cleanVaultDriveLink =
        vaultNote?.driveLink && vaultNote.driveLink.trim() !== 'undefined'
          ? vaultNote.driveLink.trim()
          : undefined;
      const cleanWDriveLink =
        w.driveLink && w.driveLink.trim() !== 'undefined'
          ? w.driveLink.trim()
          : undefined;
      const cleanMatchDriveLink =
        match?.driveLink && match.driveLink.trim() !== 'undefined'
          ? match.driveLink.trim()
          : undefined;

      const resolvedDriveLink =
        cleanVaultDriveLink || cleanWDriveLink || cleanMatchDriveLink || undefined;

      let activeSub: DeliverableSubItem[] = [];
      if (w.month && mergedMonthly[w.month] && mergedMonthly[w.month].length > 0) {
        activeSub = deduplicateSubItems(mergedMonthly[w.month]);
      } else if (match?.subItems && match.subItems.length > 0) {
        activeSub = deduplicateSubItems(match.subItems);
      } else if (w.subItems && w.subItems.length > 0) {
        activeSub = deduplicateSubItems(w.subItems);
      } else if (initMatch?.subItems && initMatch.subItems.length > 0) {
        activeSub = deduplicateSubItems(initMatch.subItems);
      }

      return {
        ...w,
        notes: resolvedNotes,
        customNote: resolvedCustomNote,
        monthlyNotes:
          Object.keys(mergedMonthlyNotes).length > 0 ? mergedMonthlyNotes : undefined,
        driveLink: resolvedDriveLink,
        monthlyDriveLinks:
          Object.keys(mergedMonthlyDriveLinks).length > 0 ? mergedMonthlyDriveLinks : undefined,
        subItems: activeSub,
        monthlySubItems: mergedMonthly,
      };
    },
    []
  );

  const handleUpdateSyncSettings = useCallback((newSettings: SyncSettings) => {
    setSyncSettings(newSettings);
    saveSyncSettingsToStorage(newSettings);
  }, []);

  // Core Google Sheet sync function
  const handleSyncGoogleSheet = useCallback(
    async (isSilent = false, overrideUrl?: string) => {
      let currentUrl = overrideUrl || dataRef.current.sheetSourceUrl || DEFAULT_GOOGLE_SHEET_URL;
      if (!currentUrl) return;

      // Never sync from a deprecated old sheet URL; always upgrade to the new active sheet
      if (DEPRECATED_SHEET_IDS.some((oldId) => currentUrl.includes(oldId))) {
        currentUrl = DEFAULT_GOOGLE_SHEET_URL;
      }

      if (!isSilent) {
        setIsSyncing(true);
      }
      setSyncError(null);

      try {
        const freshData = await fetchAndParseGoogleSheet(currentUrl);

        // Preserve all user-added notes and details for deliverables present in the active sheet
        const existingByActivity = new Map<string, WorkItem>();
        for (const w of dataRef.current.worksCompleted || []) {
          existingByActivity.set(w.activity.trim().toLowerCase(), w);
        }

        const initialByActivity = new Map<string, WorkItem>();
        for (const w of initialDashboardData.worksCompleted || []) {
          initialByActivity.set(w.activity.trim().toLowerCase(), w);
        }

        const updatedFreshWorks = (freshData.worksCompleted || []).map((w) =>
          enrichWorkWithSavedNotesAndDetails(w, existingByActivity, initialByActivity)
        );

        // Authoritative list comes strictly from the synced Google Sheet (no leftover rows from old sheets)
        const mergedWorks = restoreTopicsFromBackup(updatedFreshWorks);
        saveTopicsBackup(mergedWorks);

        const mergedNotes = {
          ...(cloudDeliverableNotesRef.current.workListNotes || {}),
          ...(dataRef.current.workListNotes || {}),
          ...(freshData.workListNotes || {}),
        };

        const mergedData: DashboardData = {
          ...freshData,
          sheetSourceUrl: currentUrl,
          worksCompleted: mergedWorks,
          workListNotes: mergedNotes,
        };

        setData(mergedData);

        // Broadcast to Cloud Firestore ONLY if triggered manually by an editor (never on silent background load)
        if (!isSilent && !isViewOnlyRef.current) {
          saveSharedDashboardData(mergedData).catch(console.warn);
          if (currentUrl) {
            saveSharedSheetUrl(currentUrl).catch(console.warn);
          }
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
    [enrichWorkWithSavedNotesAndDetails, handleUpdateSyncSettings, showToast]
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
      if (!sharedUrl) return;
      // Ignore deprecated old sheet URL if an old client wrote it
      if (DEPRECATED_SHEET_IDS.some((oldId) => sharedUrl.includes(oldId))) {
        saveSharedSheetUrl(DEFAULT_GOOGLE_SHEET_URL).catch(console.warn);
        return;
      }
      if (sharedUrl !== dataRef.current.sheetSourceUrl) {
        setData((prev) => ({ ...prev, sheetSourceUrl: sharedUrl }));
        if (syncSettingsRef.current.autoSync) {
          handleSyncGoogleSheet(true, sharedUrl);
        }
      }
    });

    // 3. Subscribe to active dashboard state (works completed, selected month, available months)
    const unsubDashboard = subscribeToSharedDashboardData((cloudDashboard) => {
      if (cloudDashboard && Array.isArray(cloudDashboard.worksCompleted) && cloudDashboard.worksCompleted.length > 0) {
        // Ignore cloud snapshots that came from the deprecated old Google Sheet
        if (
          cloudDashboard.sheetSourceUrl &&
          DEPRECATED_SHEET_IDS.some((oldId) => cloudDashboard.sheetSourceUrl?.includes(oldId))
        ) {
          return;
        }

        setData((prev) => {
          // Merge workListNotes so any existing notes in local state or vault are never wiped
          const mergedNotes = {
            ...(cloudDeliverableNotesRef.current.workListNotes || {}),
            ...(prev.workListNotes || {}),
            ...(cloudDashboard.workListNotes || {}),
          };

          const existingByActivity = new Map<string, WorkItem>();
          for (const w of prev.worksCompleted || []) {
            existingByActivity.set(w.activity.trim().toLowerCase(), w);
          }

          const initialByActivity = new Map<string, WorkItem>();
          for (const w of initialDashboardData.worksCompleted || []) {
            initialByActivity.set(w.activity.trim().toLowerCase(), w);
          }

          // Filter out legacy duplicate 'News or Awareness Reels' if the new full name exists
          const hasFullNewsActivity = cloudDashboard.worksCompleted.some((w) =>
            w.activity.toLowerCase().includes('incl. malayalam')
          );
          const cleanCloudWorks = hasFullNewsActivity
            ? cloudDashboard.worksCompleted.filter(
                (w) => w.activity.trim().toLowerCase() !== 'news or awareness reels'
              )
            : cloudDashboard.worksCompleted;

          const mergedWorks = restoreTopicsFromBackup(
            cleanCloudWorks.map((w) =>
              enrichWorkWithSavedNotesAndDetails(w, existingByActivity, initialByActivity)
            )
          );
          saveTopicsBackup(mergedWorks);

          const merged: DashboardData = {
            ...cloudDashboard,
            sheetSourceUrl: cloudDashboard.sheetSourceUrl || DEFAULT_GOOGLE_SHEET_URL,
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

    // 4. Subscribe to dedicated deliverable details vault from Firestore
    const unsubDetails = subscribeToDeliverableDetails((detailsMap) => {
      if (detailsMap && Object.keys(detailsMap).length > 0) {
        setData((prev) => {
          let hasChanges = false;
          const updatedWorks = prev.worksCompleted.map((w) => {
            const actKey = w.activity.trim().toLowerCase();
            const relevant = Object.values(detailsMap).filter(
              (d) => d.activity.trim().toLowerCase() === actKey
            );
            if (relevant.length === 0) return w;

            const monthlySub = { ...(w.monthlySubItems || {}) };
            for (const item of relevant) {
              const mName = item.month || 'Nov 2026';
              const currentList = monthlySub[mName] ? [...monthlySub[mName]] : [];
              const normItemTitle = item.title.trim().toLowerCase();
              const idx = currentList.findIndex(
                (it) => it.id === item.id || it.title.trim().toLowerCase() === normItemTitle
              );
              if (idx >= 0) {
                if (
                  currentList[idx].title !== item.title ||
                  currentList[idx].note !== item.note ||
                  currentList[idx].driveLink !== item.driveLink
                ) {
                  currentList[idx] = {
                    id: currentList[idx].id || item.id,
                    title: item.title,
                    note: item.note || currentList[idx].note,
                    driveLink: item.driveLink || currentList[idx].driveLink,
                    createdAt: currentList[idx].createdAt || item.createdAt,
                  };
                  hasChanges = true;
                }
              } else {
                currentList.push({
                  id: item.id,
                  title: item.title,
                  note: item.note,
                  driveLink: item.driveLink,
                  createdAt: item.createdAt,
                });
                hasChanges = true;
              }
              monthlySub[mName] = deduplicateSubItems(currentList);
            }

            return {
              ...w,
              monthlySubItems: monthlySub,
            };
          });

          if (!hasChanges) return prev;
          const restored = restoreTopicsFromBackup(updatedWorks);
          saveTopicsBackup(restored);
          return {
            ...prev,
            worksCompleted: restored,
          };
        });
      }
    });

    // 4b. Subscribe to dedicated deliverable_notes vault from Firestore
    const unsubDeliverableNotes = subscribeToDeliverableNotes(({ itemNotes, workListNotes }) => {
      cloudDeliverableNotesRef.current = {
        itemNotes: itemNotes || {},
        workListNotes: workListNotes || {},
      };
      if (
        (itemNotes && Object.keys(itemNotes).length > 0) ||
        (workListNotes && Object.keys(workListNotes).length > 0)
      ) {
        setData((prev) => {
          let hasChanges = false;
          const updatedWorks = prev.worksCompleted.map((w) => {
            const actKey = w.activity.trim().toLowerCase();
            const vaultEntry = itemNotes[actKey];
            if (!vaultEntry) return w;

            const mergedMonthlyNotes: Record<string, string> = {
              ...(w.monthlyNotes || {}),
            };
            if (vaultEntry.monthlyNotes && typeof vaultEntry.monthlyNotes === 'object') {
              for (const [m, txt] of Object.entries(vaultEntry.monthlyNotes)) {
                if (typeof txt === 'string' && txt.trim() && txt.trim() !== 'undefined') {
                  if (mergedMonthlyNotes[m] !== txt.trim()) {
                    mergedMonthlyNotes[m] = txt.trim();
                    hasChanges = true;
                  }
                }
              }
            }

            const mergedMonthlyDriveLinks: Record<string, string> = {
              ...(w.monthlyDriveLinks || {}),
            };
            if (vaultEntry.monthlyDriveLinks && typeof vaultEntry.monthlyDriveLinks === 'object') {
              for (const [m, linkTxt] of Object.entries(vaultEntry.monthlyDriveLinks)) {
                if (typeof linkTxt === 'string' && linkTxt.trim() && linkTxt.trim() !== 'undefined') {
                  if (mergedMonthlyDriveLinks[m] !== linkTxt.trim()) {
                    mergedMonthlyDriveLinks[m] = linkTxt.trim();
                    hasChanges = true;
                  }
                }
              }
            }

            const cleanVaultCustomNote =
              vaultEntry.customNote && vaultEntry.customNote.trim() !== 'undefined'
                ? vaultEntry.customNote.trim()
                : undefined;
            const cleanWCustomNote =
              w.customNote && w.customNote.trim() !== 'undefined'
                ? w.customNote.trim()
                : undefined;
            const nextCustomNote =
              cleanVaultCustomNote !== undefined ? cleanVaultCustomNote : cleanWCustomNote;
            if (nextCustomNote !== w.customNote) {
              hasChanges = true;
            }

            const cleanVaultNotes =
              vaultEntry.notes && vaultEntry.notes.trim() !== 'undefined'
                ? vaultEntry.notes.trim()
                : undefined;
            const cleanWNotes =
              w.notes && w.notes.trim() !== 'undefined'
                ? w.notes.trim()
                : undefined;
            const nextNotes =
              cleanVaultNotes !== undefined ? cleanVaultNotes : cleanWNotes;
            if (nextNotes !== w.notes) {
              hasChanges = true;
            }

            const cleanVaultDriveLink =
              vaultEntry.driveLink && vaultEntry.driveLink.trim() !== 'undefined'
                ? vaultEntry.driveLink.trim()
                : undefined;
            const cleanWDriveLink =
              w.driveLink && w.driveLink.trim() !== 'undefined'
                ? w.driveLink.trim()
                : undefined;
            const nextDriveLink =
              cleanVaultDriveLink !== undefined ? cleanVaultDriveLink : cleanWDriveLink;
            if (nextDriveLink !== w.driveLink) {
              hasChanges = true;
            }

            return {
              ...w,
              notes: nextNotes,
              customNote: nextCustomNote,
              monthlyNotes:
                Object.keys(mergedMonthlyNotes).length > 0 ? mergedMonthlyNotes : w.monthlyNotes,
              driveLink: nextDriveLink,
              monthlyDriveLinks:
                Object.keys(mergedMonthlyDriveLinks).length > 0
                  ? mergedMonthlyDriveLinks
                  : w.monthlyDriveLinks,
            };
          });

          const mergedWorkListNotes = {
            ...(workListNotes || {}),
            ...(prev.workListNotes || {}),
          };
          if (
            JSON.stringify(mergedWorkListNotes) !== JSON.stringify(prev.workListNotes || {})
          ) {
            hasChanges = true;
          }

          if (!hasChanges) return prev;
          saveTopicsBackup(updatedWorks);
          const nextData: DashboardData = {
            ...prev,
            worksCompleted: updatedWorks,
            workListNotes: mergedWorkListNotes,
          };
          saveDashboardToStorage(nextData);
          return nextData;
        });
      }
    });

    // 5. Subscribe to shared SyncSettings (including Google Apps Script Web App webhookUrl) across desktop & mobile
    if (syncSettingsRef.current.webhookUrl) {
      saveSharedSyncSettings(syncSettingsRef.current).catch(console.warn);
    }
    const existingSynced = Array.from(getSyncedTopicKeys());
    if (existingSynced.length > 0) {
      saveSharedSyncedTopics(existingSynced).catch(console.warn);
    }

    const unsubSyncSettings = subscribeToSharedSyncSettings((cloudSettings) => {
      setSyncSettings((prev) => {
        const mergedWebhook = cloudSettings.webhookUrl || prev.webhookUrl;
        // If this browser (e.g. computer) has a webhookUrl in localStorage that isn't in Firestore yet, push it to Firestore!
        if (prev.webhookUrl && !cloudSettings.webhookUrl) {
          saveSharedSyncSettings(prev).catch(console.warn);
        }
        const next: SyncSettings = {
          autoSync:
            typeof cloudSettings.autoSync === 'boolean' ? cloudSettings.autoSync : prev.autoSync,
          interval: cloudSettings.interval || prev.interval,
          webhookUrl: mergedWebhook,
          lastSyncedAt: cloudSettings.lastSyncedAt || prev.lastSyncedAt,
        };
        saveSyncSettingsToStorage(next);
        return next;
      });
    });

    const unsubSyncedTopics = subscribeToSharedSyncedTopics((cloudKeys) => {
      if (Array.isArray(cloudKeys) && cloudKeys.length > 0) {
        markTopicsAsSynced(cloudKeys);
      }
    });

    return () => {
      unsubTasks();
      unsubSheetUrl();
      unsubDashboard();
      unsubDetails();
      unsubDeliverableNotes();
      unsubSyncSettings();
      unsubSyncedTopics();
    };
  }, [enrichWorkWithSavedNotesAndDetails, handleSyncGoogleSheet]);

  // Sync selectedMonth when new data arrives
  useEffect(() => {
    if (data.selectedMonth) {
      setSelectedMonth(data.selectedMonth);
    } else if (data.availableMonths && data.availableMonths.length > 0) {
      setSelectedMonth(data.availableMonths[data.availableMonths.length - 1]);
    }
  }, [data.selectedMonth, data.availableMonths]);

  // Load from local storage on startup WITHOUT overwriting Cloud Firestore with potentially stale local cache
  useEffect(() => {
    const loaded = loadDashboardFromStorage();
    const initialByActivity = new Map<string, WorkItem>();
    for (const w of initialDashboardData.worksCompleted || []) {
      initialByActivity.set(w.activity.trim().toLowerCase(), w);
    }

    if (loaded && loaded.data && loaded.data.worksCompleted && loaded.data.worksCompleted.length > 0) {
      const existingByActivity = new Map<string, WorkItem>();
      for (const w of loaded.data.worksCompleted) {
        existingByActivity.set(w.activity.trim().toLowerCase(), w);
      }
      const enriched = loaded.data.worksCompleted.map((w) =>
        enrichWorkWithSavedNotesAndDetails(w, existingByActivity, initialByActivity)
      );
      const restoredWorks = restoreTopicsFromBackup(enriched);
      const completeData: DashboardData = {
        ...loaded.data,
        sheetSourceUrl: loaded.data.sheetSourceUrl || DEFAULT_GOOGLE_SHEET_URL,
        worksCompleted: restoredWorks,
      };
      setData(completeData);
      saveTopicsBackup(restoredWorks);
      setIsSavedInStorage(true);
      setSavedMeta(loaded.meta);

      // Push any locally saved custom notes to the permanent Firestore deliverable_notes vault
      const localNotesToPush: Record<string, StoredDeliverableNote> = {};
      for (const w of restoredWorks) {
        if (w.customNote || (w.monthlyNotes && Object.keys(w.monthlyNotes).length > 0)) {
          localNotesToPush[w.activity.trim().toLowerCase()] = {
            activity: w.activity,
            customNote: w.customNote,
            monthlyNotes: w.monthlyNotes,
            notes: w.notes,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      if (
        Object.keys(localNotesToPush).length > 0 ||
        (completeData.workListNotes && Object.keys(completeData.workListNotes).length > 0)
      ) {
        saveDeliverableNotesToFirestore(localNotesToPush, completeData.workListNotes).catch(
          console.warn
        );
      }

      if (completeData.sheetSourceUrl && syncSettingsRef.current.autoSync) {
        const timer = setTimeout(() => {
          handleSyncGoogleSheet(true, completeData.sheetSourceUrl);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } else {
      const initialRestored: DashboardData = {
        ...initialDashboardData,
        sheetSourceUrl: DEFAULT_GOOGLE_SHEET_URL,
        worksCompleted: restoreTopicsFromBackup(initialDashboardData.worksCompleted),
      };
      setData(initialRestored);
      saveDashboardToStorage(initialRestored);
      saveTopicsBackup(initialRestored.worksCompleted);
      if (syncSettingsRef.current.autoSync) {
        const timer = setTimeout(() => {
          handleSyncGoogleSheet(true, DEFAULT_GOOGLE_SHEET_URL);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [enrichWorkWithSavedNotesAndDetails, handleSyncGoogleSheet]);

  const handleSaveToLocalMemory = () => {
    saveDashboardToStorage(data);
    saveTopicsBackup(data.worksCompleted);
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
    const targetMonth =
      selectedMonth === 'all' ? data.availableMonths?.[data.availableMonths.length - 1] || 'Nov 2026' : selectedMonth;

    setData((prev) => {
      let updatedTargetWork: WorkItem | null = null;
      const cleanId = id.replace(/^all-/, '');
      const updatedWorks = prev.worksCompleted.map((w) => {
        const matchesId = w.id === id || w.id.replace(/^all-/, '') === cleanId;
        const matchesActivity =
          updates.activity &&
          w.activity.trim().toLowerCase() === updates.activity.trim().toLowerCase();

        if (matchesId || matchesActivity) {
          const updatedBreakdown = w.monthlyBreakdown
            ? {
                ...w.monthlyBreakdown,
                ...(selectedMonth !== 'all' && updates.count !== undefined
                  ? { [selectedMonth]: updates.count }
                  : {}),
              }
            : undefined;

          // Scope deliverable custom notes to selectedMonth and keep root customNote in sync
          const updatedMonthlyNotes = w.monthlyNotes ? { ...w.monthlyNotes } : {};
          if (updates.customNote !== undefined) {
            const trimmed = (updates.customNote || '').trim();
            if (trimmed && trimmed !== 'undefined') {
              updatedMonthlyNotes[targetMonth] = trimmed;
            } else {
              delete updatedMonthlyNotes[targetMonth];
            }
          }

          let rootCustomNote = w.customNote;
          if (updates.customNote !== undefined) {
            const trimmed = (updates.customNote || '').trim();
            if (trimmed && trimmed !== 'undefined') {
              rootCustomNote = trimmed;
            } else if (Object.keys(updatedMonthlyNotes).length === 0) {
              rootCustomNote = undefined;
            } else {
              const remaining = Object.values(updatedMonthlyNotes).filter(
                (v) => v && v.trim() && v.trim() !== 'undefined'
              );
              rootCustomNote = remaining.length > 0 ? remaining[remaining.length - 1].trim() : undefined;
            }
          }

          // Scope deliverable Drive links to selectedMonth and keep root driveLink in sync
          const updatedMonthlyDriveLinks = w.monthlyDriveLinks ? { ...w.monthlyDriveLinks } : {};
          if (updates.driveLink !== undefined) {
            const trimmedLink = (updates.driveLink || '').trim();
            if (trimmedLink && trimmedLink !== 'undefined') {
              updatedMonthlyDriveLinks[targetMonth] = trimmedLink;
            } else {
              delete updatedMonthlyDriveLinks[targetMonth];
            }
          }

          let rootDriveLink = w.driveLink;
          if (updates.driveLink !== undefined) {
            const trimmedLink = (updates.driveLink || '').trim();
            if (trimmedLink && trimmedLink !== 'undefined') {
              rootDriveLink = trimmedLink;
            } else if (Object.keys(updatedMonthlyDriveLinks).length === 0) {
              rootDriveLink = undefined;
            } else {
              const remainingLinks = Object.values(updatedMonthlyDriveLinks).filter(
                (v) => v && v.trim() && v.trim() !== 'undefined'
              );
              rootDriveLink =
                remainingLinks.length > 0 ? remainingLinks[remainingLinks.length - 1].trim() : undefined;
            }
          }

          const nextWork: WorkItem = {
            ...w,
            ...updates,
            customNote: rootCustomNote,
            driveLink: rootDriveLink,
            monthlyBreakdown: updatedBreakdown,
            monthlyNotes: updatedMonthlyNotes,
            monthlyDriveLinks: updatedMonthlyDriveLinks,
          };
          updatedTargetWork = nextWork;
          return nextWork;
        }
        return w;
      });

      if (updatedTargetWork) {
        const tw = updatedTargetWork as WorkItem;
        const actKey = tw.activity.trim().toLowerCase();
        updateWorkNoteInBackup(
          tw.activity,
          targetMonth,
          updates.customNote,
          updates.notes,
          updates.driveLink
        );
        const noteEntry: StoredDeliverableNote = {
          activity: tw.activity,
          customNote:
            tw.customNote && tw.customNote.trim() !== 'undefined' ? tw.customNote.trim() : '',
          monthlyNotes: tw.monthlyNotes || {},
          notes: tw.notes && tw.notes.trim() !== 'undefined' ? tw.notes.trim() : '',
          driveLink:
            tw.driveLink && tw.driveLink.trim() !== 'undefined' ? tw.driveLink.trim() : '',
          monthlyDriveLinks: tw.monthlyDriveLinks || {},
          updatedAt: new Date().toISOString(),
        };
        cloudDeliverableNotesRef.current.itemNotes[actKey] = noteEntry;
        saveDeliverableNotesToFirestore({ [actKey]: noteEntry }).catch(console.warn);

        // If a deliverable-level link was added or updated, also back it up to Google Sheets
        if (updates.driveLink !== undefined && syncSettingsRef.current?.webhookUrl) {
          const linkToBackup = updates.driveLink.trim();
          const noteForLink =
            (updates.customNote !== undefined ? updates.customNote : tw.monthlyNotes?.[targetMonth] || tw.customNote || '').trim();
          if (linkToBackup) {
            const webhookUrl = syncSettingsRef.current.webhookUrl.trim();
            const payload = JSON.stringify({
              action: 'syncDeliverableLinks',
              deliverableLinks: [
                {
                  month: targetMonth,
                  deliverable: tw.activity,
                  note: noteForLink,
                  link: linkToBackup,
                },
              ],
            });
            fetch(webhookUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: payload,
            }).catch(() => {});
          }
        }
      }

      saveTopicsBackup(updatedWorks);
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

      cloudDeliverableNotesRef.current.workListNotes = updatedNotes;
      saveDeliverableNotesToFirestore({}, updatedNotes).catch(console.warn);

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
    notes?: string,
    driveLink?: string
  ) => {
    if (isViewOnly) return;
    const newId = `work-${Date.now()}`;
    const targetMonth = selectedMonth === 'all' ? (data.availableMonths?.[0] || 'Nov 2026') : selectedMonth;
    const cleanLink = driveLink?.trim() || undefined;
    const newWork: WorkItem = {
      id: newId,
      activity,
      count,
      category,
      notes,
      customNote: notes || undefined,
      monthlyNotes: notes ? { [targetMonth]: notes } : undefined,
      driveLink: cleanLink,
      monthlyDriveLinks: cleanLink ? { [targetMonth]: cleanLink } : undefined,
      month: targetMonth,
      monthlyBreakdown: {
        [targetMonth]: count,
      },
    };

    if ((notes && notes.trim()) || cleanLink) {
      const actKey = activity.trim().toLowerCase();
      updateWorkNoteInBackup(activity, targetMonth, notes?.trim(), notes?.trim(), cleanLink);
      const noteEntry: StoredDeliverableNote = {
        activity,
        customNote: notes?.trim() || '',
        monthlyNotes: notes?.trim() ? { [targetMonth]: notes.trim() } : {},
        notes: notes?.trim() || '',
        driveLink: cleanLink || '',
        monthlyDriveLinks: cleanLink ? { [targetMonth]: cleanLink } : {},
        updatedAt: new Date().toISOString(),
      };
      cloudDeliverableNotesRef.current.itemNotes[actKey] = noteEntry;
      saveDeliverableNotesToFirestore({ [actKey]: noteEntry }).catch(console.warn);
    }

    setData((prev) => {
      const nextWorks = [newWork, ...prev.worksCompleted];
      saveTopicsBackup(nextWorks);
      const updatedDashboard = {
        ...prev,
        worksCompleted: nextWorks,
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

  const handleAddSubItem = (workItemId: string, title: string, note?: string, driveLink?: string) => {
    if (isViewOnly) return;
    const targetMonth = selectedMonth === 'all' ? (data.availableMonths?.[0] || 'Nov 2026') : selectedMonth;
    const cleanId = workItemId.replace(/^all-/, '');
    const newSubItem: DeliverableSubItem = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      note: note?.trim() || undefined,
      driveLink: driveLink?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setData((prev) => {
      const updatedWorks = prev.worksCompleted.map((w) => {
        if (
          w.id === cleanId ||
          w.id === workItemId ||
          w.id.replace(/^all-/, '') === cleanId ||
          w.activity.trim().toLowerCase() === workItemId.trim().toLowerCase()
        ) {
          const monthlySub = { ...(w.monthlySubItems || {}) };
          const currentList = monthlySub[targetMonth]
            ? [...monthlySub[targetMonth]]
            : w.subItems
            ? [...w.subItems]
            : [];
          const normNewTitle = newSubItem.title.toLowerCase();
          const existingIdx = currentList.findIndex(
            (it) => it.title.trim().toLowerCase() === normNewTitle
          );
          if (existingIdx >= 0) {
            if (newSubItem.note) {
              currentList[existingIdx].note = newSubItem.note;
            }
            if (newSubItem.driveLink) {
              currentList[existingIdx].driveLink = newSubItem.driveLink;
            }
          } else {
            currentList.push(newSubItem);
          }
          const deduplicatedList = deduplicateSubItems(currentList);
          monthlySub[targetMonth] = deduplicatedList;

          const rootSub =
            (w.month && isSameMonth(w.month, targetMonth)) || targetMonth === 'all'
              ? deduplicatedList
              : deduplicateSubItems(w.subItems || []);

          return {
            ...w,
            subItems: rootSub,
            monthlySubItems: monthlySub,
          };
        }
        return w;
      });

      const updatedDashboard = { ...prev, worksCompleted: updatedWorks };
      saveDashboardToStorage(updatedDashboard);
      saveTopicsBackup(updatedWorks);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });

    setIsSavedInStorage(true);

    const deliverableName =
      dataRef.current.worksCompleted.find(
        (w) =>
          w.id === cleanId ||
          w.id === workItemId ||
          w.id.replace(/^all-/, '') === cleanId ||
          w.activity.trim().toLowerCase() === workItemId.trim().toLowerCase()
      )?.activity || workItemId;

    // Save to dedicated Firestore details vault (guaranteed persistence across all reloads & sheet syncs)
    saveDeliverableDetailsToFirestore({
      [newSubItem.id]: {
        id: newSubItem.id,
        activity: deliverableName,
        month: targetMonth,
        title: newSubItem.title,
        note: newSubItem.note,
        driveLink: newSubItem.driveLink,
        createdAt: newSubItem.createdAt,
        updatedAt: new Date().toISOString(),
      },
    }).catch(console.warn);

    // If user configured a Google Apps Script Web App URL, post directly to their Google Sheet in background
    if (syncSettingsRef.current?.webhookUrl) {
      try {
        const cleanLink = driveLink?.trim() || '';
        const cleanNote = note?.trim() || '';
        const cleanTitle = title.trim();

        const webhookPayload = JSON.stringify({
          action: 'upsertTopic',
          deliverable: deliverableName,
          month: targetMonth,
          title: cleanTitle,
          note: cleanNote,
          link: cleanLink,
          driveLink: cleanLink,
          createdAt: newSubItem.createdAt,
        });

        const queryParams = new URLSearchParams({
          action: 'upsertTopic',
          deliverable: deliverableName,
          month: targetMonth,
          title: cleanTitle,
          note: cleanNote,
          link: cleanLink,
          driveLink: cleanLink,
        });

        const targetUrl = syncSettingsRef.current.webhookUrl;
        const separator = targetUrl.includes('?') ? '&' : '?';
        const urlWithParams = `${targetUrl}${separator}${queryParams.toString()}`;

        // Send via text/plain (CORS-safelisted, never blocked by browser)
        fetch(urlWithParams, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: webhookPayload,
        }).catch(() => {
          // Fallback beacon
          try {
            const img = new Image();
            img.src = urlWithParams;
          } catch {}
        });

        const syncKey = buildTopicSyncKey(deliverableName, targetMonth, cleanTitle);
        markTopicsAsSynced([syncKey]);
        markTopicSignaturesAsSynced([{ key: syncKey, note: cleanNote, link: cleanLink }]);
        saveSharedSyncedTopics([syncKey]).catch(console.warn);
        showToast(`Detail "${title}" added & autosaved to Google Sheet!`);
        return;
      } catch (e) {
        console.warn('Google Sheet webhook dispatch error:', e);
      }
    }

    showToast(`Detail "${title}" added & saved!`);
  };

  const handleUpdateSubItem = (
    workItemId: string,
    subItemId: string,
    updates: { title?: string; note?: string; driveLink?: string }
  ) => {
    if (isViewOnly) return;
    const targetMonth = selectedMonth === 'all' ? (data.availableMonths?.[0] || 'Nov 2026') : selectedMonth;
    const cleanId = workItemId.replace(/^all-/, '');

    // Capture previous item values before state mutation so renames/edits sync accurately to Google Sheet
    const currentWork = (dataRef.current.worksCompleted || []).find(
      (w) =>
        w.id === cleanId ||
        w.id === workItemId ||
        w.id.replace(/^all-/, '') === cleanId ||
        w.activity.trim().toLowerCase() === workItemId.trim().toLowerCase()
    );
    const deliverableName = currentWork?.activity || workItemId;
    const existingList = currentWork?.monthlySubItems?.[targetMonth] || currentWork?.subItems || [];
    const prevSubItem = existingList.find((it) => it.id === subItemId);
    const oldTitle = prevSubItem?.title || '';
    const mergedTitle = (updates.title !== undefined ? updates.title : oldTitle).trim();
    const mergedNote = (updates.note !== undefined ? updates.note : prevSubItem?.note || '').trim();
    const mergedLink = (updates.driveLink !== undefined ? updates.driveLink : prevSubItem?.driveLink || '').trim();

    setData((prev) => {
      const updatedWorks = prev.worksCompleted.map((w) => {
        if (
          w.id === cleanId ||
          w.id === workItemId ||
          w.id.replace(/^all-/, '') === cleanId ||
          w.activity.trim().toLowerCase() === workItemId.trim().toLowerCase()
        ) {
          const monthlySub = { ...(w.monthlySubItems || {}) };
          const currentList = monthlySub[targetMonth]
            ? [...monthlySub[targetMonth]]
            : w.subItems
            ? [...w.subItems]
            : [];
          const updatedList = currentList.map((item) => {
            if (item.id === subItemId) {
              return {
                ...item,
                title: updates.title !== undefined ? updates.title : item.title,
                note: updates.note !== undefined ? updates.note : item.note,
                driveLink: updates.driveLink !== undefined ? updates.driveLink : item.driveLink,
              };
            }
            return item;
          });
          monthlySub[targetMonth] = updatedList;

          const rootSub =
            (w.month && isSameMonth(w.month, targetMonth)) || targetMonth === 'all'
              ? updatedList
              : w.subItems || [];

          return {
            ...w,
            subItems: rootSub,
            monthlySubItems: monthlySub,
          };
        }
        return w;
      });

      const updatedDashboard = { ...prev, worksCompleted: updatedWorks };
      saveDashboardToStorage(updatedDashboard);
      saveTopicsBackup(updatedWorks);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });

    setIsSavedInStorage(true);

    if (mergedTitle) {
      saveDeliverableDetailsToFirestore({
        [subItemId]: {
          id: subItemId,
          activity: deliverableName,
          month: targetMonth,
          title: mergedTitle,
          note: mergedNote || undefined,
          driveLink: mergedLink || undefined,
          createdAt: prevSubItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }).catch(console.warn);

      // Push update in place to Google Sheet so edited notes/links/titles stay synchronized without duplicating rows
      if (syncSettingsRef.current?.webhookUrl) {
        try {
          const webhookPayload = JSON.stringify({
            action: 'upsertTopic',
            deliverable: deliverableName,
            month: targetMonth,
            oldTitle: oldTitle && oldTitle !== mergedTitle ? oldTitle : undefined,
            title: mergedTitle,
            note: mergedNote,
            link: mergedLink,
            driveLink: mergedLink,
          });
          const queryParams = new URLSearchParams({
            action: 'upsertTopic',
            deliverable: deliverableName,
            month: targetMonth,
            title: mergedTitle,
            note: mergedNote,
            link: mergedLink,
            driveLink: mergedLink,
          });
          if (oldTitle && oldTitle !== mergedTitle) {
            queryParams.set('oldTitle', oldTitle);
          }
          const targetUrl = syncSettingsRef.current.webhookUrl.trim();
          const separator = targetUrl.includes('?') ? '&' : '?';
          const urlWithParams = `${targetUrl}${separator}${queryParams.toString()}`;

          fetch(urlWithParams, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: webhookPayload,
          }).catch(() => {
            try {
              const img = new Image();
              img.src = urlWithParams;
            } catch {}
          });

          const syncKey = buildTopicSyncKey(deliverableName, targetMonth, mergedTitle);
          markTopicsAsSynced([syncKey]);
          markTopicSignaturesAsSynced([{ key: syncKey, note: mergedNote, link: mergedLink }]);
          saveSharedSyncedTopics([syncKey]).catch(console.warn);
        } catch (err) {
          console.warn('Google Sheet edit sync warning:', err);
        }
      }
    }

    showToast('Detail updated & autosaved!');
  };

  const handleDeleteSubItem = (workItemId: string, subItemId: string) => {
    if (isViewOnly) return;
    const targetMonth = selectedMonth === 'all' ? (data.availableMonths?.[0] || 'Nov 2026') : selectedMonth;
    const cleanId = workItemId.replace(/^all-/, '');

    const deliverableName =
      dataRef.current.worksCompleted.find(
        (w) =>
          w.id === cleanId ||
          w.id === workItemId ||
          w.id.replace(/^all-/, '') === cleanId ||
          w.activity.trim().toLowerCase() === workItemId.trim().toLowerCase()
      )?.activity || workItemId;

    removeSubItemFromBackup(deliverableName, targetMonth, subItemId);

    setData((prev) => {
      const updatedWorks = prev.worksCompleted.map((w) => {
        if (
          w.id === cleanId ||
          w.id === workItemId ||
          w.id.replace(/^all-/, '') === cleanId ||
          w.activity.trim().toLowerCase() === workItemId.trim().toLowerCase()
        ) {
          const monthlySub = { ...(w.monthlySubItems || {}) };
          const currentList = monthlySub[targetMonth]
            ? [...monthlySub[targetMonth]]
            : w.subItems
            ? [...w.subItems]
            : [];
          const targetItem = currentList.find((it) => it.id === subItemId);
          const targetTitle = targetItem?.title?.trim().toLowerCase();
          const updatedList = currentList.filter(
            (item) => item.id !== subItemId && (!targetTitle || item.title.trim().toLowerCase() !== targetTitle)
          );
          const deduplicatedList = deduplicateSubItems(updatedList);
          monthlySub[targetMonth] = deduplicatedList;

          const rootSub =
            (w.month && isSameMonth(w.month, targetMonth)) || targetMonth === 'all'
              ? deduplicatedList
              : deduplicateSubItems(w.subItems || []);

          return {
            ...w,
            subItems: rootSub,
            monthlySubItems: monthlySub,
          };
        }
        return w;
      });

      const updatedDashboard = { ...prev, worksCompleted: updatedWorks };
      saveDashboardToStorage(updatedDashboard);
      saveTopicsBackup(updatedWorks);
      saveSharedDashboardData(updatedDashboard).catch(console.warn);
      return updatedDashboard;
    });

    setIsSavedInStorage(true);
    showToast('Detail removed.');
  };

  const [isSyncingAllTopics, setIsSyncingAllTopics] = useState(false);

  const handleSyncAllTopicsToGoogleSheet = async (forceAll: boolean = false) => {
    const webhookUrl = syncSettingsRef.current?.webhookUrl?.trim();
    if (!webhookUrl) {
      setIsSheetModalOpen(true);
      showToast('Please enter & save your Google Apps Script Web App URL first.', 'error');
      return;
    }

    // Collect & strictly deduplicate all topics (with notes AND links) across worksCompleted
    const topicMap = new Map<
      string,
      { deliverable: string; month: string; title: string; note: string; link: string }
    >();
    const deliverableLinksPayload: Array<{
      month: string;
      deliverable: string;
      note: string;
      link: string;
    }> = [];
    const seenDeliverableLinks = new Set<string>();
    const works = dataRef.current.worksCompleted || [];

    const registerTopic = (
      deliverable: string,
      month: string,
      title: string,
      note?: string,
      link?: string
    ) => {
      const cleanTitle = (title || '').trim();
      if (!cleanTitle) return;
      const key = buildTopicSyncKey(deliverable, month, cleanTitle);
      const prev = topicMap.get(key);
      const cleanNote = (note || '').trim();
      const cleanLink = (link || '').trim();
      if (!prev) {
        topicMap.set(key, {
          deliverable,
          month,
          title: cleanTitle,
          note: cleanNote,
          link: cleanLink,
        });
      } else {
        topicMap.set(key, {
          ...prev,
          note: cleanNote || prev.note,
          link: cleanLink || prev.link,
        });
      }
    };

    for (const w of works) {
      const fallbackMonth = w.month || selectedMonth || 'Nov 2026';
      if (w.driveLink && w.driveLink.trim()) {
        const dlKey = `${fallbackMonth.trim().toLowerCase()}|${w.activity.trim().toLowerCase()}`;
        if (!seenDeliverableLinks.has(dlKey)) {
          seenDeliverableLinks.add(dlKey);
          deliverableLinksPayload.push({
            month: fallbackMonth,
            deliverable: w.activity,
            note: (w.customNote || '').trim(),
            link: w.driveLink.trim(),
          });
        }
      }
      if (w.monthlyDriveLinks) {
        for (const [mName, linkUrl] of Object.entries(w.monthlyDriveLinks)) {
          if (linkUrl && linkUrl.trim()) {
            const dlKey = `${mName.trim().toLowerCase()}|${w.activity.trim().toLowerCase()}`;
            if (!seenDeliverableLinks.has(dlKey)) {
              seenDeliverableLinks.add(dlKey);
              deliverableLinksPayload.push({
                month: mName,
                deliverable: w.activity,
                note: (w.monthlyNotes?.[mName] || w.customNote || '').trim(),
                link: linkUrl.trim(),
              });
            }
          }
        }
      }

      if (w.subItems && w.subItems.length > 0) {
        for (const s of w.subItems) {
          registerTopic(w.activity, fallbackMonth, s.title, s.note, s.driveLink);
        }
      }
      if (w.monthlySubItems) {
        for (const [mName, mList] of Object.entries(w.monthlySubItems)) {
          for (const s of mList || []) {
            registerTopic(w.activity, mName, s.title, s.note, s.driveLink);
          }
        }
      }
    }

    const items = Array.from(topicMap.values());

    if (items.length === 0 && deliverableLinksPayload.length === 0) {
      showToast('No extra details or links found in the dashboard yet.', 'info');
      return;
    }

    // Sync any topic that is either new OR has an edited note or link compared to last sync
    const syncedKeys = forceAll ? new Set<string>() : getSyncedTopicKeys();
    const syncedSigs = forceAll ? {} : getSyncedTopicSignatures();
    const itemsToSync = forceAll
      ? items
      : items.filter((it) => {
          const key = buildTopicSyncKey(it.deliverable, it.month, it.title);
          if (!syncedKeys.has(key)) return true;
          const prevSig = syncedSigs[key];
          const currSig = buildTopicContentSignature(it.note, it.link);
          return prevSig !== currSig;
        });

    if (itemsToSync.length === 0 && deliverableLinksPayload.length === 0) {
      showToast(
        'All details & links are already synced in your Google Sheet! Click "Force All" to re-check every row.',
        'info'
      );
      return;
    }

    setIsSyncingAllTopics(true);
    showToast(
      forceAll
        ? `Force syncing all ${itemsToSync.length} details & links to Google Sheet...`
        : `Backing up ${itemsToSync.length} new/updated detail(s) & links to Google Sheet...`,
      'info'
    );

    try {
      const newlySyncedKeys: string[] = [];
      const newlySyncedSigs: Array<{ key: string; note: string; link: string }> = [];

      // Sync deliverable-level links first if any exist
      if (deliverableLinksPayload.length > 0) {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'syncDeliverableLinks',
            deliverableLinks: deliverableLinksPayload,
          }),
        }).catch(() => {});
      }

      // Send each topic row-by-row with upsertTopic (adds new, updates changed notes/links in place, skips identical)
      for (let i = 0; i < itemsToSync.length; i++) {
        const item = itemsToSync[i];
        const queryParams = new URLSearchParams({
          action: 'upsertTopic',
          deliverable: item.deliverable,
          month: item.month,
          title: item.title,
          note: item.note,
          link: item.link,
          driveLink: item.link,
        });
        const separator = webhookUrl.includes('?') ? '&' : '?';
        const targetWithParams = `${webhookUrl}${separator}${queryParams.toString()}`;

        await fetch(targetWithParams, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'upsertTopic',
            deliverable: item.deliverable,
            month: item.month,
            title: item.title,
            note: item.note,
            link: item.link,
            driveLink: item.link,
          }),
        }).catch(() => {
          try {
            const img = new Image();
            img.src = targetWithParams;
          } catch {}
        });

        const syncKey = buildTopicSyncKey(item.deliverable, item.month, item.title);
        newlySyncedKeys.push(syncKey);
        newlySyncedSigs.push({ key: syncKey, note: item.note, link: item.link });

        if (i < itemsToSync.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      markTopicsAsSynced(newlySyncedKeys);
      markTopicSignaturesAsSynced(newlySyncedSigs);
      saveSharedSyncedTopics(newlySyncedKeys).catch(console.warn);
      showToast(
        forceAll
          ? `Backed up all ${itemsToSync.length} details & saved links into Google Sheet!`
          : `Synced ${itemsToSync.length} new/updated detail(s) & links into Google Sheet!`
      );
    } catch (err) {
      console.error('Error syncing all details to Google Sheet:', err);
      showToast('Sent details & links to Google Sheet. Please check your sheet.', 'info');
    } finally {
      setIsSyncingAllTopics(false);
    }
  };

  const handleExportSubItemsSheet = () => {
    downloadWorkbookWithSubItemsTab(data, selectedMonth);
    showToast('Downloaded Google Sheets workbook with Details Breakdown tab!');
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
    // Preserve any existing custom notes and details for activities present in the newly linked sheet
    const existingByActivity = new Map<string, WorkItem>();
    for (const w of dataRef.current.worksCompleted || []) {
      existingByActivity.set(w.activity.trim().toLowerCase(), w);
    }
    const initialByActivity = new Map<string, WorkItem>();
    for (const w of initialDashboardData.worksCompleted || []) {
      initialByActivity.set(w.activity.trim().toLowerCase(), w);
    }

    const updatedNewWorks = (newData.worksCompleted || []).map((w) =>
      enrichWorkWithSavedNotesAndDetails(w, existingByActivity, initialByActivity)
    );

    const mergedWorks = restoreTopicsFromBackup(updatedNewWorks);
    saveTopicsBackup(mergedWorks);

    const mergedData: DashboardData = {
      ...newData,
      worksCompleted: mergedWorks,
      workListNotes: {
        ...(cloudDeliverableNotesRef.current.workListNotes || {}),
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
          onOpenPresentationMode={() => setIsPresentationOpen(true)}
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
          worksCompleted={data.worksCompleted}
          selectedMonth={selectedMonth}
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
                Enter editor passcode to unlock editing privileges for deliverables, tasks, and notes.
              </p>

              <form onSubmit={handleUnlockEditor} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Passcode
                  </label>
                  <input
                    type="password"
                    placeholder="Enter editor passcode"
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
        onOpenPresentationMode={() => setIsPresentationOpen(true)}
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
            onOpenPresentationMode={() => setIsPresentationOpen(true)}
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
                onAddSubItem={handleAddSubItem}
                onUpdateSubItem={handleUpdateSubItem}
                onDeleteSubItem={handleDeleteSubItem}
                onExportSubItemsSheet={handleExportSubItemsSheet}
                onOpenSyncModal={() => setIsSheetModalOpen(true)}
                onSyncAllTopics={handleSyncAllTopicsToGoogleSheet}
                isSyncingAllTopics={isSyncingAllTopics}
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
        worksCompleted={data.worksCompleted}
        selectedMonth={selectedMonth}
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
              Enter editor passcode to unlock editing privileges for deliverables, tasks, and notes.
            </p>

            <form onSubmit={handleUnlockEditor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Passcode
                </label>
                <input
                  type="password"
                  placeholder="Enter editor passcode"
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

      {/* Meeting / Presentation Mode (Distraction-Free Cinematic Deck) */}
      {isPresentationOpen && (
        <PresentationMode
          data={data}
          tasks={tasks}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onClose={() => setIsPresentationOpen(false)}
        />
      )}
    </div>
  );
}
