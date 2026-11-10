import { DashboardData, WorkItem, DeliverableSubItem, SyncSettings } from '../types';

const STORAGE_KEY = 'vzone_marketing_dashboard_data_v1';
const STORAGE_META_KEY = 'vzone_marketing_dashboard_meta_v1';
const TOPICS_BACKUP_KEY = 'vzone_marketing_dashboard_topics_backup_v1';

export interface StorageMeta {
  savedAt: string;
  fileName: string;
  totalWorks: number;
}

/**
 * Save dashboard data to browser local storage
 */
export function saveDashboardToStorage(data: DashboardData): boolean {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);

    const meta: StorageMeta = {
      savedAt: new Date().toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      fileName: data.fileName,
      totalWorks: data.worksCompleted.length,
    };
    localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    return true;
  } catch (error) {
    console.error('Failed to save dashboard data to localStorage:', error);
    return false;
  }
}

/**
 * Load dashboard data from browser local storage
 */
export function loadDashboardFromStorage(): { data: DashboardData; meta: StorageMeta } | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;

    const data: DashboardData = JSON.parse(serialized);
    const metaStr = localStorage.getItem(STORAGE_META_KEY);
    const meta: StorageMeta = metaStr
      ? JSON.parse(metaStr)
      : {
          savedAt: 'Previously saved',
          fileName: data.fileName,
          totalWorks: data.worksCompleted?.length || 0,
        };

    return { data, meta };
  } catch (error) {
    console.error('Failed to load dashboard data from localStorage:', error);
    return null;
  }
}

/**
 * Clear saved dashboard data from browser local storage
 */
export function clearDashboardFromStorage(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear dashboard data from localStorage:', error);
    return false;
  }
}

/**
 * Check if saved data exists in local storage
 */
export function hasSavedDataInStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

const STORAGE_SYNC_KEY = 'vzone_marketing_dashboard_sync_v1';

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSync: true,
  interval: '1m',
};

export function saveSyncSettingsToStorage(settings: SyncSettings): void {
  try {
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save sync settings to localStorage:', e);
  }
}

export function loadSyncSettingsFromStorage(): SyncSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_KEY);
    if (raw) {
      return { ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load sync settings from localStorage:', e);
  }
  return DEFAULT_SYNC_SETTINGS;
}

/**
 * Retrieve the current raw topics/details backup dictionary
 */
export function getTopicsBackup(): Record<
  string,
  { subItems?: DeliverableSubItem[]; monthlySubItems?: Record<string, DeliverableSubItem[]> }
> {
  try {
    const raw = localStorage.getItem(TOPICS_BACKUP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves a dedicated, resilient topics/details backup in localStorage.
 * Crucially, this NEVER wipes previously saved items or drops existing details!
 */
export function saveTopicsBackup(works: WorkItem[]): void {
  try {
    const backup: Record<
      string,
      { subItems?: DeliverableSubItem[]; monthlySubItems?: Record<string, DeliverableSubItem[]> }
    > = getTopicsBackup();

    for (const w of works) {
      const key = w.activity.trim().toLowerCase();
      const existing = backup[key] || {};

      const mergedMonthly: Record<string, DeliverableSubItem[]> = {
        ...(existing.monthlySubItems || {}),
        ...(w.monthlySubItems || {}),
      };

      // Union by sub-item ID so no item is ever lost
      if (existing.monthlySubItems && w.monthlySubItems) {
        for (const [m, list] of Object.entries(w.monthlySubItems)) {
          const oldList = existing.monthlySubItems[m] || [];
          const seen = new Set((list || []).map((i) => i.id));
          const combined = [...(list || [])];
          for (const item of oldList) {
            if (!seen.has(item.id)) {
              combined.push(item);
              seen.add(item.id);
            }
          }
          mergedMonthly[m] = combined;
        }
      }

      // Merge root subItems
      const oldSub = existing.subItems || [];
      const newSub = w.subItems || [];
      const seenRoot = new Set(newSub.map((i) => i.id));
      const combinedSub = [...newSub];
      for (const item of oldSub) {
        if (!seenRoot.has(item.id)) {
          combinedSub.push(item);
          seenRoot.add(item.id);
        }
      }

      if (combinedSub.length > 0 || Object.keys(mergedMonthly).length > 0) {
        backup[key] = {
          subItems: combinedSub,
          monthlySubItems: mergedMonthly,
        };
      }
    }

    localStorage.setItem(TOPICS_BACKUP_KEY, JSON.stringify(backup));
  } catch (e) {
    console.error('Failed to save topics backup:', e);
  }
}

/**
 * Explicitly removes a sub-item from persistent backup when user intentionally clicks delete.
 */
export function removeSubItemFromBackup(
  activity: string,
  targetMonth: string,
  subItemId: string
): void {
  try {
    const backup = getTopicsBackup();
    const key = activity.trim().toLowerCase();
    const entry = backup[key];
    if (!entry) return;

    if (entry.monthlySubItems && entry.monthlySubItems[targetMonth]) {
      entry.monthlySubItems[targetMonth] = entry.monthlySubItems[targetMonth].filter(
        (i) => i.id !== subItemId
      );
    }
    if (entry.subItems) {
      entry.subItems = entry.subItems.filter((i) => i.id !== subItemId);
    }
    localStorage.setItem(TOPICS_BACKUP_KEY, JSON.stringify(backup));
  } catch (e) {
    console.error('Failed to remove sub item from backup:', e);
  }
}

/**
 * Restores any topics/details from the backup if a sync, sheet reload, or cloud update omitted them.
 */
export function restoreTopicsFromBackup(works: WorkItem[]): WorkItem[] {
  try {
    const backup = getTopicsBackup();
    if (!backup || Object.keys(backup).length === 0) return works;

    return works.map((w) => {
      const key = w.activity.trim().toLowerCase();
      const saved = backup[key];
      if (!saved) return w;

      const mergedMonthly: Record<string, DeliverableSubItem[]> = {
        ...(saved.monthlySubItems || {}),
        ...(w.monthlySubItems || {}),
      };

      if (saved.monthlySubItems) {
        for (const [m, list] of Object.entries(saved.monthlySubItems)) {
          const current = mergedMonthly[m] || [];
          const seen = new Set(current.map((i) => i.id));
          const combined = [...current];
          for (const it of list || []) {
            if (!seen.has(it.id)) {
              seen.add(it.id);
              combined.push(it);
            }
          }
          mergedMonthly[m] = combined;
        }
      }

      // Resolve active subItems for this deliverable's target month
      let activeSub: DeliverableSubItem[] = [];
      if (w.month && mergedMonthly[w.month] && mergedMonthly[w.month].length > 0) {
        activeSub = mergedMonthly[w.month];
      } else if (w.subItems && w.subItems.length > 0) {
        activeSub = w.subItems;
      } else if (saved.subItems && saved.subItems.length > 0) {
        activeSub = saved.subItems;
      }

      return {
        ...w,
        subItems: activeSub,
        monthlySubItems: mergedMonthly,
      };
    });
  } catch (e) {
    console.error('Failed to restore topics backup:', e);
    return works;
  }
}

const SYNCED_TOPICS_KEY = 'vzone_marketing_dashboard_synced_topics_v1';

/**
 * Normalizes a topic key for deduplication check:
 * e.g. "reels video|nov 2026|my topic title"
 */
export function buildTopicSyncKey(deliverable: string, month: string, title: string): string {
  return `${deliverable.trim().toLowerCase()}|${month.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

/**
 * Retrieve all topic keys that have already been exported/synced to Google Sheet
 */
export function getSyncedTopicKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_TOPICS_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (e) {
    console.error('Failed to get synced topic keys:', e);
  }
  return new Set();
}

/**
 * Mark topic keys as synced so future sync operations skip them
 */
export function markTopicsAsSynced(keys: string[]): void {
  try {
    const current = getSyncedTopicKeys();
    for (const k of keys) {
      if (k) current.add(k.trim().toLowerCase());
    }
    localStorage.setItem(SYNCED_TOPICS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Failed to mark topics as synced:', e);
  }
}

/**
 * Reset synced keys if user wishes to force full re-sync
 */
export function clearSyncedTopicKeys(): void {
  try {
    localStorage.removeItem(SYNCED_TOPICS_KEY);
  } catch {}
}

