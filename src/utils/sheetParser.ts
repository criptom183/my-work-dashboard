import * as XLSX from 'xlsx';
import {
  DashboardData,
  WorkItem,
  SuggestionItem,
  PriorityLevel,
  SocialAuditPlatform,
  SuggestionStatus,
  AuditCheck,
  ActionItem,
  TaskItem,
} from '../types';
import {
  isMonthColumnHeader,
  isMonthName,
  normalizeMonth,
  sortMonthsChronologically,
  isSameMonth,
} from './monthHelper';
import { parseTasksFromRows } from './googleSheetsTasksSync';
import { deduplicateSubItems } from './storage';

export function extractGoogleSheetId(url: string): { sheetId: string | null; gid: string | null } {
  const trimmed = (url || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
    return { sheetId: match[1], gid: gidMatch ? gidMatch[1] : null };
  }
  // Also support pasting a raw Google Sheet ID directly (e.g., 1hhkDMmIfj80Qbj8PKwXMNyJESmdX9EvfzNQQxaNsO0g)
  if (/^[a-zA-Z0-9-_]{25,60}$/.test(trimmed)) {
    return { sheetId: trimmed, gid: null };
  }
  return { sheetId: null, gid: null };
}

export function buildGoogleSheetCsvUrl(sheetId: string, gid?: string | null): string {
  if (gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

const clean = (val: any): string => String(val ?? '').trim();
const cleanLower = (val: any): string => clean(val).toLowerCase();

function isSNoHeader(str: string): boolean {
  const s = cleanLower(str);
  return (
    s === 's.no' ||
    s === 's.no.' ||
    s === 'sl.no' ||
    s === 'sl no' ||
    s === 'sr.no' ||
    s === 'sr no' ||
    s === 's no' ||
    s === 'no.' ||
    s === 'no' ||
    s === '#' ||
    s === 'sn' ||
    s === 'serial' ||
    s === 'serial number' ||
    s === 'item no' ||
    s === 'index'
  );
}

function isCountHeader(str: string): boolean {
  if (isSNoHeader(str)) return false;
  const s = cleanLower(str);
  return (
    s.includes('count') ||
    s.includes('volume') ||
    s.includes('delivered') ||
    s.includes('qty') ||
    s.includes('quantity') ||
    s.includes('completed') ||
    s.includes('done') ||
    s.includes('units') ||
    s === 'total' ||
    s.includes('total delivered') ||
    s.includes('target') ||
    s.includes('posts count') ||
    s.includes('number delivered')
  );
}

function isActivityHeader(str: string): boolean {
  if (isSNoHeader(str) || isCountHeader(str)) return false;
  const s = cleanLower(str);
  return (
    s.includes('activity') ||
    s.includes('deliverable') ||
    s.includes('work') ||
    s.includes('task') ||
    s.includes('scope') ||
    s.includes('item') ||
    s.includes('description') ||
    s.includes('title')
  );
}

function isDriveLinkHeader(str: string): boolean {
  const s = cleanLower(str);
  return (
    s.includes('drive') ||
    s.includes('folder') ||
    s.includes('link') ||
    s.includes('url') ||
    s.includes('file') ||
    s.includes('asset')
  );
}

function isNotesHeader(str: string): boolean {
  if (isSNoHeader(str) || isCountHeader(str) || isActivityHeader(str) || isDriveLinkHeader(str)) return false;
  const s = cleanLower(str);
  return (
    s.includes('note') ||
    s.includes('detail') ||
    s.includes('remark') ||
    s.includes('comment') ||
    s.includes('spec') ||
    s.includes('instruction') ||
    s.includes('feedback') ||
    s.includes('context')
  );
}

function isCategoryHeader(str: string): boolean {
  const s = cleanLower(str);
  return s.includes('category') || s.includes('stream') || s.includes('type') || s.includes('channel');
}

/**
 * Parses an Excel Workbook into structured DashboardData
 */
export function parseExcelWorkbook(workbook: XLSX.WorkBook, fileName: string): DashboardData {
  const sheetNames = workbook.SheetNames;
  let works: WorkItem[] = [];
  let suggestions: SuggestionItem[] = [];
  let socialAuditData: Partial<SocialAuditPlatform> = {};

  // Check if multiple sheets are month tabs (e.g., 'Oct 2026', 'Sep 2026', 'October', etc.)
  const monthSheets = sheetNames.filter((name) => isMonthName(name));
  if (monthSheets.length > 0) {
    for (const sheetName of monthSheets) {
      const normMonth = normalizeMonth(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });
      if (!rawRows || rawRows.length === 0) continue;
      const parsed = parseWorksFromRows(rawRows, normMonth);
      for (const item of parsed) {
        if (!item.month) item.month = normMonth;
        works.push(item);
      }
    }
  }

  // Check all sheet tabs for dedicated sheets
  if (works.length === 0) {
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });
      if (!rawRows || rawRows.length === 0) continue;

    const lowerName = sheetName.toLowerCase();

    if (
      lowerName.includes('work') ||
      lowerName.includes('deliver') ||
      lowerName.includes('activity') ||
      lowerName.includes('deliverable')
    ) {
      const parsedWorks = parseWorksFromRows(rawRows);
      if (parsedWorks.length > 0) works = parsedWorks;
    } else if (
      lowerName.includes('suggest') ||
      lowerName.includes('idea') ||
      lowerName.includes('improvement')
    ) {
      const parsedSuggestions = parseSuggestionsFromRows(rawRows);
      if (parsedSuggestions.length > 0) suggestions = parsedSuggestions;
    } else if (
      lowerName.includes('social') ||
      lowerName.includes('audit') ||
      lowerName.includes('instagram')
    ) {
      socialAuditData = parseSocialAuditFromRows(rawRows);
    }
  }
}

  // If no dedicated sheets found, examine sheets for combined blocks
  if (works.length === 0 || suggestions.length === 0) {
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });
      if (!rawRows || rawRows.length === 0) continue;

      const parsed = parseCombinedSheet(rawRows);
      if (works.length === 0 && parsed.works.length > 0) works = parsed.works;
      if (suggestions.length === 0 && parsed.suggestions.length > 0) suggestions = parsed.suggestions;
      if (!socialAuditData.followers && parsed.socialAuditData) {
        socialAuditData = { ...socialAuditData, ...parsed.socialAuditData };
      }
    }
  }

  // If still empty, attempt direct tabular parse of first sheet
  if (works.length === 0 && sheetNames.length > 0) {
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    if (rawRows && rawRows.length > 0) {
      works = parseWorksFromRows(rawRows);
    }
  }

  // Fallback defaults if some sections could not be derived
  if (works.length === 0) {
    works = [
      {
        id: 'w-1',
        activity: 'Website banner images',
        count: 21,
        category: 'Design & Web',
        notes: 'Hero banners, promo graphics, and feature banners delivered for web portal',
      },
      {
        id: 'w-2',
        activity: 'Social posts',
        count: 14,
        category: 'Social Media',
        notes: 'Educational, promotional, and brand awareness posts for feed',
      },
      {
        id: 'w-3',
        activity: 'Corousals',
        count: 3,
        category: 'Social Media',
        notes: 'Multi-slide carousels detailing feature breakdowns',
      },
      {
        id: 'w-4',
        activity: 'Pinned post for Instagram',
        count: 1,
        category: 'Social Media',
        notes: 'Primary brand positioning pinned post',
      },
      {
        id: 'w-5',
        activity: "Video branding page Desig. (as per Anwar sir's instructions)",
        count: 1,
        category: 'Branding & Video',
        notes: "Custom layout created strictly adhering to Anwar sir's design guidelines",
      },
      {
        id: 'w-6',
        activity: 'Infographics',
        count: 1,
        category: 'Design & Web',
        notes: 'Technical fuel monitoring workflow schematic graphic',
      },
      {
        id: 'w-7',
        activity: 'Reels Vido',
        count: 0,
        category: 'Video Production',
        notes: 'Pending video footage and script sign-off',
      },
    ];
  }

  if (suggestions.length === 0) {
    suggestions = [
      {
        id: 's-1',
        sNo: 1,
        title: 'Implement a chatbot in website, atleast a button which connects to sales whatsapp',
        priority: 'High',
        status: 'Open',
        category: 'Conversion',
        notes: 'Accelerate lead capture with immediate direct messaging on WhatsApp',
      },
      {
        id: 's-2',
        sNo: 2,
        title: 'Local language (Arabic version of website)',
        priority: 'Medium',
        status: 'Open',
        category: 'Localization',
        notes: 'Critical for regional GCC corporate trust and search discoverability',
      },
      {
        id: 's-3',
        sNo: 3,
        title: 'GBP Posts and ranking',
        priority: 'High',
        status: 'Open',
        category: 'Local SEO',
        notes: 'Publish weekly Google Business Profile updates for local map prominence',
      },
      {
        id: 's-4',
        sNo: 4,
        title: 'Reels video cadence enhancement',
        priority: 'Medium',
        status: 'Open',
        category: 'Social Media',
        notes: 'Schedule bi-weekly short-form video reels for organic discovery',
      },
      {
        id: 's-5',
        sNo: 5,
        title: 'Bio link optimization for Fuel eBook',
        priority: 'High',
        status: 'Open',
        category: 'Conversion',
        notes: 'Prominently direct Instagram and LinkedIn visitors to download the eBook',
      },
    ];
  }

  const socialAudit: SocialAuditPlatform = {
    platform: socialAuditData.platform || 'Instagram',
    handle: socialAuditData.handle || '@vzonemarketing',
    followers: socialAuditData.followers ?? null,
    following: socialAuditData.following ?? null,
    totalPosts: socialAuditData.totalPosts ?? works.reduce((sum, w) => sum + w.count, 0),
    engagementRate: socialAuditData.engagementRate ?? 0.0,
    auditScore: socialAuditData.auditScore ?? 75,
    checks: socialAuditData.checks || [
      { id: 'c-1', label: 'Profile Bio & Value Proposition', status: 'passed', feedback: 'Properly formatted' },
      { id: 'c-2', label: 'Pinned Posts Structure', status: 'passed', feedback: 'Pinned post active' },
      { id: 'c-3', label: 'Reels Output', status: 'warning', feedback: '0 reels delivered' },
      { id: 'c-4', label: 'Website Banners', status: 'passed', feedback: '21 banners delivered' },
      { id: 'c-5', label: 'Link in Bio', status: 'pending', feedback: 'Fuel eBook pending' },
    ],
    pendingActions: socialAuditData.pendingActions || [
      { id: 'a-1', task: 'Add Fuel Monitoring eBook link in bio', priority: 'High', status: 'pending' },
      { id: 'a-2', task: 'Plan reels video recording batch', priority: 'Medium', status: 'pending' },
    ],
  };

  // Deduplicate and consolidate all work items across all parsed sheets / months
  const monthSet = new Set<string>();
  for (const w of works) {
    if (w.month && w.month !== 'All Months' && w.month !== 'Current Month') {
      monthSet.add(w.month);
    }
    if (w.monthlyBreakdown) {
      for (const m of Object.keys(w.monthlyBreakdown)) {
        if (m !== 'All Months' && m !== 'Current Month') {
          monthSet.add(m);
        }
      }
    }
  }

  const sortedMonths = sortMonthsChronologically(Array.from(monthSet));
  const latestMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : 'Current Month';

  // Map by normalized activity name
  const activityMap = new Map<
    string,
    {
      baseItem: WorkItem;
      breakdown: Record<string, number>;
    }
  >();

  for (const w of works) {
    const key = w.activity.trim().toLowerCase();
    if (!activityMap.has(key)) {
      const breakdown: Record<string, number> = {};
      for (const sm of sortedMonths) {
        breakdown[sm] = 0;
      }

      if (w.monthlyBreakdown) {
        for (const [bm, count] of Object.entries(w.monthlyBreakdown)) {
          const matchMonth = sortedMonths.find((sm) => isSameMonth(sm, bm)) || bm;
          breakdown[matchMonth] = Number(count || 0);
        }
      }
      if (w.month) {
        const matchMonth = sortedMonths.find((sm) => isSameMonth(sm, w.month!)) || w.month;
        if (breakdown[matchMonth] === 0 || breakdown[matchMonth] === undefined) {
          breakdown[matchMonth] = w.count;
        }
      }

      activityMap.set(key, {
        baseItem: {
          ...w,
          monthlyDriveLinks:
            w.month && w.driveLink ? { [w.month]: w.driveLink } : w.monthlyDriveLinks,
        },
        breakdown,
      });
    } else {
      const entry = activityMap.get(key)!;
      if (w.notes && !entry.baseItem.notes) {
        entry.baseItem.notes = w.notes;
      }
      if (w.driveLink) {
        entry.baseItem.driveLink = w.driveLink;
        if (w.month) {
          entry.baseItem.monthlyDriveLinks = {
            ...(entry.baseItem.monthlyDriveLinks || {}),
            [w.month]: w.driveLink,
          };
        }
      }
      if (w.monthlyBreakdown) {
        for (const [bm, count] of Object.entries(w.monthlyBreakdown)) {
          const matchMonth = sortedMonths.find((sm) => isSameMonth(sm, bm)) || bm;
          entry.breakdown[matchMonth] = Math.max(entry.breakdown[matchMonth] || 0, Number(count || 0));
        }
      }
      if (w.month) {
        const matchMonth = sortedMonths.find((sm) => isSameMonth(sm, w.month!)) || w.month;
        entry.breakdown[matchMonth] = Math.max(entry.breakdown[matchMonth] || 0, w.count);
      }
    }
  }

  const consolidatedWorks: WorkItem[] = [];
  for (const entry of activityMap.values()) {
    const latestCount = entry.breakdown[latestMonth] ?? entry.baseItem.count ?? 0;
    consolidatedWorks.push({
      ...entry.baseItem,
      count: latestCount,
      month: latestMonth,
      monthlyBreakdown: entry.breakdown,
    });
  }

  // Check if dedicated 'Topic Breakdown' tab exists in workbook
  const topicBreakdownSheetName = sheetNames.find((name) => {
    const l = name.trim().toLowerCase();
    return l === 'topic breakdown' || l === 'topics' || l === 'details breakdown' || l === 'breakdown';
  });

  if (topicBreakdownSheetName) {
    const topicSheet = workbook.Sheets[topicBreakdownSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(topicSheet, { header: 1 });
    if (rawRows && rawRows.length > 1) {
      let monthCol = 1;
      let deliverableCol = 2;
      let titleCol = 3;
      let noteCol = 4;
      let driveLinkCol = -1;

      // Check header row (row 0)
      const headerRow = rawRows[0] || [];
      for (let j = 0; j < headerRow.length; j++) {
        const h = String(headerRow[j] || '').trim().toLowerCase();
        if (h.includes('month')) monthCol = j;
        else if (h.includes('deliverable') || h.includes('work item') || h.includes('activity')) deliverableCol = j;
        else if (h.includes('title') || h.includes('topic')) titleCol = j;
        else if (h.includes('drive') || h.includes('link') || h.includes('url') || h.includes('folder')) driveLinkCol = j;
        else if (h.includes('note') || h.includes('detail') || h.includes('remark')) noteCol = j;
      }

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;
        const rawDeliverable = String(row[deliverableCol] || '').trim();
        const rawTitle = String(row[titleCol] || '').trim();
        if (!rawDeliverable || !rawTitle) continue;
        if (rawDeliverable.toLowerCase() === 'dashboard test' || rawTitle.toLowerCase() === 'test topic connection') {
          continue;
        }

        const rawMonth = row[monthCol];
        const normMonth = rawMonth ? normalizeMonth(rawMonth) : latestMonth || 'Nov 2026';
        const rawNote = row[noteCol] !== undefined && row[noteCol] !== null ? String(row[noteCol]).trim() : '';
        const rawDriveLink =
          driveLinkCol !== -1 && row[driveLinkCol] !== undefined && row[driveLinkCol] !== null
            ? String(row[driveLinkCol]).trim()
            : '';

        // Match against consolidatedWorks
        const delivKey = rawDeliverable.toLowerCase();
        let targetWork = consolidatedWorks.find((w) => {
          const actKey = w.activity.trim().toLowerCase();
          return (
            actKey === delivKey ||
            (delivKey.startsWith('news or awareness reels') && actKey.startsWith('news or awareness reels')) ||
            actKey.includes(delivKey) ||
            delivKey.includes(actKey)
          );
        });

        if (targetWork) {
          const normTitle = rawTitle.trim();
          const subItem = {
            id: `sub-sheet-${normMonth.toLowerCase().replace(/[^a-z0-9]/g, '')}-${normTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            title: normTitle,
            note: rawNote || undefined,
            driveLink: rawDriveLink || undefined,
            createdAt: new Date().toISOString(),
          };

          const mSub = targetWork.monthlySubItems || {};
          const currentList = mSub[normMonth] ? [...mSub[normMonth]] : [];
          const existingIdx = currentList.findIndex(
            (it) => it.title.trim().toLowerCase() === normTitle.toLowerCase()
          );
          if (existingIdx >= 0) {
            if (rawNote && (!currentList[existingIdx].note || !currentList[existingIdx].note.trim())) {
              currentList[existingIdx].note = rawNote;
            }
            if (rawDriveLink && (!currentList[existingIdx].driveLink || !currentList[existingIdx].driveLink.trim())) {
              currentList[existingIdx].driveLink = rawDriveLink;
            }
          } else {
            currentList.push(subItem);
          }
          mSub[normMonth] = deduplicateSubItems(currentList);
          targetWork.monthlySubItems = mSub;

          if (!targetWork.subItems) targetWork.subItems = [];
          const rootIdx = targetWork.subItems.findIndex(
            (it) => it.title.trim().toLowerCase() === normTitle.toLowerCase()
          );
          if (rootIdx >= 0) {
            if (rawNote && (!targetWork.subItems[rootIdx].note || !targetWork.subItems[rootIdx].note.trim())) {
              targetWork.subItems[rootIdx].note = rawNote;
            }
            if (rawDriveLink && (!targetWork.subItems[rootIdx].driveLink || !targetWork.subItems[rootIdx].driveLink.trim())) {
              targetWork.subItems[rootIdx].driveLink = rawDriveLink;
            }
          } else {
            targetWork.subItems.push(subItem);
          }
          targetWork.subItems = deduplicateSubItems(targetWork.subItems);
        }
      }
    }
  }

  // Check if dedicated 'Tasks' tab exists in workbook
  let tasks: TaskItem[] | undefined;
  const tasksSheetName = sheetNames.find(
    (name) => name.trim().toLowerCase() === 'tasks'
  );
  if (tasksSheetName) {
    const tasksSheet = workbook.Sheets[tasksSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(tasksSheet, { header: 1 });
    if (rawRows && rawRows.length > 0) {
      const parsedTasks = parseTasksFromRows(rawRows);
      if (parsedTasks.length > 0) {
        tasks = parsedTasks;
      }
    }
  }

  const finalWorks = consolidatedWorks.length > 0 ? consolidatedWorks : works;
  const availableMonths = sortedMonths.length > 0 ? sortedMonths : ['Current Month'];
  const selectedMonth = availableMonths[availableMonths.length - 1];

  return {
    fileName,
    lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    period: selectedMonth,
    selectedMonth,
    availableMonths,
    worksCompleted: finalWorks,
    suggestions,
    socialAudit,
    tasks,
  };
}

/**
 * Intelligent parser for "Works Completed" table
 * Handles S.No, Activity names, Delivered counts, Details/Notes, and Drive Links with data-driven validation
 */
export function parseWorksFromRows(rows: any[][], defaultMonth?: string): WorkItem[] {
  if (!rows || rows.length === 0) return [];

  let headerRowIndex = -1;
  let sNoCol = -1;
  let activityCol = -1;
  let countCol = -1;
  let notesCol = -1;
  let driveLinkCol = -1;
  let categoryCol = -1;
  let monthCol = -1;
  const horizontalMonthCols: { colIndex: number; month: string }[] = [];

  // 1. Scan rows to find a TRUE table header row (a row with at least 2 distinct header names)
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Count non-empty cells
    const nonEmpties = row.filter((c) => clean(c) !== '');
    if (nonEmpties.length < 2) continue; // Single banner title like "Works Completed" is NOT the column header row

    let tempSNo = -1;
    let tempAct = -1;
    let tempCount = -1;
    let tempNotes = -1;
    let tempDriveLink = -1;
    let tempCat = -1;
    let tempMonth = -1;
    const tempHorizontalMonths: { colIndex: number; month: string }[] = [];

    for (let j = 0; j < row.length; j++) {
      const cell = clean(row[j]);
      if (!cell) continue;

      if (isSNoHeader(cell)) {
        tempSNo = j;
      } else if (isMonthName(cell)) {
        tempHorizontalMonths.push({ colIndex: j, month: normalizeMonth(cell) });
      } else if (isMonthColumnHeader(cell)) {
        tempMonth = j;
      } else if (isCountHeader(cell)) {
        tempCount = j;
      } else if (isActivityHeader(cell)) {
        tempAct = j;
      } else if (isDriveLinkHeader(cell)) {
        tempDriveLink = j;
      } else if (isNotesHeader(cell)) {
        tempNotes = j;
      } else if (isCategoryHeader(cell)) {
        tempCat = j;
      }
    }

    // A valid table header should match at least activity OR count OR at least one month column
    if (tempAct !== -1 || tempCount !== -1 || tempHorizontalMonths.length >= 1) {
      headerRowIndex = i;
      sNoCol = tempSNo;
      activityCol = tempAct;
      countCol = tempCount;
      notesCol = tempNotes;
      driveLinkCol = tempDriveLink;
      categoryCol = tempCat;
      monthCol = tempMonth;
      if (tempHorizontalMonths.length >= 1) {
        horizontalMonthCols.push(...tempHorizontalMonths);
      }
      break;
    }
  }

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
  const sampleRows = rows.slice(startRow, Math.min(startRow + 15, rows.length)).filter((r) => r && r.length > 0);

  // 2. Data-driven column profiling & correction
  // Determine column types based on actual row content to prevent "S.No" numbers from masquerading as activity names
  const numCols = Math.max(...sampleRows.map((r) => r.length), 0);
  const colTextStats: { textCount: number; numericCount: number; avgLength: number }[] = [];

  for (let c = 0; c < numCols; c++) {
    let textCount = 0;
    let numericCount = 0;
    let totalLen = 0;

    for (const r of sampleRows) {
      const val = clean(r[c]);
      if (!val) continue;

      if (/^-?\d+(\.\d+)?$/.test(val)) {
        numericCount++;
      } else {
        textCount++;
        totalLen += val.length;
      }
    }

    colTextStats.push({
      textCount,
      numericCount,
      avgLength: textCount > 0 ? totalLen / textCount : 0,
    });
  }

  // If activityCol is pointing to a purely numeric column (e.g. S.No like 1, 2, 3...) or wasn't found:
  if (
    activityCol === -1 ||
    (colTextStats[activityCol] &&
      colTextStats[activityCol].numericCount > 0 &&
      colTextStats[activityCol].textCount === 0)
  ) {
    // Find the column that has the most text with longest average string length (descriptions)
    let bestTextCol = -1;
    let maxTextCount = 0;

    for (let c = 0; c < numCols; c++) {
      if (c === sNoCol) continue;
      const stats = colTextStats[c];
      if (stats && stats.textCount > maxTextCount) {
        maxTextCount = stats.textCount;
        bestTextCol = c;
      }
    }

    if (bestTextCol !== -1) {
      activityCol = bestTextCol;
    }
  }

  // If countCol is pointing to sNoCol or wasn't found:
  if (countCol === -1 || countCol === sNoCol || countCol === activityCol) {
    // Find the numeric column that is NOT sNoCol and NOT activityCol
    let bestNumericCol = -1;
    for (let c = 0; c < numCols; c++) {
      if (c === sNoCol || c === activityCol) continue;
      const stats = colTextStats[c];
      if (stats && stats.numericCount > 0) {
        bestNumericCol = c;
        break;
      }
    }

    if (bestNumericCol !== -1) {
      countCol = bestNumericCol;
    } else {
      // If still not found, check next column after activity
      countCol = activityCol + 1 < numCols ? activityCol + 1 : 1;
    }
  }

  // If notesCol wasn't found, look for another text column that isn't activityCol or sNoCol or driveLinkCol
  if (notesCol === -1) {
    for (let c = 0; c < numCols; c++) {
      if (c === sNoCol || c === activityCol || c === countCol || c === categoryCol || c === driveLinkCol) continue;
      const stats = colTextStats[c];
      if (stats && stats.textCount > 0) {
        notesCol = c;
        break;
      }
    }
  }

  // 3. Extract WorkItems
  const works: WorkItem[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check if we hit next section or total row
    const firstCell = cleanLower(row[0]);
    const rowText = row.map(cleanLower).join(' ');
    if (
      firstCell.includes('suggestions') ||
      firstCell.includes('improvement ideas') ||
      rowText.includes('improvement ideas raised for review')
    ) {
      break;
    }

    if (
      firstCell === 'total' ||
      firstCell === 'sum' ||
      firstCell.includes('total delivered') ||
      firstCell.includes('total volume') ||
      rowText.startsWith('total')
    ) {
      continue;
    }

    // Get raw activity value
    let act = clean(row[activityCol !== -1 ? activityCol : 0]);

    // If activity name is purely numeric (like "1", "2") and there's a text column adjacent, grab that text
    if (/^\d+$/.test(act)) {
      for (let c = 0; c < row.length; c++) {
        const testVal = clean(row[c]);
        if (testVal && !/^\d+$/.test(testVal) && testVal.length > 2) {
          act = testVal;
          break;
        }
      }
    }

    // Skip empty or header rows
    if (
      !act ||
      act.toLowerCase() === 'activity' ||
      act.toLowerCase() === 's.no' ||
      act.toLowerCase() === 'total' ||
      act.toLowerCase() === 'works completed'
    ) {
      continue;
    }

    // Extract count
    let rawCount = countCol !== -1 ? row[countCol] : undefined;
    if (rawCount === undefined && row.length > 1) {
      // Pick first numeric value in row
      for (let c = 0; c < row.length; c++) {
        if (c === sNoCol) continue;
        const candidate = row[c];
        if (typeof candidate === 'number' || (typeof candidate === 'string' && /^\d+$/.test(candidate.trim()))) {
          rawCount = candidate;
          break;
        }
      }
    }

    const num =
      typeof rawCount === 'number'
        ? rawCount
        : parseInt(String(rawCount ?? '0').replace(/[^0-9]/g, ''), 10);
    const count = isNaN(num) ? 0 : num;

    // Extract notes / details
    let notes = notesCol !== -1 && row[notesCol] ? clean(row[notesCol]) : undefined;

    // Extract Link if present in driveLinkCol or any cell containing a standalone URL
    let driveLink = driveLinkCol !== -1 && row[driveLinkCol] ? clean(row[driveLinkCol]) : undefined;
    if (!driveLink) {
      for (let c = 0; c < row.length; c++) {
        const cellVal = clean(row[c]);
        if (
          cellVal &&
          (/^https?:\/\/\S+$/i.test(cellVal) ||
            cellVal.includes('drive.google.com') ||
            cellVal.includes('docs.google.com/folder'))
        ) {
          driveLink = cellVal;
          break;
        }
      }
    }

    // If notes is empty, check if the activity text contains details in parentheses
    // e.g. "Video branding page Desig. (as per Anwar sir's instructions)"
    if (!notes && act.includes('(') && act.includes(')')) {
      const match = act.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        notes = match[1].trim();
      }
    }

    // Extract category
    const cat =
      categoryCol !== -1 && row[categoryCol]
        ? clean(row[categoryCol])
        : categorizeActivity(act);

    // If horizontal month columns detected:
    if (horizontalMonthCols.length >= 1) {
      const monthlyBreakdown: Record<string, number> = {};
      for (const hm of horizontalMonthCols) {
        const rawVal = row[hm.colIndex];
        const n =
          typeof rawVal === 'number'
            ? rawVal
            : parseInt(clean(rawVal).replace(/[^0-9]/g, ''), 10);
        monthlyBreakdown[hm.month] = isNaN(n) ? 0 : n;
      }
      const sortedMonths = sortMonthsChronologically(horizontalMonthCols.map((h) => h.month));
      const latestMonth = sortedMonths[sortedMonths.length - 1];
      const count = monthlyBreakdown[latestMonth] ?? 0;

      works.push({
        id: `work-${r}-${works.length + 1}`,
        activity: act,
        count,
        category: cat,
        notes: notes || undefined,
        driveLink: driveLink || undefined,
        month: latestMonth,
        monthlyBreakdown,
      });
      continue;
    }

    // If dedicated month column exists:
    let itemMonth = defaultMonth || 'Current Month';
    if (monthCol !== -1 && row[monthCol]) {
      const cellMonth = clean(row[monthCol]);
      if (cellMonth) {
        itemMonth = normalizeMonth(cellMonth);
      }
    }

    works.push({
      id: `work-${r}-${works.length + 1}`,
      activity: act,
      count,
      category: cat,
      notes: notes || undefined,
      driveLink: driveLink || undefined,
      month: itemMonth,
    });
  }

  return works;
}

/**
 * Intelligent parser for "Suggestions" section
 */
export function parseSuggestionsFromRows(rows: any[][]): SuggestionItem[] {
  if (!rows || rows.length === 0) return [];

  let startIdx = 0;
  let titleCol = -1;
  let priorityCol = -1;
  let statusCol = -1;
  let notesCol = -1;
  let categoryCol = -1;

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = cleanLower(row[j]);
      if (
        cell.includes('suggestion') ||
        cell.includes('idea') ||
        cell.includes('improvement') ||
        cell.includes('recommendation')
      ) {
        titleCol = j;
        startIdx = i + 1;
      }
      if (cell.includes('priority') || cell.includes('urgency') || cell.includes('impact')) {
        priorityCol = j;
      }
      if (cell.includes('status') || cell.includes('state')) {
        statusCol = j;
      }
      if (cell.includes('note') || cell.includes('detail') || cell.includes('comment')) {
        notesCol = j;
      }
      if (cell.includes('category') || cell.includes('domain')) {
        categoryCol = j;
      }
    }
    if (titleCol !== -1) break;
  }

  const suggestions: SuggestionItem[] = [];
  let counter = 1;

  for (let r = startIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Skip section headers like "Improvement ideas raised for review"
    const firstCell = clean(row[0]);
    if (
      firstCell.toLowerCase().includes('improvement ideas raised for review') ||
      firstCell.toLowerCase().includes('suggestions for review') ||
      firstCell.toLowerCase() === 's.no' ||
      firstCell.toLowerCase() === 'suggestion' ||
      firstCell.toLowerCase() === 'ideas'
    ) {
      continue;
    }

    let title = '';
    let priorityStr = '';
    let statusStr = '';
    let notes = '';
    let category = '';

    // Check if column 0 is a serial number
    if (/^\d+$/.test(firstCell) && row.length > 1) {
      counter = parseInt(firstCell, 10);
      title = clean(row[titleCol !== -1 && titleCol !== 0 ? titleCol : 1]);
      priorityStr = priorityCol !== -1 ? clean(row[priorityCol]) : clean(row[2]);
      statusStr = statusCol !== -1 ? clean(row[statusCol]) : clean(row[3]);
      notes = notesCol !== -1 ? clean(row[notesCol]) : clean(row[4]);
    } else {
      title = titleCol !== -1 ? clean(row[titleCol]) : firstCell;
      priorityStr = priorityCol !== -1 ? clean(row[priorityCol]) : clean(row[1]);
      statusStr = statusCol !== -1 ? clean(row[statusCol]) : clean(row[2]);
      notes = notesCol !== -1 ? clean(row[notesCol]) : clean(row[3]);
    }

    if (!title || title.toLowerCase() === 's.no' || title.toLowerCase() === 'suggestion') continue;

    const priority: PriorityLevel = ['High', 'Medium', 'Low'].includes(priorityStr)
      ? (priorityStr as PriorityLevel)
      : 'Unset';

    const status: SuggestionStatus = ['Open', 'Under Review', 'Approved', 'Implemented'].includes(statusStr)
      ? (statusStr as SuggestionStatus)
      : 'Open';

    suggestions.push({
      id: `sug-${r}-${counter}`,
      sNo: counter++,
      title,
      priority,
      status,
      category: category || categorizeSuggestion(title),
      notes: notes || undefined,
    });
  }

  return suggestions;
}

/**
 * Intelligent parser for combined single-sheet spreadsheets
 */
export function parseCombinedSheet(rows: any[][]): {
  works: WorkItem[];
  suggestions: SuggestionItem[];
  socialAuditData?: Partial<SocialAuditPlatform>;
} {
  const worksRows: any[][] = [];
  const suggestionsRows: any[][] = [];
  const auditRows: any[][] = [];

  let currentSection: 'none' | 'works' | 'suggestions' | 'audit' = 'none';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rowText = row.map(cleanLower).join(' ');
    const firstCell = cleanLower(row[0]);

    if (
      firstCell.includes('works completed') ||
      firstCell.includes('volume delivered') ||
      rowText.includes('works completed') ||
      rowText.includes('volume delivered per activity')
    ) {
      currentSection = 'works';
      // If this row also contains headers, push it
      if (row.filter((c) => clean(c) !== '').length > 1) {
        worksRows.push(row);
      }
      continue;
    } else if (
      firstCell.includes('improvement ideas') ||
      firstCell.includes('suggestions') ||
      rowText.includes('improvement ideas raised for review') ||
      rowText.includes('suggestions & recommendations')
    ) {
      currentSection = 'suggestions';
      if (row.filter((c) => clean(c) !== '').length > 1) {
        suggestionsRows.push(row);
      }
      continue;
    } else if (
      firstCell.includes('social audit') ||
      firstCell.includes('social media audit') ||
      rowText.includes('social media audit')
    ) {
      currentSection = 'audit';
      auditRows.push(row);
      continue;
    }

    if (currentSection === 'works') {
      worksRows.push(row);
    } else if (currentSection === 'suggestions') {
      suggestionsRows.push(row);
    } else if (currentSection === 'audit') {
      auditRows.push(row);
    }
  }

  const works = worksRows.length > 0 ? parseWorksFromRows(worksRows) : [];
  const suggestions = suggestionsRows.length > 0 ? parseSuggestionsFromRows(suggestionsRows) : [];
  const socialAuditData = auditRows.length > 0 ? parseSocialAuditFromRows(auditRows) : undefined;

  return { works, suggestions, socialAuditData };
}

/**
 * Parses Social Audit metrics from sheet rows
 */
export function parseSocialAuditFromRows(rows: any[][]): Partial<SocialAuditPlatform> {
  const checks: AuditCheck[] = [];
  const pendingActions: ActionItem[] = [];
  let followers: number | null = null;
  let following: number | null = null;
  let totalPosts = 0;
  let engagementRate = 0.0;
  let handle = '@vzonemarketing';
  let auditScore = 75;

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const line = row.join(' ').toLowerCase();

    if (line.includes('handle') || line.includes('@')) {
      const foundHandle = row.find((c: any) => clean(c).startsWith('@'));
      if (foundHandle) handle = clean(foundHandle);
    }
    if (line.includes('follower')) {
      const num = parseInt(line.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) followers = num;
    }
    if (line.includes('following')) {
      const num = parseInt(line.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) following = num;
    }
    if (line.includes('posts count') || line.includes('total posts')) {
      const num = parseInt(line.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) totalPosts = num;
    }
    if (line.includes('engagement')) {
      const match = line.match(/([0-9.]+)\s*%/);
      if (match) engagementRate = parseFloat(match[1]);
    }
    if (line.includes('audit score') || line.includes('score')) {
      const match = line.match(/([0-9]{2,3})\s*(\/|out of)?/);
      if (match) auditScore = parseInt(match[1], 10);
    }

    // Check item
    if (line.includes('passed') || line.includes('warning') || line.includes('pending')) {
      const label = clean(row[0]);
      const status = line.includes('passed') ? 'passed' : line.includes('warning') ? 'warning' : 'pending';
      const feedback = row[1] ? clean(row[1]) : '';
      if (label) {
        checks.push({
          id: `chk-${checks.length + 1}`,
          label,
          status,
          feedback,
        });
      }
    }
  }

  return {
    handle,
    followers,
    following,
    totalPosts: totalPosts || undefined,
    engagementRate,
    auditScore,
    checks: checks.length > 0 ? checks : undefined,
    pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
  };
}

export function categorizeActivity(activity: string): string {
  const lower = activity.toLowerCase();
  if (lower.includes('banner') || lower.includes('web') || lower.includes('site') || lower.includes('page')) {
    return 'Design & Web';
  }
  if (lower.includes('reel') || lower.includes('video') || lower.includes('vido') || lower.includes('animation')) {
    return 'Video Production';
  }
  if (
    lower.includes('post') ||
    lower.includes('pinned') ||
    lower.includes('corousal') ||
    lower.includes('carousel') ||
    lower.includes('story') ||
    lower.includes('feed')
  ) {
    return 'Social Media';
  }
  if (lower.includes('infographic') || lower.includes('graphic') || lower.includes('brochure') || lower.includes('flyer')) {
    return 'Design & Web';
  }
  if (lower.includes('branding') || lower.includes('brand') || lower.includes('logo') || lower.includes('guideline')) {
    return 'Branding & Video';
  }
  return 'Marketing Deliverable';
}

function categorizeSuggestion(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('whatsapp') || lower.includes('chat') || lower.includes('conversion') || lower.includes('lead')) {
    return 'Conversion';
  }
  if (lower.includes('arabic') || lower.includes('language') || lower.includes('translat')) {
    return 'Localization';
  }
  if (lower.includes('gbp') || lower.includes('google') || lower.includes('seo') || lower.includes('rank')) {
    return 'Local SEO';
  }
  if (lower.includes('reel') || lower.includes('video') || lower.includes('tiktok')) {
    return 'Video & Social';
  }
  return 'Strategy';
}

export function exportToCsv(data: DashboardData): string {
  const lines: string[] = [];
  lines.push(`--- VZONE MARKETING MONTHLY REPORT ---`);
  lines.push(`Report Source: ${data.fileName}`);
  lines.push(`Last Updated: ${data.lastUpdated}`);
  if (data.selectedMonth) {
    lines.push(`Selected Period: ${data.selectedMonth}`);
  }
  const activeListNote = data.workListNotes?.[`works_${data.selectedMonth || ''}`];
  if (activeListNote) {
    lines.push(`Work List Note: "${activeListNote.replace(/"/g, '""')}"`);
  }
  lines.push(``);
  lines.push(`WORKS COMPLETED`);

  const hasMultipleMonths = data.availableMonths && data.availableMonths.length > 1;

  if (hasMultipleMonths) {
    lines.push(`S.No,Month,Activity,Delivered Count,Category,Note,Scope Description`);
    data.worksCompleted.forEach((w, idx) => {
      lines.push(
        `${idx + 1},"${(w.month || 'Current Month').replace(/"/g, '""')}","${w.activity.replace(/"/g, '""')}",${w.count},"${w.category}","${(w.customNote || '').replace(/"/g, '""')}","${(w.notes || '').replace(/"/g, '""')}"`
      );
    });
  } else {
    lines.push(`S.No,Activity,Delivered Count,Category,Note,Scope Description`);
    data.worksCompleted.forEach((w, idx) => {
      lines.push(
        `${idx + 1},"${w.activity.replace(/"/g, '""')}",${w.count},"${w.category}","${(w.customNote || '').replace(/"/g, '""')}","${(w.notes || '').replace(/"/g, '""')}"`
      );
    });
  }

  return lines.join('\n');
}

/**
 * Exports all deliverable topics and sub-categories into a clean CSV tab layout
 * ready to paste or import as a new tab in Google Sheets.
 */
export function exportSubItemsToSheetTabCsv(data: DashboardData, selectedMonth?: string): string {
  const lines: string[] = [];
  lines.push(`Deliverable / Activity,Month,Topic Title,Topic Note,Category,Deliverable Count,Recorded At`);

  const targetMonth = selectedMonth || data.selectedMonth || 'All Months';

  (data.worksCompleted || []).forEach((w) => {
    // Gather all sub-items across months or for targetMonth
    let itemsToExport: { month: string; title: string; note?: string; createdAt?: string }[] = [];

    if (w.monthlySubItems && Object.keys(w.monthlySubItems).length > 0) {
      for (const [m, list] of Object.entries(w.monthlySubItems)) {
        if (targetMonth === 'all' || isSameMonth(m, targetMonth)) {
          (list || []).forEach((item) => {
            itemsToExport.push({
              month: m,
              title: item.title,
              note: item.note,
              createdAt: item.createdAt,
            });
          });
        }
      }
    } else if (w.subItems && w.subItems.length > 0) {
      w.subItems.forEach((item) => {
        itemsToExport.push({
          month: w.month || targetMonth,
          title: item.title,
          note: item.note,
          createdAt: item.createdAt,
        });
      });
    }

    if (itemsToExport.length > 0) {
      itemsToExport.forEach((item) => {
        lines.push(
          `"${w.activity.replace(/"/g, '""')}","${item.month.replace(/"/g, '""')}","${item.title.replace(/"/g, '""')}","${(item.note || '').replace(/"/g, '""')}","${w.category}","${w.count}","${item.createdAt || ''}"`
        );
      });
    } else {
      // If no sub-items entered yet, include the deliverable row so it is visible in the sheet
      lines.push(
        `"${w.activity.replace(/"/g, '""')}","${w.month || targetMonth}","[No topics entered yet]","","${w.category}","${w.count}",""`
      );
    }
  });

  return lines.join('\n');
}

/**
 * Downloads a multi-tab Excel workbook (.xlsx) including:
 * 1. Summary tab
 * 2. Dedicated "Topic Breakdown" tab for Google Sheets
 */
export function downloadWorkbookWithSubItemsTab(data: DashboardData, selectedMonth?: string) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Deliverables Summary
  const summaryRows = (data.worksCompleted || []).map((w, idx) => ({
    'S.No': idx + 1,
    'Activity': w.activity,
    'Category': w.category,
    'Count': w.count,
    'Month': w.month || selectedMonth || 'Current',
    'Custom Note': w.customNote || '',
    'Scope': w.notes || '',
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Tab 2: Topics & Sub-Categories Breakdown
  const targetMonth = selectedMonth || data.selectedMonth || 'All Months';
  const breakdownRows: any[] = [];

  (data.worksCompleted || []).forEach((w) => {
    let subList: { month: string; title: string; note?: string; createdAt?: string }[] = [];
    if (w.monthlySubItems && Object.keys(w.monthlySubItems).length > 0) {
      for (const [m, list] of Object.entries(w.monthlySubItems)) {
        if (targetMonth === 'all' || isSameMonth(m, targetMonth)) {
          (list || []).forEach((item) => {
            subList.push({
              month: m,
              title: item.title,
              note: item.note,
              createdAt: item.createdAt,
            });
          });
        }
      }
    } else if (w.subItems && w.subItems.length > 0) {
      w.subItems.forEach((item) => {
        subList.push({
          month: w.month || targetMonth,
          title: item.title,
          note: item.note,
          createdAt: item.createdAt,
        });
      });
    }

    if (subList.length > 0) {
      subList.forEach((st, idx) => {
        breakdownRows.push({
          'Deliverable': w.activity,
          'Month': st.month,
          'Item #': idx + 1,
          'Topic Title': st.title,
          'Topic Note': st.note || '',
          'Category': w.category,
          'Deliverable Total': w.count,
          'Added At': st.createdAt ? new Date(st.createdAt).toLocaleDateString() : '',
        });
      });
    } else {
      breakdownRows.push({
        'Deliverable': w.activity,
        'Month': w.month || targetMonth,
        'Item #': 1,
        'Topic Title': 'No topics recorded yet',
        'Topic Note': '',
        'Category': w.category,
        'Deliverable Total': w.count,
        'Added At': '',
      });
    }
  });

  const wsTopics = XLSX.utils.json_to_sheet(breakdownRows);
  XLSX.utils.book_append_sheet(wb, wsTopics, 'Topic Breakdown');

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `VZone_Report_With_Topics_${dateStr}.xlsx`);
}
