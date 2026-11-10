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
  arrayUnion,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TaskItem, DashboardData } from '../types';
import { isTaskDeleted, markTaskAsDeleted } from './taskStorage';

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
          if (isTaskDeleted(docSnap.id)) {
            return;
          }
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
 * Delete a task from Cloud Firestore permanently.
 */
export async function deleteTaskFromFirestore(taskId: string): Promise<void> {
  markTaskAsDeleted(taskId);
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    await deleteDoc(taskRef);
  } catch (err) {
    console.warn('Firestore task doc delete warning:', err);
  }

  try {
    const deletedConfigRef = doc(db, CONFIG_COLLECTION, 'deleted_tasks');
    await setDoc(
      deletedConfigRef,
      {
        ids: arrayUnion(taskId),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore deleted_tasks config update warning:', err);
  }
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

/**
 * Save the entire active dashboard data into Firestore so anyone viewing the app link
 * (in Incognito, on mobile, or across other systems) sees the exact same data in real time!
 */
export async function saveSharedDashboardData(dashboardData: DashboardData): Promise<void> {
  try {
    const configRef = doc(db, CONFIG_COLLECTION, 'active_dashboard');
    const sanitizedWorks = (dashboardData.worksCompleted || []).map((w) => {
      const item: Record<string, any> = {
        id: w.id || '',
        activity: w.activity || '',
        count: Number(w.count || 0),
        category: w.category || 'General',
      };
      if (w.notes !== undefined) item.notes = w.notes;
      if (w.customNote !== undefined) item.customNote = w.customNote;
      if (w.monthlyNotes !== undefined) item.monthlyNotes = w.monthlyNotes;
      if (w.highlight !== undefined) item.highlight = w.highlight;
      if (w.month !== undefined) item.month = w.month;
      if (w.monthlyBreakdown !== undefined) item.monthlyBreakdown = w.monthlyBreakdown;
      if (w.subItems !== undefined) item.subItems = w.subItems;
      if (w.monthlySubItems !== undefined) item.monthlySubItems = w.monthlySubItems;
      return item;
    });

    const payload = JSON.parse(
      JSON.stringify({
        fileName: dashboardData.fileName || 'VZONE.XLSX',
        sheetSourceUrl: dashboardData.sheetSourceUrl || '',
        lastUpdated: dashboardData.lastUpdated || new Date().toISOString(),
        period: dashboardData.period || '',
        selectedMonth: dashboardData.selectedMonth || '',
        availableMonths: dashboardData.availableMonths || [],
        worksCompleted: sanitizedWorks,
        workListNotes: dashboardData.workListNotes || {},
        suggestions: dashboardData.suggestions || [],
        socialAudit: dashboardData.socialAudit || {},
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(configRef, payload);
  } catch (err) {
    console.warn('Failed to save shared dashboard to Firestore:', err);
  }
}

/**
 * Subscribe to the shared active dashboard data from Firestore.
 * This runs for ANY device, incognito tab, or recipient of the link without login.
 */
export function subscribeToSharedDashboardData(
  onDashboardUpdated: (data: DashboardData) => void
): () => void {
  try {
    const configRef = doc(db, CONFIG_COLLECTION, 'active_dashboard');
    return onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data();
          if (raw && Array.isArray(raw.worksCompleted) && raw.worksCompleted.length > 0) {
            const parsedData: DashboardData = {
              fileName: raw.fileName || 'VZONE.XLSX',
              sheetSourceUrl: raw.sheetSourceUrl || '',
              lastUpdated: raw.lastUpdated || new Date().toLocaleDateString(),
              period: raw.period || raw.selectedMonth || 'Nov 2026',
              selectedMonth: raw.selectedMonth || 'Nov 2026',
              availableMonths: Array.isArray(raw.availableMonths) ? raw.availableMonths : [],
              worksCompleted: raw.worksCompleted,
              workListNotes:
                raw.workListNotes && typeof raw.workListNotes === 'object'
                  ? raw.workListNotes
                  : {},
              suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
              socialAudit: raw.socialAudit || undefined,
            };
            onDashboardUpdated(parsedData);
          }
        }
      },
      (error) => {
        console.warn('Firestore active_dashboard subscription error:', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to active_dashboard:', err);
    return () => {};
  }
}

export interface StoredDeliverableDetail {
  id: string;
  activity: string;
  month: string;
  title: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Save all deliverable details to dedicated Firestore config/deliverable_details document
 * This acts as a permanent, immutable details vault that Google Sheet re-syncs can never erase!
 */
export async function saveDeliverableDetailsToFirestore(
  details: Record<string, StoredDeliverableDetail>
): Promise<void> {
  try {
    const ref = doc(db, CONFIG_COLLECTION, 'deliverable_details');
    await setDoc(
      ref,
      {
        details,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to save deliverable_details to Firestore:', err);
  }
}

/**
 * Subscribe to dedicated deliverable_details in Firestore in real time.
 */
export function subscribeToDeliverableDetails(
  onDetailsUpdated: (details: Record<string, StoredDeliverableDetail>) => void
): () => void {
  try {
    const ref = doc(db, CONFIG_COLLECTION, 'deliverable_details');
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data();
          if (raw && raw.details && typeof raw.details === 'object') {
            onDetailsUpdated(raw.details);
          }
        }
      },
      (error) => {
        console.warn('Firestore deliverable_details subscription error:', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to deliverable_details:', err);
    return () => {};
  }
}

