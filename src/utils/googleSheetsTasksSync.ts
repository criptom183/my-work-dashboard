import * as XLSX from 'xlsx';
import { TaskItem, TaskPriority, TaskStatus, TaskSubtask } from '../types';

export const TASKS_SHEET_NAME = 'Tasks';

/**
 * Extracts a Google Spreadsheet ID from either a full URL or a raw ID string.
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Parses arbitrary tabular rows from Google Sheets or Excel into structured TaskItem objects.
 * Intelligently maps header columns or falls back to positional columns.
 */
export function parseTasksFromRows(rows: any[][]): TaskItem[] {
  if (!rows || rows.length <= 1) return [];

  // Determine header row index and header column mapping
  let headerRowIndex = 0;
  let idCol = -1;
  let titleCol = -1;
  let descCol = -1;
  let catCol = -1;
  let priCol = -1;
  let statCol = -1;
  let assignCol = -1;
  let dueCol = -1;
  let subCol = -1;
  let dateCol = -1;

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const header = row.map((c: any) => String(c || '').trim().toLowerCase());

    let foundTitle = -1;
    for (let c = 0; c < header.length; c++) {
      const h = header[c];
      if (h.includes('id') && !h.includes('video') && !h.includes('idea')) idCol = c;
      else if (
        h.includes('title') ||
        h.includes('task') ||
        h.includes('activity') ||
        h.includes('deliverable')
      )
        foundTitle = c;
      else if (h.includes('desc') || h.includes('detail') || h.includes('note')) descCol = c;
      else if (h.includes('cat') || h.includes('stream') || h.includes('type')) catCol = c;
      else if (h.includes('pri') || h.includes('urgency') || h.includes('impact')) priCol = c;
      else if (h.includes('stat') || h.includes('state') || h.includes('progress')) statCol = c;
      else if (
        h.includes('assign') ||
        h.includes('owner') ||
        h.includes('who') ||
        h.includes('lead')
      )
        assignCol = c;
      else if (h.includes('due') || h.includes('deadline')) dueCol = c;
      else if (h.includes('sub') || h.includes('check') || h.includes('item')) subCol = c;
      else if (h.includes('date') || h.includes('update') || h.includes('created')) dateCol = c;
    }

    if (foundTitle !== -1) {
      titleCol = foundTitle;
      headerRowIndex = r;
      break;
    }
  }

  // Fallbacks if columns were not detected by header name
  if (titleCol === -1) titleCol = 1;
  if (idCol === -1) idCol = 0;
  if (descCol === -1) descCol = 2;
  if (catCol === -1) catCol = 3;
  if (priCol === -1) priCol = 4;
  if (statCol === -1) statCol = 5;
  if (assignCol === -1) assignCol = 6;
  if (dueCol === -1) dueCol = 7;
  if (subCol === -1) subCol = 8;
  if (dateCol === -1) dateCol = 9;

  const tasks: TaskItem[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const title = String(row[titleCol] || '').trim();
    if (!title) continue;

    // Skip accidental repeated header labels
    const lowerTitle = title.toLowerCase();
    if (
      lowerTitle === 'task title' ||
      lowerTitle === 'task' ||
      lowerTitle === 'title' ||
      lowerTitle === 'activity'
    ) {
      continue;
    }

    const id = String(row[idCol] || `task-${Date.now()}-${r}`).trim();
    const description = String(row[descCol] || '').trim();
    const category = String(row[catCol] || 'Deliverables').trim();

    const rawPri = String(row[priCol] || '').trim();
    const priority: TaskPriority =
      rawPri === 'High' || rawPri === 'Low' ? (rawPri as TaskPriority) : 'Medium';

    const rawStat = String(row[statCol] || '').trim().toLowerCase();
    const status: TaskStatus =
      rawStat === 'completed' || rawStat === 'done'
        ? 'completed'
        : rawStat === 'in-progress' || rawStat === 'in progress'
        ? 'in-progress'
        : rawStat === 'in-review' || rawStat === 'review'
        ? 'in-review'
        : 'pending';

    const assignedTo = String(row[assignCol] || '').trim();
    const dueDate = String(row[dueCol] || '').trim();
    const createdAt = String(row[dateCol] || '').trim() || new Date().toISOString().split('T')[0];

    // Parse subtasks if present
    let subtasks: TaskSubtask[] = [];
    const rawSub = String(row[subCol] || '').trim();
    if (rawSub) {
      try {
        const parsed = JSON.parse(rawSub);
        if (Array.isArray(parsed)) {
          subtasks = parsed;
        }
      } catch {
        const parts = rawSub.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        subtasks = parts.map((pt, idx) => ({
          id: `sub-${id}-${idx}`,
          title: pt,
          completed: false,
        }));
      }
    }

    tasks.push({
      id,
      title,
      description: description || undefined,
      category,
      priority,
      status,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      createdAt,
    });
  }

  return tasks;
}

/**
 * Fetches tasks from the 'Tasks' tab of a Google Sheet WITHOUT requiring ANY login or OAuth.
 * Works for any Google Sheet shared with "Anyone with the link can view".
 */
export async function fetchTasksPubliclyFromGoogleSheet(
  sheetUrlOrId: string
): Promise<TaskItem[]> {
  const targetId = extractSpreadsheetId(sheetUrlOrId);
  if (!targetId) {
    throw new Error('Invalid Google Sheet URL or ID.');
  }

  // Strategy 1: Google Visualization (GViz) CSV export for the 'Tasks' sheet
  // This is direct, instant, and supports tab names publicly without requiring login
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    TASKS_SHEET_NAME
  )}&_t=${Date.now()}`;

  try {
    const res = await fetch(gvizUrl, {
      method: 'GET',
      headers: { Accept: 'text/csv,text/plain,*/*' },
      cache: 'no-store',
    });

    if (res.ok) {
      const csvText = await res.text();
      // Verify it's valid CSV and not a Google sign-in redirect page
      if (
        csvText &&
        !csvText.includes('<!DOCTYPE html>') &&
        !csvText.includes('<html') &&
        csvText.trim().length > 0
      ) {
        const workbook = XLSX.read(csvText, { type: 'string' });
        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          const sheet = workbook.Sheets[firstSheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const parsed = parseTasksFromRows(rows);
          if (parsed.length > 0) {
            return parsed;
          }
        }
      }
    }
  } catch (err) {
    console.warn('GViz public CSV tasks fetch note:', err);
  }

  // Strategy 2: Multi-tab XLSX download
  // If the sheet has a 'Tasks' tab, XLSX export preserves it without login
  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${targetId}/export?format=xlsx&_t=${Date.now()}`;
  try {
    const res = await fetch(xlsxUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Validate zip magic header PK (0x50, 0x4B)
      if (bytes.length > 50 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
        const workbook = XLSX.read(bytes, { type: 'array' });
        const targetSheetName = workbook.SheetNames.find(
          (name) => name.trim().toLowerCase() === TASKS_SHEET_NAME.toLowerCase()
        );
        if (targetSheetName) {
          const sheet = workbook.Sheets[targetSheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          return parseTasksFromRows(rows);
        }
      }
    }
  } catch (err) {
    console.warn('XLSX public workbook tasks fetch note:', err);
  }

  return [];
}

/**
 * Checks if the 'Tasks' tab exists in the spreadsheet, and creates it if missing.
 * (Requires OAuth accessToken for writing/modifying the sheet structure)
 */
export async function ensureTasksTabExists(sheetId: string, accessToken: string): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const res = await fetch(metaUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error('Access denied. Please check Google Sheets edit permissions.');
    }
    throw new Error(`Failed to read spreadsheet details (HTTP ${res.status})`);
  }

  const data = await res.json();
  const sheets: Array<{ properties?: { title?: string } }> = data.sheets || [];
  const exists = sheets.some(
    (s) => s.properties?.title?.trim().toLowerCase() === TASKS_SHEET_NAME.toLowerCase()
  );

  if (!exists) {
    // Create the 'Tasks' sheet
    const addSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const addRes = await fetch(addSheetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: TASKS_SHEET_NAME,
                gridProperties: {
                  rowCount: 500,
                  columnCount: 12,
                },
              },
            },
          },
        ],
      }),
    });

    if (!addRes.ok) {
      const errJson = await addRes.json().catch(() => ({}));
      throw new Error(
        errJson.error?.message || `Failed to create '${TASKS_SHEET_NAME}' tab in Google Sheet`
      );
    }
  }
}

/**
 * Reads all tasks from the 'Tasks' tab using the authenticated Google Sheets API.
 */
export async function fetchTasksFromGoogleSheet(
  sheetId: string,
  accessToken: string
): Promise<TaskItem[]> {
  await ensureTasksTabExists(sheetId, accessToken);

  const range = `${TASKS_SHEET_NAME}!A1:J500`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    range
  )}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch tasks from Google Sheet (HTTP ${res.status})`);
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];
  return parseTasksFromRows(rows);
}

/**
 * Saves all tasks directly into the 'Tasks' tab of the user's Google Sheet.
 * (Requires OAuth accessToken and write permission)
 */
export async function saveTasksToGoogleSheet(
  sheetId: string,
  tasks: TaskItem[],
  accessToken: string
): Promise<void> {
  // Ensure the 'Tasks' tab exists
  await ensureTasksTabExists(sheetId, accessToken);

  // Prepare tabular rows
  const header = [
    'Task ID',
    'Task Title',
    'Description',
    'Category',
    'Priority',
    'Status',
    'Assigned To',
    'Due Date',
    'Subtasks (JSON)',
    'Last Updated',
  ];

  const rows = tasks.map((t) => [
    t.id,
    t.title,
    t.description || '',
    t.category || 'Deliverables',
    t.priority,
    t.status,
    t.assignedTo || '',
    t.dueDate || '',
    t.subtasks && t.subtasks.length > 0 ? JSON.stringify(t.subtasks) : '',
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  ]);

  const allValues = [header, ...rows];

  // 1. Clear existing tasks range
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    `${TASKS_SHEET_NAME}!A1:J500`
  )}:clear`;

  await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  // 2. Write new tasks rows
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    `${TASKS_SHEET_NAME}!A1`
  )}?valueInputOption=USER_ENTERED`;

  const writeRes = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: `${TASKS_SHEET_NAME}!A1`,
      majorDimension: 'ROWS',
      values: allValues,
    }),
  });

  if (!writeRes.ok) {
    const errJson = await writeRes.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to write tasks to Google Sheet (HTTP ${writeRes.status})`
    );
  }
}
