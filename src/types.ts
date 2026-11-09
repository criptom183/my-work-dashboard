export type PriorityLevel = 'High' | 'Medium' | 'Low' | 'Unset';
export type SuggestionStatus = 'Open' | 'Under Review' | 'Approved' | 'Implemented';
export type AuditCheckStatus = 'passed' | 'warning' | 'failed' | 'pending';

export interface WorkItem {
  id: string;
  activity: string;
  count: number;
  category: string;
  notes?: string;
  customNote?: string;
  monthlyNotes?: Record<string, string>;
  highlight?: boolean;
  month?: string; // e.g. 'Oct 2026' or 'September'
  monthlyBreakdown?: Record<string, number>; // e.g. { 'Aug 2026': 15, 'Sep 2026': 18, 'Oct 2026': 21 }
}

export interface SuggestionItem {
  id: string;
  sNo: number;
  title: string;
  priority: PriorityLevel;
  status: SuggestionStatus;
  category: string;
  suggestedBy?: string;
  notes?: string;
}

export interface AuditCheck {
  id: string;
  label: string;
  status: AuditCheckStatus;
  feedback: string;
}

export interface ActionItem {
  id: string;
  task: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo?: string;
}

export interface SocialAuditPlatform {
  platform: 'Instagram' | 'LinkedIn' | 'Facebook' | 'YouTube' | 'Twitter / X';
  handle: string;
  followers: number | null;
  following: number | null;
  totalPosts: number;
  engagementRate: number;
  auditScore: number;
  checks: AuditCheck[];
  pendingActions: ActionItem[];
}

export interface DashboardData {
  fileName: string;
  sheetSourceUrl?: string;
  lastUpdated: string;
  period: string;
  selectedMonth?: string;
  availableMonths?: string[];
  worksCompleted: WorkItem[];
  suggestions: SuggestionItem[];
  socialAudit: SocialAuditPlatform;
  tasks?: TaskItem[];
  workListNotes?: Record<string, string>;
}

export type AutoSyncInterval = 'off' | '30s' | '1m' | '5m' | '15m';

export interface SyncSettings {
  autoSync: boolean;
  interval: AutoSyncInterval;
  lastSyncedAt?: string;
}

export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'pending' | 'in-progress' | 'in-review' | 'completed';

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  assignedTo?: string;
  dueDate?: string;
  subtasks?: TaskSubtask[];
  tags?: string[];
  createdAt: string;
  completedAt?: string;
}

