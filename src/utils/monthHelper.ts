import { WorkItem } from '../types';

export const MONTH_FULL_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export const MONTH_SHORT_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

const MONTH_ALIASES: Record<string, { monthIndex: number; shortName: string; fullName: string }> = {
  jan: { monthIndex: 0, shortName: 'Jan', fullName: 'January' },
  january: { monthIndex: 0, shortName: 'Jan', fullName: 'January' },
  feb: { monthIndex: 1, shortName: 'Feb', fullName: 'February' },
  february: { monthIndex: 1, shortName: 'Feb', fullName: 'February' },
  mar: { monthIndex: 2, shortName: 'Mar', fullName: 'March' },
  march: { monthIndex: 2, shortName: 'Mar', fullName: 'March' },
  apr: { monthIndex: 3, shortName: 'Apr', fullName: 'April' },
  april: { monthIndex: 3, shortName: 'Apr', fullName: 'April' },
  may: { monthIndex: 4, shortName: 'May', fullName: 'May' },
  jun: { monthIndex: 5, shortName: 'Jun', fullName: 'June' },
  june: { monthIndex: 5, shortName: 'Jun', fullName: 'June' },
  jul: { monthIndex: 6, shortName: 'Jul', fullName: 'July' },
  july: { monthIndex: 6, shortName: 'Jul', fullName: 'July' },
  aug: { monthIndex: 7, shortName: 'Aug', fullName: 'August' },
  august: { monthIndex: 7, shortName: 'Aug', fullName: 'August' },
  sep: { monthIndex: 8, shortName: 'Sep', fullName: 'September' },
  sept: { monthIndex: 8, shortName: 'Sep', fullName: 'September' },
  september: { monthIndex: 8, shortName: 'Sep', fullName: 'September' },
  oct: { monthIndex: 9, shortName: 'Oct', fullName: 'October' },
  october: { monthIndex: 9, shortName: 'Oct', fullName: 'October' },
  nov: { monthIndex: 10, shortName: 'Nov', fullName: 'November' },
  november: { monthIndex: 10, shortName: 'Nov', fullName: 'November' },
  dec: { monthIndex: 11, shortName: 'Dec', fullName: 'December' },
  december: { monthIndex: 11, shortName: 'Dec', fullName: 'December' },
};

/**
 * Checks if a string is a column header designating the "Month" attribute itself
 * (e.g., "Month", "Period", "Report Month", "Date", "Timeline")
 */
export function isMonthColumnHeader(header: string): boolean {
  const s = String(header || '').trim().toLowerCase();
  return (
    s === 'month' ||
    s === 'months' ||
    s === 'period' ||
    s === 'report month' ||
    s === 'reporting month' ||
    s === 'month name' ||
    s === 'month/year' ||
    s === 'month & year' ||
    s === 'timeline' ||
    s === 'target month'
  );
}

/**
 * Checks if a string matches or contains a month identification (e.g. "Oct 2026", "Sep 2026", "9/1/2026", "2026-09-01")
 */
export function isMonthName(str: any): boolean {
  if (!str && str !== 0) return false;

  // If already a Date object
  if (str instanceof Date && !isNaN(str.getTime())) {
    return true;
  }

  // If numeric Excel date serial (e.g., 46269 is Sep 2026, 46300 is Oct 2026)
  const num =
    typeof str === 'number'
      ? str
      : typeof str === 'string' && /^\d{5}(\.\d+)?$/.test(str.trim())
      ? parseFloat(str.trim())
      : NaN;
  if (!isNaN(num) && num >= 35000 && num <= 60000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2040) {
      return true;
    }
  }

  const s = String(str).trim().toLowerCase();
  if (!s) return false;

  // "Month 1", "Month 2", "M1", "M2"
  if (/^month\s*\d+$/i.test(s) || /^m\d+$/i.test(s)) return true;

  // "YYYY-MM" or "MM/YYYY" or "YYYY/MM"
  if (/^\d{4}[-/](0?[1-9]|1[0-2])$/.test(s) || /^(0?[1-9]|1[0-2])[-/]\d{4}$/.test(s)) return true;

  // "M/D/YYYY" or "MM/DD/YYYY" or "D/M/YYYY" e.g. 9/1/2026, 10/1/2026, 09/01/2026
  if (/^(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.]\d{4}$/.test(s)) return true;
  if (/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.]\d{4}$/.test(s)) return true;

  // "YYYY-MM-DD" e.g. 2026-09-01
  if (/^\d{4}[-/.]0?([1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])$/.test(s)) return true;

  // Month word token check (e.g. "Sep 2026", "Oct 2026", "September", "Sep-26")
  const words = s.split(/[\s\-_/.,]+/);
  return words.some((w) => !!MONTH_ALIASES[w]);
}

/**
 * Normalizes any month string or date into standard representation (e.g., "Oct 2026", "Sep 2026")
 */
export function normalizeMonth(str: any): string {
  if (!str && str !== 0) return 'Current Month';

  // Handle Date instance
  if (str instanceof Date && !isNaN(str.getTime())) {
    const mIdx = str.getMonth();
    const short = MONTH_SHORT_NAMES[mIdx] || '';
    const shortCap = short.charAt(0).toUpperCase() + short.slice(1);
    return `${shortCap} ${str.getFullYear()}`;
  }

  // Handle Excel date serial number (e.g., 46269 -> Sep 2026)
  const num =
    typeof str === 'number'
      ? str
      : typeof str === 'string' && /^\d{5}(\.\d+)?$/.test(str.trim())
      ? parseFloat(str.trim())
      : NaN;
  if (!isNaN(num) && num >= 35000 && num <= 60000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2040) {
      const mIdx = d.getMonth();
      const short = MONTH_SHORT_NAMES[mIdx] || '';
      const shortCap = short.charAt(0).toUpperCase() + short.slice(1);
      return `${shortCap} ${d.getFullYear()}`;
    }
  }

  const raw = String(str).trim();
  const lower = raw.toLowerCase();

  // Handle "YYYY-MM-DD" like "2026-09-01"
  const ymdMatch = lower.match(/^(\d{4})[-/.](0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const mIdx = parseInt(ymdMatch[2], 10) - 1;
    const short = MONTH_SHORT_NAMES[mIdx] || '';
    return `${short.charAt(0).toUpperCase() + short.slice(1)} ${year}`;
  }

  // Handle "M/D/YYYY" or "MM/DD/YYYY" like "9/1/2026", "10/1/2026"
  const mdyMatch = lower.match(/^(0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](\d{4})$/);
  if (mdyMatch) {
    const mIdx = parseInt(mdyMatch[1], 10) - 1;
    const year = mdyMatch[2];
    const short = MONTH_SHORT_NAMES[mIdx] || '';
    return `${short.charAt(0).toUpperCase() + short.slice(1)} ${year}`;
  }

  // Handle "YYYY-MM" like "2026-10"
  const isoMatch = lower.match(/^(\d{4})[-/](0?[1-9]|1[0-2])$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const mIdx = parseInt(isoMatch[2], 10) - 1;
    const short = MONTH_SHORT_NAMES[mIdx] || '';
    return `${short.charAt(0).toUpperCase() + short.slice(1)} ${year}`;
  }

  // Handle "MM/YYYY" like "10/2026" or "09/2026"
  const usMatch = lower.match(/^(0?[1-9]|1[0-2])[-/](\d{4})$/);
  if (usMatch) {
    const mIdx = parseInt(usMatch[1], 10) - 1;
    const year = usMatch[2];
    const short = MONTH_SHORT_NAMES[mIdx] || '';
    return `${short.charAt(0).toUpperCase() + short.slice(1)} ${year}`;
  }

  // Handle "Month 1", "Month 2"
  const mNumMatch = lower.match(/^month\s*(\d+)$/i);
  if (mNumMatch) {
    return `Month ${mNumMatch[1]}`;
  }

  // Check words for month name and year
  const words = lower.split(/[\s\-_/.,]+/);
  let foundMonth: { monthIndex: number; shortName: string } | null = null;
  let foundYear: string | null = null;

  for (const w of words) {
    if (MONTH_ALIASES[w]) {
      foundMonth = MONTH_ALIASES[w];
    } else if (/^(20\d\d|\d{2})$/.test(w)) {
      foundYear = w.length === 2 ? `20${w}` : w;
    }
  }

  if (foundMonth && foundYear) {
    return `${foundMonth.shortName} ${foundYear}`;
  } else if (foundMonth) {
    return `${foundMonth.shortName} 2026`;
  }

  // Fallback to capitalized trimmed text
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Parses a month string to an approximate integer timestamp for chronological sorting
 */
export function getMonthSortKey(monthStr: string): number {
  const norm = normalizeMonth(monthStr);
  const lower = norm.toLowerCase();

  // If "Month X"
  const mNum = lower.match(/month\s*(\d+)/);
  if (mNum) {
    return 1000 + parseInt(mNum[1], 10);
  }

  const words = lower.split(/\s+/);
  let monthIndex = 0;
  let year = 2026;

  for (const w of words) {
    if (MONTH_ALIASES[w]) {
      monthIndex = MONTH_ALIASES[w].monthIndex;
    } else if (/^\d{4}$/.test(w)) {
      year = parseInt(w, 10);
    }
  }

  return year * 100 + monthIndex;
}

/**
 * Sorts month strings chronologically (e.g., Aug 2026 -> Sep 2026 -> Oct 2026)
 */
export function sortMonthsChronologically(months: string[]): string[] {
  return [...months].sort((a, b) => getMonthSortKey(a) - getMonthSortKey(b));
}

/**
 * Finds the previous chronologically adjacent month
 */
export function getPreviousMonth(currentMonth: string, allMonths: string[]): string | null {
  const sorted = sortMonthsChronologically(allMonths);
  const idx = sorted.indexOf(currentMonth);
  if (idx > 0) {
    return sorted[idx - 1];
  }
  return null;
}

export function getMonthInfo(str: string): { monthIndex: number; year: string | null; shortName: string } | null {
  if (!str) return null;
  const lower = String(str).trim().toLowerCase();

  // Try YYYY-MM
  const isoMatch = lower.match(/^(\d{4})[-/](0?[1-9]|1[0-2])$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const mIdx = parseInt(isoMatch[2], 10) - 1;
    return { monthIndex: mIdx, year, shortName: MONTH_SHORT_NAMES[mIdx] };
  }

  // Try MM/YYYY or M/YYYY
  const usMatch = lower.match(/^(0?[1-9]|1[0-2])[-/](\d{4})$/);
  if (usMatch) {
    const mIdx = parseInt(usMatch[1], 10) - 1;
    const year = usMatch[2];
    return { monthIndex: mIdx, year, shortName: MONTH_SHORT_NAMES[mIdx] };
  }

  // Tokenize words
  const words = lower.split(/[\s\-_/.,']+/);
  let foundMonth: { monthIndex: number; shortName: string } | null = null;
  let foundYear: string | null = null;

  for (const w of words) {
    if (MONTH_ALIASES[w]) {
      foundMonth = MONTH_ALIASES[w];
    } else if (/^(20\d\d|\d{2})$/.test(w)) {
      foundYear = w.length === 2 ? `20${w}` : w;
    }
  }

  if (foundMonth) {
    return { monthIndex: foundMonth.monthIndex, year: foundYear, shortName: foundMonth.shortName };
  }
  return null;
}

/**
 * Checks if two month strings represent the same month (e.g. 'September' == 'Sep 2026' == 'Sep')
 */
export function isSameMonth(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const cleanA = String(a).trim().toLowerCase();
  const cleanB = String(b).trim().toLowerCase();
  if (cleanA === cleanB) return true;

  if (cleanA === 'all' || cleanA === 'all months' || cleanB === 'all' || cleanB === 'all months') {
    return cleanA === cleanB;
  }

  const infoA = getMonthInfo(cleanA);
  const infoB = getMonthInfo(cleanB);
  if (!infoA || !infoB) return cleanA === cleanB;

  if (infoA.monthIndex !== infoB.monthIndex) return false;

  // If both specify a year, years must match. Otherwise match by month index.
  if (infoA.year && infoB.year) {
    return infoA.year === infoB.year;
  }
  return true;
}

/**
 * Filters or compiles work items for a specific month or Total Data (All Months)
 */
export function getWorksForSelectedMonth(
  works: WorkItem[],
  selectedMonth: string,
  availableMonths: string[] = []
): WorkItem[] {
  if (!works || works.length === 0) return [];

  // If "All Months" (Total Data) is selected, return consolidated items with cumulative count
  if (selectedMonth === 'all') {
    const map = new Map<string, WorkItem>();

    for (const w of works) {
      const key = w.activity.trim().toLowerCase();
      if (!map.has(key)) {
        const breakdown: Record<string, number> = { ...(w.monthlyBreakdown || {}) };
        if (
          w.month &&
          w.month !== 'All Months' &&
          !Object.keys(breakdown).some((bm) => isSameMonth(bm, w.month!))
        ) {
          breakdown[w.month] = w.count;
        }

        const total =
          Object.keys(breakdown).length > 0
            ? Object.values(breakdown).reduce((sum, v) => sum + (Number(v) || 0), 0)
            : w.count;

        map.set(key, {
          ...w,
          id: `all-${w.id}`,
          count: total,
          month: 'All Months',
          monthlyBreakdown: breakdown,
        });
      } else {
        const existing = map.get(key)!;
        const breakdown = existing.monthlyBreakdown || {};

        if (w.monthlyBreakdown) {
          for (const [m, count] of Object.entries(w.monthlyBreakdown)) {
            const matchKey = Object.keys(breakdown).find((bm) => isSameMonth(bm, m));
            if (matchKey) {
              breakdown[matchKey] = Math.max(breakdown[matchKey], Number(count || 0));
            } else {
              breakdown[m] = Number(count || 0);
            }
          }
        } else if (w.month && w.month !== 'All Months') {
          const matchKey = Object.keys(breakdown).find((bm) => isSameMonth(bm, w.month!));
          if (matchKey) {
            breakdown[matchKey] = Math.max(breakdown[matchKey], Number(w.count || 0));
          } else {
            breakdown[w.month] = Number(w.count || 0);
          }
        } else {
          existing.count += w.count;
        }

        existing.monthlyBreakdown = breakdown;
        existing.count = Object.values(breakdown).reduce((sum, v) => sum + (Number(v) || 0), 0);
      }
    }

    return Array.from(map.values());
  }

  // If a specific month is selected (e.g. 'Sep 2026', 'September', 'Oct 2026')
  const hasBreakdown = works.some(
    (w) => w.monthlyBreakdown && Object.keys(w.monthlyBreakdown).length > 0
  );
  if (hasBreakdown) {
    const seenActivities = new Set<string>();
    const result: WorkItem[] = [];

    for (const w of works) {
      const key = w.activity.trim().toLowerCase();
      if (seenActivities.has(key)) continue;
      seenActivities.add(key);

      let monthCount = 0;
      let foundInBreakdown = false;

      if (w.monthlyBreakdown) {
        for (const [m, count] of Object.entries(w.monthlyBreakdown)) {
          if (isSameMonth(m, selectedMonth)) {
            monthCount = Number(count || 0);
            foundInBreakdown = true;
            break;
          }
        }
      }

      if (!foundInBreakdown && w.month && isSameMonth(w.month, selectedMonth)) {
        monthCount = w.count;
      }

      // Month-specific note resolution: notes must only appear in the specific month they were created for
      let resolvedCustomNote: string | undefined = undefined;
      if (w.monthlyNotes) {
        for (const [m, noteText] of Object.entries(w.monthlyNotes)) {
          if (isSameMonth(m, selectedMonth)) {
            resolvedCustomNote = noteText;
            break;
          }
        }
      } else if (w.month && isSameMonth(w.month, selectedMonth)) {
        resolvedCustomNote = w.customNote;
      }

      result.push({
        ...w,
        count: monthCount,
        month: selectedMonth,
        customNote: resolvedCustomNote,
      });
    }

    return result;
  }

  // If works have explicit `month` properties
  const directMatches = works.filter((w) => w.month && isSameMonth(w.month, selectedMonth));
  if (directMatches.length > 0) {
    return directMatches;
  }

  // Fallback: return existing works with this month stamped
  return works.map((w) => ({ ...w, month: selectedMonth }));
}


/**
 * Computes Month-over-Month growth statistics
 */
export function computeMoMStats(
  works: WorkItem[],
  currentMonth: string,
  allMonths: string[]
): {
  prevMonth: string | null;
  currentTotal: number;
  prevTotal: number | null;
  deltaCount: number | null;
  percentChange: number | null;
} {
  const currentWorks = getWorksForSelectedMonth(works, currentMonth, allMonths);
  const currentTotal = currentWorks.reduce((s, w) => s + w.count, 0);

  if (currentMonth === 'all') {
    return {
      prevMonth: null,
      currentTotal,
      prevTotal: null,
      deltaCount: null,
      percentChange: null,
    };
  }

  const prevMonth = getPreviousMonth(currentMonth, allMonths);
  if (!prevMonth) {
    return {
      prevMonth: null,
      currentTotal,
      prevTotal: null,
      deltaCount: null,
      percentChange: null,
    };
  }

  const prevWorks = getWorksForSelectedMonth(works, prevMonth, allMonths);
  const prevTotal = prevWorks.reduce((s, w) => s + w.count, 0);
  const deltaCount = currentTotal - prevTotal;
  const percentChange = prevTotal > 0 ? ((deltaCount / prevTotal) * 100) : null;

  return {
    prevMonth,
    currentTotal,
    prevTotal,
    deltaCount,
    percentChange,
  };
}
