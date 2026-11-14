/**
 * VZONE MARKETING DASHBOARD - GOOGLE SHEET AUTOSAVE TEMPLATE
 * Complete, plug-and-play Google Apps Script that auto-creates the "Topic Breakdown" tab
 * and records all topics added in the dashboard directly into the user's Google Sheet in real time.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * VZONE MARKETING DASHBOARD - GOOGLE SHEET AUTOSAVE SCRIPT (v2 - Links & Edits)
 * ============================================================================
 *
 * INSTRUCTIONS TO DEPLOY (OR UPDATE AN EXISTING DEPLOYMENT):
 * 1. In your Google Sheet, click Extensions > Apps Script
 * 2. Select all code in Code.gs, delete it, and PASTE this entire script.
 * 3. Click the Save icon (floppy disk).
 * 4. If FIRST TIME:
 *    - Click Deploy > New deployment > gear icon > Web app
 *    - Execute as: "Me" | Who has access: "Anyone"
 *    - Click Deploy > Authorize access > Copy the /exec Web app URL
 *    If UPDATING AN EXISTING DEPLOYMENT (keeps your same URL!):
 *    - Click Deploy > Manage deployments > pencil (Edit) icon
 *    - Under Version, select "New version" > Click Deploy
 * ============================================================================
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function normKeyPart(val) {
  return String(val || "").trim().toLowerCase().replace(/\\s+/g, " ");
}

function ensureTopicBreakdownSheet(ss) {
  var sheetName = "Topic Breakdown";
  var sheet = ss.getSheetByName(sheetName);
  var headers = ["Timestamp", "Month", "Deliverable / Work Item", "Topic Title", "Notes / Details", "Link / URL"];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    styleHeaderRow(sheet, 6);
    sheet.setFrozenRows(1);
    return sheet;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
    styleHeaderRow(sheet, 6);
    sheet.setFrozenRows(1);
    return sheet;
  }

  // Check if Row 1 is a real header row or an accidentally headerless data row
  var maxCols = Math.max(sheet.getLastColumn(), 6);
  var firstRowDisplay = sheet.getRange(1, 1, 1, maxCols).getDisplayValues()[0];
  var joinedHeader = firstRowDisplay.join(" ").toLowerCase();
  var looksLikeHeader =
    joinedHeader.indexOf("deliverable") !== -1 ||
    joinedHeader.indexOf("topic") !== -1 ||
    joinedHeader.indexOf("title") !== -1 ||
    joinedHeader.indexOf("timestamp") !== -1 ||
    joinedHeader.indexOf("work item") !== -1;

  if (!looksLikeHeader) {
    // Shift existing data down by 1 row and insert proper 6-column header at Row 1
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 6).setValues([headers]);
    styleHeaderRow(sheet, 6);
    sheet.setFrozenRows(1);
  } else {
    // Ensure column 6 ("Link / URL") header exists
    var col6Header = String(firstRowDisplay[5] || "").trim();
    if (!col6Header) {
      sheet.getRange(1, 6).setValue("Link / URL");
      styleHeaderRow(sheet, 6);
    }
  }

  return sheet;
}

function ensureDeliverableLinksSheet(ss) {
  var sheetName = "Deliverable Links";
  var sheet = ss.getSheetByName(sheetName);
  var headers = ["Timestamp", "Month", "Deliverable / Work Item", "Note", "Link / URL"];
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    styleHeaderRow(sheet, 5);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function styleHeaderRow(sheet, colCount) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground("#1D1B48");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Server busy, please retry"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ensureTopicBreakdownSheet(ss);

    var params = (e && e.parameter) ? e.parameter : {};
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (jsonErr) {}
    }

    var action = params.action || body.action || "upsertTopic";
    var timestamp = new Date().toLocaleString();

    // 0. Sync deliverable-level links if provided (in "Deliverable Links" tab)
    var deliverableLinks = body.deliverableLinks;
    if (!deliverableLinks && params.deliverableLinks) {
      try { deliverableLinks = JSON.parse(params.deliverableLinks); } catch (errDL) {}
    }
    if (Array.isArray(deliverableLinks) && deliverableLinks.length > 0) {
      upsertDeliverableLinks(ss, deliverableLinks, timestamp);
      if (action === "syncDeliverableLinks") {
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Deliverable links synced cleanly"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Build existing rows index using getDisplayValues() so month labels like "Nov 2026" stay exact
    var existingRows = {};
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var numCols = Math.max(sheet.getLastColumn(), 6);
      var displayRows = sheet.getRange(2, 1, lastRow - 1, numCols).getDisplayValues();
      for (var r = 0; r < displayRows.length; r++) {
        var rowData = displayRows[r];
        var eMonth = normKeyPart(rowData[1]);
        var eDeliv = normKeyPart(rowData[2]);
        var eTitle = normKeyPart(rowData[3]);
        if (eDeliv && eTitle) {
          var rowKey = eMonth + "|" + eDeliv + "|" + eTitle;
          // Keep the first matching row index (1-based sheet row)
          if (!existingRows[rowKey]) {
            existingRows[rowKey] = {
              rowNum: r + 2,
              title: String(rowData[3] || "").trim(),
              note: String(rowData[4] || "").trim(),
              link: String(rowData[5] || "").trim()
            };
          }
        }
      }
    }

    // 1. Support bulk sync of multiple topics (adds new rows, updates changed notes/links/titles in place)
    var items = body.items;
    if (!items && params.items) {
      try { items = JSON.parse(params.items); } catch (errItems) {}
    }

    if (action === "bulkSync" && Array.isArray(items) && items.length > 0) {
      var addedCount = 0;
      var updatedCount = 0;
      var skippedCount = 0;
      var newRows = [];

      for (var i = 0; i < items.length; i++) {
        var itm = items[i];
        var itmMonth = String(itm.month || params.month || "Nov 2026").trim();
        var itmDeliv = String(itm.deliverable || itm.activity || "Deliverable").trim();
        var itmTitle = String(itm.title || itm.topic || "").trim();
        var itmOldTitle = String(itm.oldTitle || "").trim();
        var itmNote = String(itm.note || "").trim();
        var itmLink = String(itm.link || itm.driveLink || itm.url || "").trim();

        if (!itmDeliv || !itmTitle) continue;

        var lookupKey = normKeyPart(itmMonth) + "|" + normKeyPart(itmDeliv) + "|" + normKeyPart(itmTitle);
        var oldLookupKey = itmOldTitle
          ? normKeyPart(itmMonth) + "|" + normKeyPart(itmDeliv) + "|" + normKeyPart(itmOldTitle)
          : "";

        var existing = existingRows[lookupKey] || (oldLookupKey ? existingRows[oldLookupKey] : null);

        if (existing) {
          if (existing.title !== itmTitle || existing.note !== itmNote || existing.link !== itmLink) {
            sheet.getRange(existing.rowNum, 1).setValue(timestamp);
            sheet.getRange(existing.rowNum, 4, 1, 3).setValues([[itmTitle, itmNote, itmLink]]);
            if (oldLookupKey && oldLookupKey !== lookupKey) {
              delete existingRows[oldLookupKey];
            }
            existingRows[lookupKey] = {
              rowNum: existing.rowNum,
              title: itmTitle,
              note: itmNote,
              link: itmLink
            };
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          existingRows[lookupKey] = {
            rowNum: lastRow + newRows.length + 1,
            title: itmTitle,
            note: itmNote,
            link: itmLink
          };
          newRows.push([timestamp, itmMonth, itmDeliv, itmTitle, itmNote, itmLink]);
          addedCount++;
        }
      }

      if (newRows.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, newRows.length, 6).setValues(newRows);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Added " + addedCount + ", updated " + updatedCount + ", unchanged " + skippedCount,
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Upsert single topic (addTopic / upsertTopic / updateTopic / test)
    var deliverable = String(params.deliverable || body.deliverable || "Dashboard Test").trim();
    var month = String(params.month || body.month || "Current Month").trim();
    var title = String(params.title || body.title || params.topic || body.topic || "Test Topic Connection").trim();
    var oldTitle = String(params.oldTitle || body.oldTitle || "").trim();
    var note = String(params.note !== undefined ? params.note : (body.note !== undefined ? body.note : "")).trim();
    var link = String(
      params.link || params.driveLink || params.url ||
      body.link || body.driveLink || body.url || ""
    ).trim();

    var singleKey = normKeyPart(month) + "|" + normKeyPart(deliverable) + "|" + normKeyPart(title);
    var oldSingleKey = oldTitle
      ? normKeyPart(month) + "|" + normKeyPart(deliverable) + "|" + normKeyPart(oldTitle)
      : "";

    var matched = existingRows[singleKey] || (oldSingleKey ? existingRows[oldSingleKey] : null);

    if (action !== "test" && matched) {
      if (matched.title !== title || matched.note !== note || matched.link !== link) {
        sheet.getRange(matched.rowNum, 1).setValue(timestamp);
        sheet.getRange(matched.rowNum, 4, 1, 3).setValues([[title, note, link]]);
        return ContentService.createTextOutput(JSON.stringify({
          status: "updated",
          message: "Existing topic updated in Google Sheet",
          data: { deliverable: deliverable, title: title, month: month, note: note, link: link }
        })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "skipped",
        message: "Topic already matches Google Sheet, skipping duplicate",
        data: { deliverable: deliverable, title: title, month: month }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([timestamp, month, deliverable, title, note, link]);

    var appendedRow = sheet.getLastRow();
    sheet.getRange(appendedRow, 1).setHorizontalAlignment("center");
    sheet.getRange(appendedRow, 2).setHorizontalAlignment("center");

    try {
      sheet.autoResizeColumns(1, 6);
    } catch (resizeErr) {}

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row added to Google Sheet successfully",
      data: { deliverable: deliverable, title: title, month: month, note: note, link: link }
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function upsertDeliverableLinks(ss, list, timestamp) {
  var sheet = ensureDeliverableLinksSheet(ss);
  var lastRow = sheet.getLastRow();
  var map = {};
  if (lastRow > 1) {
    var rows = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
    for (var r = 0; r < rows.length; r++) {
      var k = normKeyPart(rows[r][1]) + "|" + normKeyPart(rows[r][2]);
      if (!map[k]) {
        map[k] = {
          rowNum: r + 2,
          note: String(rows[r][3] || "").trim(),
          link: String(rows[r][4] || "").trim()
        };
      }
    }
  }
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var m = String(item.month || "Nov 2026").trim();
    var d = String(item.deliverable || "").trim();
    var n = String(item.note || "").trim();
    var l = String(item.link || item.driveLink || "").trim();
    if (!d || !l) continue;
    var key = normKeyPart(m) + "|" + normKeyPart(d);
    var ex = map[key];
    if (ex) {
      if (ex.note !== n || ex.link !== l) {
        sheet.getRange(ex.rowNum, 1).setValue(timestamp);
        sheet.getRange(ex.rowNum, 4, 1, 2).setValues([[n, l]]);
      }
    } else {
      sheet.appendRow([timestamp, m, d, n, l]);
      map[key] = { rowNum: sheet.getLastRow(), note: n, link: l };
    }
  }
}
`;

