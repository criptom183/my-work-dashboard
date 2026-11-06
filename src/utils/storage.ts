import { DashboardData } from '../types';

const STORAGE_KEY = 'vzone_marketing_dashboard_data_v1';
const STORAGE_META_KEY = 'vzone_marketing_dashboard_meta_v1';

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

import { SyncSettings } from '../types';

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
