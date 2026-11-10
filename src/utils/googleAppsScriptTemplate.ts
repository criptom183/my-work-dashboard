/**
 * VZONE MARKETING DASHBOARD - GOOGLE SHEET AUTOSAVE TEMPLATE
 * Complete, plug-and-play Google Apps Script that auto-creates the "Topic Breakdown" tab
 * and records all topics added in the dashboard directly into the user's Google Sheet in real time.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * VZONE MARKETING DASHBOARD - GOOGLE SHEET AUTOSAVE SCRIPT
 * ============================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
 * 1. In your Google Sheet, click on top menu: Extensions > Apps Script
 * 2. Delete any default code in Code.gs, and PASTE this entire script.
 * 3. Click the Save icon (floppy disk 💾).
 * 4. Click the blue "Deploy" button at top right > Select "New deployment".
 * 5. Click the gear icon ⚙️ next to "Select type" and choose "Web app".
 * 6. Set Description: "VZone Autosave"
 * 7. Set Execute as: "Me"
 * 8. Set Who has access: "Anyone"   <--- (CRITICAL: Must be "Anyone"!)
 * 9. Click "Deploy".
 * 10. Click "Authorize access" (Select your Google account > Advanced > Go to Untitled / Allow).
 * 11. Copy the "Web app URL" (starts with https://script.google.com/macros/s/.../exec).
 * 12. Paste the URL into the dashboard modal and click "Send Test Row"!
 * ============================================================================
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
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
    var sheetName = "Topic Breakdown";
    var sheet = ss.getSheetByName(sheetName);

    // Auto-create "Topic Breakdown" tab if it does not exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Timestamp", "Month", "Deliverable / Work Item", "Topic Title", "Notes / Details"]);
      var headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setBackground("#1D1B48");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    var params = (e && e.parameter) ? e.parameter : {};
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (jsonErr) {}
    }

    var action = params.action || body.action || "addTopic";
    var timestamp = new Date().toLocaleString();

    // Build existing topics lookup to avoid duplicates: "month|deliverable|title"
    var existingKeys = {};
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var existingData = sheet.getRange(2, 2, lastRow - 1, 3).getValues();
      for (var r = 0; r < existingData.length; r++) {
        var eMonth = String(existingData[r][0] || '').trim().toLowerCase();
        var eDeliverable = String(existingData[r][1] || '').trim().toLowerCase();
        var eTitle = String(existingData[r][2] || '').trim().toLowerCase();
        if (eTitle) {
          existingKeys[eMonth + '|' + eDeliverable + '|' + eTitle] = true;
        }
      }
    }

    // 1. Support bulk sync of multiple topics
    var items = body.items;
    if (!items && params.items) {
      try { items = JSON.parse(params.items); } catch (e) {}
    }

    if (action === "bulkSync" && Array.isArray(items) && items.length > 0) {
      var newRows = [];
      for (var i = 0; i < items.length; i++) {
        var itm = items[i];
        var itmMonth = String(itm.month || params.month || "Nov 2026").trim();
        var itmDeliverable = String(itm.deliverable || itm.activity || "Deliverable").trim();
        var itmTitle = String(itm.title || itm.topic || "").trim();
        var lookupKey = itmMonth.toLowerCase() + '|' + itmDeliverable.toLowerCase() + '|' + itmTitle.toLowerCase();

        // Skip if already in sheet
        if (!existingKeys[lookupKey]) {
          existingKeys[lookupKey] = true;
          newRows.push([
            timestamp,
            itmMonth,
            itmDeliverable,
            itmTitle,
            itm.note || ""
          ]);
        }
      }
      if (newRows.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, newRows.length, 5).setValues(newRows);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Synced " + newRows.length + " new topics (skipped duplicates)",
        added: newRows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Add single topic or test row
    var deliverable = String(params.deliverable || body.deliverable || "Dashboard Test").trim();
    var month = String(params.month || body.month || "Current Month").trim();
    var title = String(params.title || body.title || params.topic || body.topic || "Test Topic Connection").trim();
    var note = params.note || body.note || "";

    var singleKey = month.toLowerCase() + '|' + deliverable.toLowerCase() + '|' + title.toLowerCase();

    // If already exists and not a test connection row, skip duplicate
    if (action !== "test" && existingKeys[singleKey]) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "skipped",
        message: "Topic already exists in sheet, skipping duplicate",
        data: { deliverable: deliverable, title: title, month: month }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([
      timestamp,
      month,
      deliverable,
      title,
      note
    ]);

    // Format new row styling
    var appendedRow = sheet.getLastRow();
    sheet.getRange(appendedRow, 1).setHorizontalAlignment("center");
    sheet.getRange(appendedRow, 2).setHorizontalAlignment("center");

    try {
      sheet.autoResizeColumns(1, 5);
    } catch (resizeErr) {}

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row added to Google Sheet successfully",
      data: { deliverable: deliverable, title: title, month: month }
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
`;
