// ✅ Configuration
const CONFIG = {
  sheets: {
    JDP: 'JDP',
    JOTFORM: 'JotForm',
    VOLUNTEERS: 'Volunteer_Details',
    IDENTOGO: 'IdentoGo'
  },
  columns: {
    NAME: 'Name',
    STATUS: 'Status',
    PROGRAM_NAME: 'Program Name',
    ROLE: 'Volunteer Role',
    FIRST_NAME: 'Volunteer First Name',
    LAST_NAME: 'Volunteer Last Name'
  },
  rolePriority: {
    "Head Coach": 1,
    "Assistant Coach": 2,
    "Parent Volunteer": 3,
    "Snack Shack Volunteer": 4
  }
};

const ALLOWED_FILE_TYPES = new Set([CONFIG.sheets.JDP, CONFIG.sheets.JOTFORM, CONFIG.sheets.VOLUNTEERS]);


const getMimeType = (fileName) => {
  return fileName.toLowerCase().endsWith(".csv") ? "text/csv" : "application/octet-stream";
};

const toTitleCase = (str) => {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const parseJDPName = (name) => {
  if (!name || name.trim() === "") return { firstName: "", lastName: "" };
  if (!name.includes(",")) return { firstName: "", lastName: name.trim() };
  let parts = name.split(",");
  let lastName = parts[0].trim();
  let firstName = parts.length > 1 ? parts[1].trim().split(" ")[0].trim() : "";
  return {
    firstName: toTitleCase(firstName),
    lastName: toTitleCase(lastName)
  };
};

// ✅ Sheet Interaction Module
const SheetManager = {
  getSheet: (sheetName) => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    return sheet || ss.insertSheet(sheetName);
  },
  writeToSheet: (sheet, data, sheetName) => {
    logStatus(`🚀 Writing ${data.length} rows to '${sheetName}' sheet.`);
    if (!sheet) {
      logStatus(`❌ Sheet '${sheetName}' not found.`);
      return { success: false, message: `'${sheetName}' not found.` };
    }
    if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0])) {
      logStatus(`⚠️ Invalid data format detected for '${sheetName}'.`);
      return { success: false, message: `Invalid data format. Expected a 2D array.` };
    }
    try {
      sheet.clearContents();
      const range = sheet.getRange(1, 1, data.length, data[0].length);
      range.setValues(data);
      return { success: true, message: `'${sheetName}' file imported successfully.` };
    } catch (error) {
      logStatus(`🚨 Error writing data to '${sheetName}': ${error.message}`);
      return { success: false, message: `Error writing data to '${sheetName}'.` };
    }
  },
  clearSheet: (sheet) => {
    sheet.clearContents();
  }
};

const setLastImportTimestamp = (sheetName) => {
  logStatus(`📅 Import complete for ${sheetName}`);
  PropertiesService.getScriptProperties().setProperty("lastImport_" + sheetName, new Date().toLocaleString());
};

const validateHeaders = (headers, requiredHeaders) => {
  return requiredHeaders.every(header => headers.includes(header));
};

const processUpload = (fileData, fileName, fileType) => {
  if (!fileData || typeof fileData !== "string" || fileData.trim() === "") {
    logStatus("❌ No file data received.");
    return { success: false, message: "No file data received." };
  }

  if (!ALLOWED_FILE_TYPES.has(fileType)) {
    logStatus("❌ Invalid file type: " + fileType);
    return { success: false, message: "Invalid file format." };
  }

  try {
    const base64String = fileData.split(",")[1];
    if (!base64String) throw new Error("Base64 data missing");
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64String),
      getMimeType(fileName),
      fileName
    );

    switch (fileType) {
      case CONFIG.sheets.JDP:
        return processJDPData(blob);
      case CONFIG.sheets.JOTFORM:
        return processJotFormData(blob);
      case CONFIG.sheets.VOLUNTEERS:
        return processVolunteerData(blob);
      default:
        return { success: false, message: "Unknown file type." };
    }
  } catch (error) {
    logStatus("❌ Error decoding Base64: " + error.message);
    return { success: false, message: "Error processing file. Please try again." };
  }
};

// ✅ IdentoGo Object
const IdentoGo = {
  updateSheet: (finalRows) => {
    const identoGoSheet = SheetManager.getSheet(CONFIG.sheets.IDENTOGO);
    const identoGoHeaders = ["First Name", "Last Name", "IdentoGo Expiration Year", "Identogo UEI", "Identogo TCN#", "Record Last Updated"];
    SheetManager.clearSheet(identoGoSheet);
    SheetManager.writeToSheet(identoGoSheet, [identoGoHeaders, ...finalRows], CONFIG.sheets.IDENTOGO);
    logStatus(`✅ Updated ${finalRows.length} IdentoGo records.`);
  },
  processNewVolunteers: (data) => {
    const identoGoSheet = SheetManager.getSheet(CONFIG.sheets.IDENTOGO);
    const identoGoData = identoGoSheet.getDataRange().getValues();
    const existingNames = new Set(identoGoData.slice(1).map(row => `${row[0]?.trim()}|${row[1]?.trim()}`));
    const volFirstNameIndex = data[0].indexOf("Volunteer First Name");
    const volLastNameIndex = data[0].indexOf("Volunteer Last Name");
    const newRows = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const firstName = row[volFirstNameIndex]?.trim();
      const lastName = row[volLastNameIndex]?.trim();
      if (firstName && lastName) {
        const key = `${firstName}|${lastName}`;
        if (!existingNames.has(key)) {
          newRows.push([toTitleCase(firstName), toTitleCase(lastName)]);
          existingNames.add(key);
        }
      }
    }
    if (newRows.length > 0) {
      identoGoSheet.getRange(identoGoSheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
      logStatus(`🆕 Added ${newRows.length} new entries to IdentoGo.`);
    }
  },
  sortAndWrite: () => {
    const identoGoSheet = SheetManager.getSheet(CONFIG.sheets.IDENTOGO);
    const allRows = identoGoSheet.getDataRange().getValues();
    const header = allRows.shift();
    allRows.sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));
    SheetManager.clearSheet(identoGoSheet);
    SheetManager.writeToSheet(identoGoSheet, [header, ...allRows], CONFIG.sheets.IDENTOGO);
    logStatus("📑 IdentoGo sheet updated and sorted.");
  }
};

// ✅ Remaining core functions
function processJDPData(blob) {
  logStatus("📥 Importing JDP data...");
  const data = Utilities.parseCsv(blob.getDataAsString());
  if (!data || data.length === 0) {
    logStatus("❌ No data found in the JDP file.");
    return { success: false, message: "No data found in the file." };
  }

  let headers = null;
  let headerRowIndex = -1;
  for (let i = 1; i <= Math.min(6, data.length - 1); i++) {
    const potentialHeaders = data[i].map(h => h.trim());
    if (potentialHeaders.some(h => h !== "")) {
      headers = potentialHeaders;
      headerRowIndex = i;
      break;
    }
  }
  if (!headers) {
    logStatus("❌ No valid header row found in JDP file.");
    return { success: false, message: "No valid header row found." };
  }
  const nameIndex = headers.findIndex(h => h.toLowerCase() === "name");
  if (nameIndex !== -1) {
    headers.splice(nameIndex, 1, "First Name", "Last Name");
  } else {
    logStatus("❌ 'Name' column not found in JDP headers.");
    return { success: false, message: "'Name' column not found." };
  }

  const dataToProcess = data.slice(headerRowIndex + 1);
  let finalProcessedRows = dataToProcess.reduce((rows, row) => {
    let newRow = row.map(cell => cell.trim());
    if (newRow.length > headers.length - 1 && newRow[0] === "") newRow.shift();
    while (newRow.length < headers.length - 1) newRow.push("");
    while (newRow.length > headers.length - 1) newRow.pop();
    if (nameIndex > -1 && newRow.length > nameIndex) {
      const fullName = newRow[nameIndex];
      if (fullName) {
        const { firstName, lastName } = parseJDPName(fullName);
        newRow.splice(nameIndex, 1, firstName, lastName);
      } else {
        newRow.splice(nameIndex, 0, "", "");
      }
    }
    if (newRow.some(cell => cell !== "")) rows.push(newRow);
    return rows;
  }, []);

  finalProcessedRows.sort((a, b) => (a[nameIndex + 1] || "").localeCompare(b[nameIndex + 1] || ""));
  const sheet = SheetManager.getSheet(CONFIG.sheets.JDP);
  SheetManager.clearSheet(sheet);
  SheetManager.writeToSheet(sheet, [headers, ...finalProcessedRows], CONFIG.sheets.JDP);

  logStatus(`✅ JDP import complete with ${finalProcessedRows.length} entries.`);
  return { success: true, message: "JDP data processed and written to sheet 'JDP'." };
}

function processVolunteerData(blob) {
  logStatus("📥 Importing Volunteer data...");
  const data = Utilities.parseCsv(blob.getDataAsString());
  if (!data || data.length === 0) {
    logStatus("❌ No data found in the Volunteer file.");
    return { success: false, message: "No data found in the file." };
  }

  const volunteerSheet = SheetManager.getSheet(CONFIG.sheets.VOLUNTEERS);
  SheetManager.clearSheet(volunteerSheet);

  const headers = data[0];
  const firstNameIndex = headers.indexOf(CONFIG.columns.FIRST_NAME);
  const lastNameIndex = headers.indexOf(CONFIG.columns.LAST_NAME);
  const roleIndex = headers.indexOf(CONFIG.columns.ROLE);

  // Use a Map to store unique volunteers, prioritizing by role.
  const uniqueVolunteers = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const firstName = row[firstNameIndex]?.trim();
    const lastName = row[lastNameIndex]?.trim();
    const role = row[roleIndex]?.trim();
    const nameKey = `${firstName}|${lastName}`;
    const rolePriority = CONFIG.rolePriority[role] || 100; // Default priority if role not in ROLE_PRIORITY

    if (firstName && lastName) {
      if (!uniqueVolunteers.has(nameKey)) {
        uniqueVolunteers.set(nameKey, { row, priority: rolePriority });
      } else {
        const existingVolunteer = uniqueVolunteers.get(nameKey);
        if (rolePriority < existingVolunteer.priority) {
          uniqueVolunteers.set(nameKey, { row, priority: rolePriority });
        }
      }
    }
  }

  // Convert the Map values to an array of rows.
  const uniqueVolunteerRows = Array.from(uniqueVolunteers.values()).map(v => v.row);

  // Sort the data by last name
  const sortedData = uniqueVolunteerRows.sort((a, b) => {
    const lastNameA = a[lastNameIndex] ? a[lastNameIndex].toLowerCase() : "";
    const lastNameB = b[lastNameIndex] ? b[lastNameIndex].toLowerCase() : "";
    return lastNameA.localeCompare(lastNameB);
  });
  sortedData.unshift(headers); // Add headers back

  SheetManager.writeToSheet(volunteerSheet, sortedData, CONFIG.sheets.VOLUNTEERS);
  logStatus(`✅ Volunteer data imported and deduplicated, with ${uniqueVolunteerRows.length} unique records.`);

  const identoGoSheet = SheetManager.getSheet(CONFIG.sheets.IDENTOGO);
  const identoGoData = identoGoSheet.getDataRange().getValues();
  const existingNames = new Set(identoGoData.slice(1).map(row => `${row[0]?.trim()}|${row[1]?.trim()}`));

  const newRows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const firstName = row[firstNameIndex]?.trim();
    const lastName = row[lastNameIndex]?.trim();
    if (firstName && lastName) {
      const key = `${firstName}|${lastName}`;
      if (!existingNames.has(key)) {
        newRows.push([toTitleCase(firstName), toTitleCase(lastName)]);
        existingNames.add(key);
      }
    }
  }

  if (newRows.length > 0) {
    identoGoSheet.getRange(identoGoSheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
    logStatus(`🆕 Added ${newRows.length} new entries to IdentoGo.`);
  }

  const allRows = identoGoSheet.getDataRange().getValues();
  const header = allRows.shift();
  allRows.sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));
  SheetManager.clearSheet(identoGoSheet);
  SheetManager.writeToSheet(identoGoSheet, [header, ...allRows], CONFIG.sheets.IDENTOGO);
  logStatus("📑 IdentoGo sheet updated and sorted.");

  return { success: true, message: "Volunteer data imported successfully." };
}

function processJotFormData(blob) {
  logStatus("📥 Importing JotForm data...");
  let data;
  try {
    data = Utilities.parseCsv(blob.getDataAsString());
  } catch (err) {
    logStatus(`❌ CSV parsing failed: ${err.message}`);
    return { success: false, message: "File could not be parsed as CSV." };
  }

  if (!data || data.length === 0 || !Array.isArray(data[0])) {
    logStatus("❌ CSV parse failed or returned empty data.");
    return { success: false, message: "Invalid or empty CSV file." };
  }

  logStatus(`🧾 Parsed CSV with ${data.length} rows and ${data[0].length} columns.`);

  let headers = data[0].map(h => h.trim().replace(/^"|"$/g, ''));

  if (!validateHeaders(headers, ["Submission Date", "First Name", "Last Name", "Email Address"])) {
    logStatus("❌ No valid header row found in JotForm file.");
    return { success: false, message: "No valid header row found." };
  }

  const jotFormSheet = SheetManager.getSheet(CONFIG.sheets.JOTFORM);
  const volunteerSheet = SheetManager.getSheet(CONFIG.sheets.VOLUNTEERS);

  const jotHeaders = headers;
  // Optimization 2: Cache Column Indices
  const firstNameIndex = jotHeaders.findIndex(h => h.toLowerCase() === "first name");
  const lastNameIndex = jotHeaders.findIndex(h => h.toLowerCase() === "last name");
  const uploadColumns = [
    "Upload: Cdc Heads Up To Youth Sports: Online Training For Coaches",
    "Upload: Little League Abuse Awareness Course Certificate",
    "Upload: Little League Diamond Leader Course Certificate",
    "Upload: Ltjbsa First Aid & Safety Course"
  ];
  const uploadColumnIndexes = uploadColumns.map(col =>
    jotHeaders.findIndex(h => h.toLowerCase() === col.toLowerCase())
  );

  function normalizeHeader(h) {
    return h.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  const normalizedHeaders = jotHeaders.map(normalizeHeader);
  const ueiIndex = normalizedHeaders.findIndex(h => h.includes("uei"));
  const tcnIndex = normalizedHeaders.findIndex(h => h.includes("tcn"));
  const yearIndex = normalizedHeaders.findIndex(h => h.includes("year") && h.includes("identogo"));

  logStatus(`🧪 Matched columns → UEI: ${ueiIndex}, TCN: ${tcnIndex}, Year: ${yearIndex}`);



  const identoGoData = SheetManager.getSheet(CONFIG.sheets.IDENTOGO).getDataRange().getValues();
  // Optimization 9: Use Map for efficient lookups in IdentoGo sheet.
  const identoGoMap = new Map(identoGoData.slice(1).map(row => {
    const key = `${row[0]?.trim()}|${row[1]?.trim()}`;
    return [key, row];
  }));

  const volunteerData = volunteerSheet.getDataRange().getValues();
  const volHeaders = volunteerData[0].map(h => h.trim().toLowerCase());
  const volFirstIndex = volHeaders.indexOf("volunteer first name");
  const volLastIndex = volHeaders.indexOf("volunteer last name");
  const approvedVolunteers = new Set(volunteerData.slice(1).map(r => `${r[volFirstIndex]}|${r[volLastIndex]}`));
  const identoGoHeaders = ["First Name", "Last Name", "IdentoGo Expiration Year", "Identogo UEI", "Identogo TCN#", "Record Last Updated"]; // Define headers
  const identoGoSheet = SheetManager.getSheet(CONFIG.sheets.IDENTOGO);
  SheetManager.clearSheet(identoGoSheet);
  SheetManager.writeToSheet(identoGoSheet, [identoGoHeaders], "IdentoGo");


  const cleanedRows = data.slice(1).filter(row => {
    const hasData = row.some(cell => cell.trim() !== "");
    if (hasData) {
      uploadColumnIndexes.forEach(index => {
        if (index > -1 && typeof row[index] === "string" && row[index].trim()) {
          row[index] = "YES";
        }
      });

      const firstName = toTitleCase(row[firstNameIndex]?.trim()) || "";
      const lastName = toTitleCase(row[lastNameIndex]?.trim()) || "";
      const key = `${firstName}|${lastName}`;

      if (!approvedVolunteers.has(key)) {
        logStatus(`⚠️ ${firstName} ${lastName} not found in Volunteer_Details.`);
        return true;
      }

      const expiration = (() => {
        if (!row[yearIndex]) return "";
        const match = row[yearIndex].toString().match(/\d{4}/);
        return match ? (parseInt(match[0]) + 3).toString() : "";
      })();
      const uei = ueiIndex !== -1 ? row[ueiIndex]?.toString().toUpperCase().trim() : "";
      const tcn = tcnIndex !== -1 ? row[tcnIndex]?.toString().toUpperCase().trim() : "";

      let existing = identoGoMap.get(key);
      const isNew = !existing;
      if (!existing) {
        existing = new Array(identoGoHeaders.length).fill("");
      }

      existing[0] = firstName;
      existing[1] = lastName;
      existing[2] = expiration;
      existing[3] = uei;
      existing[4] = tcn;
      existing[5] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");

      identoGoMap.set(key, existing);

      if (isNew) {
        existing._wasNew = true;
      }
    }
    return hasData;
  });

  const updatedRows = Array.from(identoGoMap.values());
  const updatedCount = updatedRows.filter(row =>
    row[3] || row[4] || row[2]
  ).length;
  const newCount = updatedRows.filter(row => row._wasNew).length;

  const finalRows = updatedRows.map(row => {
    delete row._wasNew;
     // Ensure each row has 6 columns
    while (row.length < identoGoHeaders.length) {
      row.push(""); // Pad with empty strings
    }
    return row;
  }).sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));

  IdentoGo.updateSheet(finalRows);
  IdentoGo.sortAndWrite();

  SheetManager.writeToSheet(jotFormSheet, [headers, ...cleanedRows], CONFIG.sheets.JOTFORM);

  logStatus(`✅ Updated ${finalRows.length} IdentoGo records from JotForm.`);
  logStatus(`🆕 ${newCount} new volunteers added to IdentoGo.`);
  logStatus(`🛠️ ${updatedCount} volunteers updated with UEI, TCN#, or expiration info.`);

  return { success: true, message: "JotForm data processed and IdentoGo updated." };
}
