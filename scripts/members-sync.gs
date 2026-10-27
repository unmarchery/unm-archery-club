/**
 * UNM Archery Club: sends the membership form responses to the website.
 *
 * Setup (once, by whoever owns the form, ideally the club Google account):
 * 1. Open the form's response sheet > Extensions > Apps Script, paste this file, save.
 * 2. Project Settings > Script Properties > add:
 *      SYNC_URL     https://<your-site>/api/members/sync
 *      SYNC_SECRET  the same value as MEMBERS_SYNC_SECRET on the website
 * 3. Run syncMembers once from the editor and allow the permissions it asks for.
 * 4. Triggers (clock icon) > Add trigger > syncMembers > From spreadsheet > On form submit.
 * After that, every new form response reaches the website within a few seconds.
 */

var SHEET_NAME = 'Form Responses 1';

// Matches each needed column by part of its header text.
var COLUMNS = {
  student_id: 'Student ID',
  full_name: 'Full Name',
  email: 'University Email',
  level: 'Student Level',
  experience: 'Previous Archery Experience'
};

function syncMembers() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SYNC_URL');
  var secret = props.getProperty('SYNC_SECRET');
  if (!url || !secret) throw new Error('Set SYNC_URL and SYNC_SECRET in Script Properties first.');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var header = values[0].map(String);

  var index = {};
  Object.keys(COLUMNS).forEach(function (key) {
    index[key] = header.findIndex(function (h) { return h.indexOf(COLUMNS[key]) !== -1; });
    if (index[key] === -1) throw new Error('Column not found: ' + COLUMNS[key]);
  });

  var rows = values.slice(1)
    .filter(function (r) { return String(r[index.student_id]).trim() !== ''; })
    .map(function (r) {
      var row = {};
      Object.keys(index).forEach(function (key) { row[key] = r[index[key]]; });
      return row;
    });

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
