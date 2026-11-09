import { TaskItem } from '../types';
import { initialTasks } from '../data/initialTasks';

const TASKS_STORAGE_KEY = 'vzone_task_manager_tasks_v1';
const DELETED_TASKS_KEY = 'vzone_deleted_task_ids_v1';

/**
 * Get all task IDs that have been explicitly deleted by the user.
 */
export function getDeletedTaskIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_TASKS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }
  } catch (err) {
    console.warn('Failed to parse deleted task IDs:', err);
  }
  return new Set();
}

/**
 * Mark a task ID as permanently deleted so it cannot be revived by sync or refresh.
 */
export function markTaskAsDeleted(taskId: string): void {
  try {
    const current = getDeletedTaskIds();
    current.add(taskId);
    localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.error('Failed to mark task as deleted:', err);
  }
}

/**
 * Check if a task ID was previously deleted.
 */
export function isTaskDeleted(taskId: string): boolean {
  return getDeletedTaskIds().has(taskId);
}

export function loadTasksFromStorage(): TaskItem[] {
  try {
    const deletedIds = getDeletedTaskIds();
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    
    // If user has saved tasks before (even an empty list), respect their choice!
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t) => !deletedIds.has(t.id));
      }
    }

    // First time visitor: seed with initial tasks minus any deleted IDs
    return initialTasks.filter((t) => !deletedIds.has(t.id));
  } catch (err) {
    console.warn('Failed to load tasks from localStorage:', err);
    return [];
  }
}

export function saveTasksToStorage(tasks: TaskItem[]): boolean {
  try {
    const deletedIds = getDeletedTaskIds();
    const filtered = tasks.filter((t) => !deletedIds.has(t.id));
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to save tasks to localStorage:', err);
    return false;
  }
}

export function clearTasksFromStorage(): void {
  try {
    localStorage.removeItem(TASKS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear tasks from localStorage:', err);
  }
}

