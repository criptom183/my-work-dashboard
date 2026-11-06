import { TaskItem } from '../types';
import { initialTasks } from '../data/initialTasks';

const TASKS_STORAGE_KEY = 'vzone_task_manager_tasks_v1';

export function loadTasksFromStorage(): TaskItem[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return initialTasks;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return initialTasks;
  } catch (err) {
    console.warn('Failed to load tasks from localStorage:', err);
    return initialTasks;
  }
}

export function saveTasksToStorage(tasks: TaskItem[]): boolean {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
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
