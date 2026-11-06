import * as XLSX from 'xlsx';
import { DashboardData, AutoSyncInterval } from '../types';
import { parseExcelWorkbook, extractGoogleSheetId, buildGoogleSheetCsvUrl } from './sheetParser';

/**
 * Converts a friendly interval string to milliseconds.
 */
export function intervalToMilliseconds(interval: AutoSyncInterval): number {
  switch (interval) {
    case '30s':
      return 30 * 1000;
    case '1m':
      return 60 * 1000;
    case '5m':
      return 5 * 60 * 1000;
    case '15m':
      return 15 * 60 * 1000;
    case 'off':
    default:
      return 0;
  }
}

/**
 * Builds the full Excel workbook download endpoint for Google Sheets.
 * Crucial: XLSX export preserves ALL tabs (e.g. September, October, Deliverables)
 * unlike CSV which only exports a single sheet.
 */
export function buildGoogleSheetXlsxUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}

/**
 * Normalizes any Google Sheet link into a direct CSV export download endpoint.
 */
export function getLiveCsvUrlFromSheetUrl(url: string): string {
  const trimmed = url.trim();

  // If user provided a "Publish to the web" CSV link directly
  if (trimmed.includes('/pub') && (trimmed.includes('output=csv') || trimmed.includes('export=csv'))) {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}_t=${Date.now()}`;
  }

  // If user provided a "Publish to the web" html link
  if (trimmed.includes('/pubhtml') || (trimmed.includes('/pub') && !trimmed.includes('output='))) {
    const base = trimmed.replace(/\/pubhtml.*/, '/pub').replace(/\/pub\?.*/, '/pub');
    return `${base}?output=csv&_t=${Date.now()}`;
  }

  // Standard Google Sheet URL (docs.google.com/spreadsheets/d/ID/...)
  const { sheetId, gid } = extractGoogleSheetId(trimmed);
  if (!sheetId) {
    throw new Error(
      'Invalid Google Sheet link. Please use a link like: https://docs.google.com/spreadsheets/d/...'
    );
  }

  const baseExportUrl = buildGoogleSheetCsvUrl(sheetId, gid);
  return `${baseExportUrl}&_t=${Date.now()}`;
}

/**
 * Fetches the Google Sheet live workbook and parses it into DashboardData.
 * It attempts to fetch the multi-tab XLSX export first to ensure all monthly tabs
 * (e.g. September, October) are retrieved, then gracefully falls back to CSV.
 */
export async function fetchAndParseGoogleSheet(url: string): Promise<DashboardData> {
  const trimmed = url.trim();
  const { sheetId } = extractGoogleSheetId(trimmed);

  // Strategy 1: If standard Google Sheet ID found, fetch full XLSX workbook to get ALL month tabs
  if (sheetId && !trimmed.includes('/pub') && !trimmed.includes('output=csv')) {
    const xlsxUrl = `${buildGoogleSheetXlsxUrl(sheetId)}&_t=${Date.now()}`;
    try {
      const response = await fetch(xlsxUrl, {
        method: 'GET',
        cache: 'no-store',
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Validate standard Zip magic header: PK (0x50, 0x4B)
        const isZip = bytes.length > 50 && bytes[0] === 0x50 && bytes[1] === 0x4b;
        if (isZip) {
          const workbook = XLSX.read(bytes, { type: 'array' });
          if (workbook.SheetNames && workbook.SheetNames.length > 0) {
            const parsedData = parseExcelWorkbook(workbook, 'Live Google Sheet');
            parsedData.sheetSourceUrl = url;
            return parsedData;
          }
        }
      }
    } catch (xlsxError) {
      console.warn('Google Sheet XLSX multi-tab fetch failed; attempting CSV export fallback:', xlsxError);
    }
  }

  // Strategy 2: Fall back to direct CSV export
  const csvUrl = getLiveCsvUrlFromSheetUrl(url);

  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/csv,text/plain,*/*',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Google Sheet not found. Please verify the URL.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Google Sheet is restricted. In Google Sheets, click "Share" -> change General access to "Anyone with the link can view".'
        );
      }
      throw new Error(`Google Sheet returned HTTP status ${response.status}`);
    }

    const csvText = await response.text();

    if (!csvText || csvText.trim().length === 0) {
      throw new Error('Google Sheet export returned empty content.');
    }

    // Check if Google redirected to HTML login page instead of CSV
    if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
      throw new Error(
        'Google Sheet sharing is not set to public. In Google Sheets, click "Share" and set General access to "Anyone with the link can view", or use "File > Share > Publish to web" as CSV.'
      );
    }

    const workbook = XLSX.read(csvText, { type: 'string' });
    const parsedData = parseExcelWorkbook(workbook, 'Live Google Sheet');
    parsedData.sheetSourceUrl = url;

    return parsedData;
  } catch (error: any) {
    console.error('Failed to sync Google Sheet:', error);
    throw error;
  }
}
