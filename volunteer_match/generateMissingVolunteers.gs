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

// 🔍 Improved Fuzzy Matching with stronger last-name logic
function getPotentialMatch(firstName, lastName, volunteerList) {
  const normalize = s => String(s || "").toLowerCase().trim();
  const first = normalize(firstName);
  const last = normalize(lastName);

  let bestMatch = "";
  let bestScore = 0;

  volunteerList.forEach(v => {
    const vFirst = normalize(v.first);
    const vLast = normalize(v.last);

    const firstScore = stringSimilarity(first, vFirst);
    const lastScore = last.includes(vLast) || vLast.includes(last) ? 1 : stringSimilarity(last, vLast);

    let combined;
    if (lastScore === 1) {
      combined = 0.8; // prioritize last-name-only matches
    } else {
      combined = (firstScore * 0.6) + (lastScore * 0.4);
    }

    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = `${v.first} ${v.last}`;
    }
  });

  return bestScore > 0.65 ? bestMatch : ""; // tuned threshold
}

function stringSimilarity(a, b) {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const matchCount = [...aSet].filter(ch => bSet.has(ch)).length;
  return matchCount / Math.max(a.length, b.length);
}

function namesLooselyMatch(first1, last1, first2, last2) {
  const f1 = String(first1).trim().toLowerCase();
  const l1 = String(last1).trim().toLowerCase();
  const f2 = String(first2).trim().toLowerCase();
  const l2 = String(last2).trim().toLowerCase();
  return f1 === f2 && (l1.includes(l2) || l2.includes(l1));
}

// 🧩 Main Function
function generateMissingVolunteersReport() {
  logStatus("🔍 Generating Missing Volunteers Report...");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jdp = ss.getSheetByName("JDP");
  const jotform = ss.getSheetByName("Jotform");
  const volunteerSheet = ss.getSheetByName("Volunteer_Details");
  const reportSheetName = "Missing Volunteers";
  let reportSheet = ss.getSheetByName(reportSheetName);

  if (reportSheet) {
    reportSheet.clearContents();
    reportSheet.clearFormats();
  } else {
    reportSheet = ss.insertSheet(reportSheetName);
  }

  // Get volunteer reference data
  const volData = volunteerSheet.getDataRange().getValues();
  const volHeaders = volData[0];
  const volFirstNameCol = volHeaders.findIndex(h => h.toLowerCase().includes("first name"));
  const volLastNameCol = volHeaders.findIndex(h => h.toLowerCase().includes("last name"));

  const volunteerList = volData.slice(1).map(r => ({
    first: r[volFirstNameCol],
    last: r[volLastNameCol]
  }));

  const missing = [];

  function checkSheet(sheet, sourceName) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const firstCol = headers.findIndex(h => h.toLowerCase().includes("first name"));
    const lastCol = headers.findIndex(h => h.toLowerCase().includes("last name"));
    const emailCol = headers.findIndex(h => h.toLowerCase().includes("email"));
    const dateCol = headers.findIndex(h => h.toLowerCase().includes("submission date"));

    let count = 0;

    data.slice(1).forEach(row => {
      const first = row[firstCol];
      const last = row[lastCol];
      const email = emailCol !== -1 ? row[emailCol] : "";
      const date = dateCol !== -1 ? row[dateCol] : "";
      const isInVolunteers = volunteerList.some(v =>
        namesLooselyMatch(first, last, v.first, v.last)
      );

      if (!isInVolunteers) {
        const potential = getPotentialMatch(first, last, volunteerList);
        missing.push([`${first} ${last}`, sourceName, date, email, potential]);
        count++;
      }
    });

    logStatus(`✅ Checked ${sourceName}: Found ${count} potentially missing`);
  }

  checkSheet(jdp, "JDP");
  checkSheet(jotform, "Jotform");

  // Write headers and data
  const headers = ["Name", "Source", "Submission Date", "Email", "Potential Match"];
  reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  reportSheet.getRange(2, 1, missing.length, headers.length).setValues(missing);

  // Format headers
  const headerRange = reportSheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold").setHorizontalAlignment("center").setBackground("#f1f1f1");
  reportSheet.autoResizeColumns(1, headers.length);

  logStatus(`📋 Missing Volunteers Report complete. Total flagged: ${missing.length}`);
}
