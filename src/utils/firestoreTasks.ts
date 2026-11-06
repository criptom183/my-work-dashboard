import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TaskItem } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

const TASKS_COLLECTION = 'tasks';
const CONFIG_COLLECTION = 'config';

/**
 * Subscribe to tasks in Cloud Firestore in real time.
 * This runs for ANY device and ANY visitor without requiring login.
 */
export function subscribeToFirestoreTasks(
  onTasksUpdated: (tasks: TaskItem[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const tasksRef = collection(db, TASKS_COLLECTION);
    const q = query(tasksRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks: TaskItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          tasks.push({
            id: docSnap.id,
            title: data.title || '',
            description: data.description || undefined,
            priority: data.priority || 'Medium',
            status: data.status || 'pending',
            category: data.category || 'General',
            assignedTo: data.assignedTo || undefined,
            dueDate: data.dueDate || undefined,
            subtasks: Array.isArray(data.subtasks) ? data.subtasks : undefined,
            tags: Array.isArray(data.tags) ? data.tags : undefined,
            createdAt: data.createdAt || new Date().toISOString(),
            completedAt: data.completedAt || undefined,
          });
        });

        // Sort by createdAt descending
        tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onTasksUpdated(tasks);
      },
      (error) => {
        console.warn('Firestore tasks snapshot error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to Firestore tasks:', err);
    return () => {};
  }
}

/**
 * Save or update a single task in Cloud Firestore.
 */
export async function saveTaskToFirestore(task: TaskItem): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, task.id);
  const payload: Record<string, any> = {
    title: task.title,
    priority: task.priority,
    status: task.status,
    category: task.category,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (task.description !== undefined) payload.description = task.description;
  if (task.assignedTo !== undefined) payload.assignedTo = task.assignedTo;
  if (task.dueDate !== undefined) payload.dueDate = task.dueDate;
  if (task.subtasks !== undefined) payload.subtasks = task.subtasks;
  if (task.tags !== undefined) payload.tags = task.tags;
  if (task.completedAt !== undefined) payload.completedAt = task.completedAt;

  await setDoc(taskRef, payload, { merge: true });
}

/**
 * Delete a task from Cloud Firestore.
 */
export async function deleteTaskFromFirestore(taskId: string): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);
}

/**
 * Save shared sheet link across devices.
 */
export async function saveSharedSheetUrl(sheetUrl: string): Promise<void> {
  const configRef = doc(db, CONFIG_COLLECTION, 'sheet_source');
  await setDoc(configRef, { sheetUrl, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Subscribe to shared sheet URL across devices.
 */
export function subscribeToSharedSheetUrl(
  onUrlUpdated: (url: string) => void
): () => void {
  try {
    const configRef = doc(db, CONFIG_COLLECTION, 'sheet_source');
    return onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.sheetUrl && typeof data.sheetUrl === 'string') {
          onUrlUpdated(data.sheetUrl);
        }
      }
    });
  } catch {
    return () => {};
  }
}
