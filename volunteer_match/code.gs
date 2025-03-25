/**
 * Control Panel UI for Background Check Management
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Custom Scripts')
    .addItem('Open Control Panel', 'showControlPanel')
    .addToUi();
}

/**
 * Displays the Control Panel sidebar
 */
function showControlPanel() {
  var html = HtmlService.createHtmlOutputFromFile('controlpanel')
    .setTitle('Verification Control Panel')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showUploadForm() {
  var html = HtmlService.createHtmlOutputFromFile('uploadform')
      .setWidth(400)
      .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import CSV File');
}

// ✅ Shared Logging System
function logStatus(message) {
  Logger.log(message);
  sendStatusUpdate(message);
}

function sendStatusUpdate(message) {
  PropertiesService.getScriptProperties().setProperty("statusMessage", message);
}

function getStatusMessage() {
  return PropertiesService.getScriptProperties().getProperty("statusMessage") || "Waiting for updates...";
}
