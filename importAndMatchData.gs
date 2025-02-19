function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Scripts')
    .addItem('Update Background Check', 'UpdateBackgroundCheck')
    .addItem('Import and Match Data', 'selectAndImportFile')
    .addToUi();
}

function selectAndImportFile() {
  var folderId = '1lY7zOSPR0ovWTce1kjv2Bt6kS1ygQxVZ';
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var fileList = [];

  while (files.hasNext()) {
    fileList.push(files.next().getName());
  }

  if (fileList.length === 0) {
    SpreadsheetApp.getUi().alert('No files found in the folder. Please upload a CSV or XLSX file.');
    return;
  }

  var html = HtmlService.createHtmlOutput(generateFileSelectionForm(fileList))
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select Files to Import');
}

function generateFileSelectionForm(fileList) {
  var html = `<h3>Select Files to Import</h3>
  <form id="fileSelectionForm">`;
  fileList.forEach(file => {
    html += `<input type="checkbox" name="files" value="${file}"> ${file}<br>`;
  });
  html += `<br><button type="button" id="submitFilesBtn">Next</button>
  </form>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      var submitButton = document.getElementById("submitFilesBtn");
      if (submitButton) {
        submitButton.addEventListener("click", function() {
          console.log("Next button clicked");
          var selectedFiles = Array.from(document.querySelectorAll("input[name='files']:checked"))
                                .map(el => el.value);
          
          console.log("Selected files:", selectedFiles);
          if (selectedFiles.length === 0) {
            alert("Please select at least one file before proceeding.");
            return;
          }
          
          google.script.run
            .withSuccessHandler(function(response) {
              console.log("Success Handler Triggered");
              showSheetSelectionDialog(response);
            })
            .withFailureHandler(function(error) {
              console.error("Error Handler Triggered", error);
              alert("Error: " + error.message);
            })
            .setSelectedFiles(selectedFiles);
        });
      }
    });
  </script>`;
  return html;
}

function setSelectedFiles(selectedFiles) {
  console.log("setSelectedFiles called with:", selectedFiles);
  PropertiesService.getScriptProperties().setProperty('selectedFiles', JSON.stringify(selectedFiles));
  return selectedFiles;
}
