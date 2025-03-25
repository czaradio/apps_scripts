function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Custom Scripts')
    .addItem('Generate Team Numbers', 'TeamNumberGenerator')
    .addToUi();
}

function TeamNumberGenerator() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const selection = sheet.getSelection();
  const activeRange = selection.getActiveRange();
  const sheetName = sheet.getName(); // Get Sheet Title

  let startCell = "A1"; // Default
  let numTeams = ""; 
  let numPlayers = "";

  if (activeRange) {
    startCell = activeRange.getA1Notation();
    numTeams = activeRange.getNumColumns();
    numPlayers = activeRange.getNumRows();
  }

  const html = HtmlService.createHtmlOutput(`
    <p><b>Enter team parameters:</b></p>
    <label>Start Cell</label>
    <input type="text" id="startCell" value="${startCell}" required>
    <br><br>
    <label>Number of Teams</label>
    <input type="number" id="numTeams" min="1" max="10" value="${numTeams}" required>
    <br><br>
    <label>Number of Players Per Team</label>
    <input type="number" id="numPlayers" min="1" max="100" value="${numPlayers}" required>
    <br><br>
    <label>Team Name Prefix</label>
    <input type="text" id="teamPrefix" value="${sheetName}" placeholder="e.g., LLB Rookies">
    <br><br>
    <label>Uniform Number Range (comma-separated)</label>
    <input type="text" id="numberRange" value="0-99" placeholder="e.g., 0-99, 100-125, 200-500">
    <br><br>
    <label>Uniform Numbers to Include (comma-separated)</label>
    <input type="text" id="specificNumbers" value="52" placeholder="e.g., 99, 10">
    <br><br>
    <label>Uniform Numbers to Exclude (comma-separated)</label>
    <input type="text" id="excludedNumbers" value="60-69" placeholder="e.g., 60-69, 80">
    <br><br>
    <input type="checkbox" id="uniqueNumbers" checked="checked">
    <label for="uniqueNumbers">Generate Unique Numbers Per Team</label>
    <br><br>
    <button onclick="submitData()">Generate</button>

    <script>
      function submitData() {
        google.script.run
        .withFailureHandler(error => alert("⚠️ Error: " + error.message))
        .withSuccessHandler(() => google.script.host.close())
        .processTeamNumbers(
          document.getElementById('startCell').value,
          document.getElementById('numTeams').value,
          document.getElementById('numPlayers').value,
          document.getElementById('teamPrefix').value,
          document.getElementById('numberRange').value,
          document.getElementById('specificNumbers').value,
          document.getElementById('excludedNumbers').value,
          document.getElementById('uniqueNumbers').checked
        );
      }
    </script>
  `).setWidth(400).setHeight(550);

  ui.showModalDialog(html, 'Generate Team Numbers');
}

function processTeamNumbers(startCell, numTeams, numPlayers, teamPrefix, numberRange, specificNumbers, excludedNumbers, uniqueNumbers) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const sheetName = sheet.getName(); // Get Sheet Title
    const startRange = sheet.getRange(startCell);
    const startRow = startRange.getRow();
    const startCol = startRange.getColumn();

    numTeams = parseInt(numTeams);
    numPlayers = parseInt(numPlayers);
    
    if (!teamPrefix) teamPrefix = sheetName; // Default to sheet name if input is empty

    const excludedSet = new Set();
    parseExcludedRanges(excludedNumbers, excludedSet);

    let specificNumsArray = specificNumbers
      ? specificNumbers.split(",").map(num => parseInt(num.trim())).filter(num => !isNaN(num) && !excludedSet.has(num))
      : [];

    let availableNumbers = [];
    numberRange.split(",").forEach(rangeStr => {
      const range = rangeStr.trim().split("-");
      if (range.length === 2) {
        let min = parseInt(range[0]), max = parseInt(range[1]);
        if (!isNaN(min) && !isNaN(max) && min < max) {
          for (let i = min; i <= max; i++) availableNumbers.push(i);
        }
      } else {
        let num = parseInt(range[0]);
        if (!isNaN(num)) availableNumbers.push(num);
      }
    });

    availableNumbers = availableNumbers.filter(num => !excludedSet.has(num));

    if (uniqueNumbers && availableNumbers.length + specificNumsArray.length < numPlayers * numTeams) {
      throw new Error("Not enough unique numbers available.");
    }

    if (uniqueNumbers) shuffleArray(availableNumbers);

    let resultGrid = Array.from({ length: numPlayers }, () => new Array(numTeams).fill(null));

    let availableIndex = 0;
    for (let team = 0; team < numTeams; team++) {
      let rowIndices = Array.from({ length: numPlayers }, (_, i) => i);
      shuffleArray(rowIndices); // Shuffle row indices to distribute user-inputted numbers randomly

      let assignedIndices = new Set();
      specificNumsArray.forEach((num, index) => {
        let randIndex = rowIndices[index % numPlayers]; // Distribute user numbers randomly
        resultGrid[randIndex][team] = num;
        assignedIndices.add(randIndex);
      });

      for (let i = 0; i < numPlayers; i++) {
        if (!assignedIndices.has(i)) {
          resultGrid[i][team] = availableNumbers[availableIndex++];
        }
      }
    }

    // Create Header Row (Using User-Specified Team Prefix)
    let headers = Array.from({ length: numTeams }, (_, i) => `${teamPrefix} ${i + 1}`);
    let headerRange = sheet.getRange(startRow, startCol, 1, numTeams);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");

    // Write Team Data & Center Align All Output
    let dataRange = sheet.getRange(startRow + 1, startCol, numPlayers, numTeams);
    dataRange.setValues(resultGrid);
    dataRange.setHorizontalAlignment("center");

  } catch (error) {
    console.error("Error Processing Team Numbers:", error);
    throw new Error(error.message);
  }
}

/**
 * Parse excluded number ranges into a Set
 */
function parseExcludedRanges(excludedRanges, excludedSet) {
  if (!excludedRanges) return;

  excludedRanges.split(",").forEach(rangeStr => {
    const range = rangeStr.trim().split("-");
    if (range.length === 2) {
      const min = parseInt(range[0]), max = parseInt(range[1]);
      if (!isNaN(min) && !isNaN(max)) {
        for (let i = min; i <= max; i++) excludedSet.add(i);
      }
    } else {
      const num = parseInt(range[0]);
      if (!isNaN(num)) excludedSet.add(num);
    }
  });
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
