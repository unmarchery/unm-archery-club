/**
 * UNM Archery Club: weekly backup to the club Google Drive.
 *
 * Saves a copy of the club's data (members, bookings, passes, top-ups, exco...) as a
 * JSON file in a Drive folder called "UNM Archery backups", and keeps the newest 12.
 * Login passwords are not included: after a restore, people use "Forgot password".
 *
 * Setup (once, signed in as the club Gmail):
 * 1. Go to https://script.google.com > New project. Paste this whole file.
 * 2. Project Settings (gear) > Script properties > Add:
 *      SITE_URL     https://<your-site>        (no slash at the end)
 *      CRON_SECRET  the same value as CRON_SECRET in Netlify
 * 3. Select `backupNow` and click Run once. Allow the permissions it asks for.
 *    A file should appear in Drive > UNM Archery backups.
 * 4. Triggers (clock icon) > Add trigger: function `backupNow`, time-driven,
 *    week timer, every Sunday, 2am to 3am.
 */

var FOLDER_NAME = 'UNM Archery backups';
var KEEP = 12;

function backupNow() {
  var props = PropertiesService.getScriptProperties();
  var site = props.getProperty('SITE_URL');
  var secret = props.getProperty('CRON_SECRET');
  if (!site || !secret) throw new Error('Set SITE_URL and CRON_SECRET in Script properties first.');

  var res = UrlFetchApp.fetch(site + '/api/backup', {
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Backup failed: ' + res.getResponseCode() + ' ' + res.getContentText());

  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  var name = 'unm-archery-' + Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd') + '.json';
  folder.createFile(name, res.getContentText(), 'application/json');

  // Keep only the newest KEEP backups.
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = KEEP; i < files.length; i++) files[i].setTrashed(true);
}
