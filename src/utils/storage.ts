import { DashboardData, WorkItem, DeliverableSubItem, SyncSettings } from '../types';
import { DEPRECATED_SHEET_IDS, DEFAULT_GOOGLE_SHEET_URL } from '../data/initialData';

const OLD_STORAGE_KEYS = [
  'vzone_marketing_dashboard_data_v1',
  'vzone_marketing_dashboard_data_v2',
  'vzone_marketing_dashboard_data_v3',
  'vzone_marketing_dashboard_meta_v1',
  'vzone_marketing_dashboard_meta_v2',
  'vzone_marketing_dashboard_meta_v3',
  'vzone_marketing_dashboard_topics_backup_v1',
];
const STORAGE_KEY = 'vzone_marketing_dashboard_data_v4';
const STORAGE_META_KEY = 'vzone_marketing_dashboard_meta_v4';
const TOPICS_BACKUP_KEY = 'vzone_marketing_dashboard_topics_backup_v2';

const DEPRECATED_SUB_ITEM_IDS = new Set(['sub-reel-1', 'sub-reel-2', 'sub-reel-3']);
const DEPRECATED_SUB_ITEM_TITLES = new Set([
  'episode 1: fuel sensors live demo',
  'episode 2: how fleet tracking prevents fuel theft',
  'episode 3: driver scorecard & speed alerts',
]);

export function isDeprecatedSubItem(item?: DeliverableSubItem | null): boolean {
  if (!item) return true;
  if (item.id && DEPRECATED_SUB_ITEM_IDS.has(item.id.trim())) return true;
  if (item.title && DEPRECATED_SUB_ITEM_TITLES.has(item.title.trim().toLowerCase())) return true;
  return false;
}

export function filterValidSubItems(list?: DeliverableSubItem[]): DeliverableSubItem[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const clean: DeliverableSubItem[] = [];
  for (const item of list) {
    if (isDeprecatedSubItem(item)) continue;
    if (!seen.has(item.id)) {
      seen.add(item.id);
      clean.push(item);
    }
  }
  return clean;
}

export function sanitizeWorkItemSubItems(w: WorkItem): WorkItem {
  const cleanRoot = filterValidSubItems(w.subItems);
  const cleanMonthly: Record<string, DeliverableSubItem[]> = {};
  if (w.monthlySubItems && typeof w.monthlySubItems === 'object') {
    for (const [m, list] of Object.entries(w.monthlySubItems)) {
      cleanMonthly[m] = filterValidSubItems(list);
    }
  }
  return {
    ...w,
    subItems: cleanRoot,
    monthlySubItems: cleanMonthly,
  };
}

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
    for (const k of OLD_STORAGE_KEYS) {
      localStorage.removeItem(k);
    }
    const cleanData: DashboardData = {
      ...data,
      worksCompleted: (data.worksCompleted || []).map(sanitizeWorkItemSubItems),
    };
    const serialized = JSON.stringify(cleanData);
    localStorage.setItem(STORAGE_KEY, serialized);

    const meta: StorageMeta = {
      savedAt: new Date().toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      fileName: cleanData.fileName,
      totalWorks: cleanData.worksCompleted.length,
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
    // Purge legacy caches that held the old Google Sheet link or old sample sub-items
    for (const k of OLD_STORAGE_KEYS) {
      localStorage.removeItem(k);
    }

    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;

    const data: DashboardData = JSON.parse(serialized);

    // If stored data points to a deprecated sheet ID, discard it so the new sheet is used cleanly
    if (
      data.sheetSourceUrl &&
      DEPRECATED_SHEET_IDS.some((oldId) => data.sheetSourceUrl?.includes(oldId))
    ) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_META_KEY);
      return null;
    }

    if (!data.sheetSourceUrl) {
      data.sheetSourceUrl = DEFAULT_GOOGLE_SHEET_URL;
    }

    // Filter out any legacy duplicate row and sanitize all sub-items
    if (Array.isArray(data.worksCompleted)) {
      const hasNewNewsRow = data.worksCompleted.some((w) =>
        w.activity.toLowerCase().includes('incl. malayalam')
      );
      if (hasNewNewsRow) {
        data.worksCompleted = data.worksCompleted.filter(
          (w) => w.activity.trim().toLowerCase() !== 'news or awareness reels'
        );
      }
      data.worksCompleted = data.worksCompleted.map(sanitizeWorkItemSubItems);
    }

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
 * Retrieve the current raw topics/details backup dictionary (with sample dummy items stripped)
 */
export function getTopicsBackup(): Record<
  string,
  { subItems?: DeliverableSubItem[]; monthlySubItems?: Record<string, DeliverableSubItem[]> }
> {
  try {
    localStorage.removeItem('vzone_marketing_dashboard_topics_backup_v1');
    const raw = localStorage.getItem(TOPICS_BACKUP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const cleaned: Record<
      string,
      { subItems?: DeliverableSubItem[]; monthlySubItems?: Record<string, DeliverableSubItem[]> }
    > = {};
    for (const [k, entry] of Object.entries<any>(parsed || {})) {
      const subItems = filterValidSubItems(entry?.subItems);
      const monthlySubItems: Record<string, DeliverableSubItem[]> = {};
      if (entry?.monthlySubItems && typeof entry.monthlySubItems === 'object') {
        for (const [m, list] of Object.entries<any>(entry.monthlySubItems)) {
          monthlySubItems[m] = filterValidSubItems(list);
        }
      }
      cleaned[k] = { subItems, monthlySubItems };
    }
    return cleaned;
  } catch {
    return {};
  }
}

/**
 * Saves a dedicated, resilient topics/details backup in localStorage.
 * Strips any legacy dummy sample items (sub-reel-1, sub-reel-2, sub-reel-3).
 */
export function saveTopicsBackup(works: WorkItem[]): void {
  try {
    const backup: Record<
      string,
      { subItems?: DeliverableSubItem[]; monthlySubItems?: Record<string, DeliverableSubItem[]> }
    > = getTopicsBackup();

    for (const rawWork of works) {
      const w = sanitizeWorkItemSubItems(rawWork);
      const key = w.activity.trim().toLowerCase();
      const existing = backup[key] || {};

      const mergedMonthly: Record<string, DeliverableSubItem[]> = {
        ...(existing.monthlySubItems || {}),
        ...(w.monthlySubItems || {}),
      };

      // Union by sub-item ID so no real item is ever lost
      if (existing.monthlySubItems && w.monthlySubItems) {
        for (const [m, list] of Object.entries(w.monthlySubItems)) {
          const oldList = filterValidSubItems(existing.monthlySubItems[m]);
          const newList = filterValidSubItems(list);
          const seen = new Set(newList.map((i) => i.id));
          const combined = [...newList];
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
      const oldSub = filterValidSubItems(existing.subItems);
      const newSub = filterValidSubItems(w.subItems);
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
    const sanitizedInput = (works || []).map(sanitizeWorkItemSubItems);
    const backup = getTopicsBackup();
    if (!backup || Object.keys(backup).length === 0) return sanitizedInput;

    return sanitizedInput.map((w) => {
      const key = w.activity.trim().toLowerCase();
      const saved = backup[key];
      if (!saved) return w;

      const mergedMonthly: Record<string, DeliverableSubItem[]> = {
        ...(saved.monthlySubItems || {}),
        ...(w.monthlySubItems || {}),
      };

      if (saved.monthlySubItems) {
        for (const [m, list] of Object.entries(saved.monthlySubItems)) {
          const current = filterValidSubItems(mergedMonthly[m]);
          const seen = new Set(current.map((i) => i.id));
          const combined = [...current];
          for (const it of filterValidSubItems(list)) {
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
        activeSub = filterValidSubItems(mergedMonthly[w.month]);
      } else if (w.subItems && w.subItems.length > 0) {
        activeSub = filterValidSubItems(w.subItems);
      } else if (saved.subItems && saved.subItems.length > 0) {
        activeSub = filterValidSubItems(saved.subItems);
      }

      return {
        ...w,
        subItems: activeSub,
        monthlySubItems: mergedMonthly,
      };
    });
  } catch (e) {
    console.error('Failed to restore topics backup:', e);
    return (works || []).map(sanitizeWorkItemSubItems);
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
