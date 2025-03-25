const SHEET_NAMES = {
  DASHBOARD: "Dashboard",
  JDP: "JDP",
  JOTFORM: "JotForm",
  VOLUNTEER: "Volunteer_Details",
  IDENTOGO: "IdentoGo"
};

function runUpdateStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboardSheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD) || ss.insertSheet(SHEET_NAMES.DASHBOARD);
  const jdpSheet = ss.getSheetByName(SHEET_NAMES.JDP);
  const jotFormSheet = ss.getSheetByName(SHEET_NAMES.JOTFORM);
  const volunteerSheet = ss.getSheetByName(SHEET_NAMES.VOLUNTEER);
  const identoGoSheet = ss.getSheetByName(SHEET_NAMES.IDENTOGO);

  if (!dashboardSheet || !jdpSheet || !jotFormSheet || !volunteerSheet || !identoGoSheet) {
    Logger.log("🔴 Error: One or more required sheets are missing.");
    return;
  }

  const volunteerData = volunteerSheet.getDataRange().getValues();
  const jdpData = jdpSheet.getDataRange().getValues();
  const jotFormData = jotFormSheet.getDataRange().getValues();
  const identoGoData = identoGoSheet.getDataRange().getValues();

  const dashboardHeaders = [
    "Volunteer First Name", "Volunteer Last Name", "JDP", "CDC", "AA", "Diamond",
    "First Aid", "Next IdentoGo", "Volunteer Email Address", "Volunteer Street Address",
    "Volunteer City", "Volunteer Cellphone", "Volunteer Role"
  ];
  dashboardSheet.clear();
  dashboardSheet.getRange(1, 1, 1, dashboardHeaders.length).setValues([dashboardHeaders]);
  dashboardSheet.getRange(1, 1, 1, dashboardHeaders.length).setFontWeight("bold");
  dashboardSheet.getRange(1, 1, 1, dashboardHeaders.length).setHorizontalAlignment("center");

  const buildMap = (data, firstKey, lastKey) => {
    const headers = data[0].map(h => h.toString().toLowerCase());
    const firstIndex = headers.indexOf(firstKey.toLowerCase());
    const lastIndex = headers.indexOf(lastKey.toLowerCase());
    const map = new Map();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = `${row[firstIndex]?.toLowerCase()} ${row[lastIndex]?.toLowerCase()}`.trim();
      map.set(name, row);
    }
    return map;
  };

  const jdpMap = buildMap(jdpData, "First Name", "Last Name");
  const jotFormMap = buildMap(jotFormData, "First Name", "Last Name");
  const identoGoMap = buildMap(identoGoData, "First Name", "Last Name");

  const jotHeaders = jotFormData[0].map(h => h.toLowerCase());
  const findIndex = (keyword) => jotHeaders.findIndex(h => h.includes(keyword.toLowerCase()));

  const cdcIndex = findIndex("cdc");
  const aaIndex = findIndex("abuse awareness");
  const diamondIndex = findIndex("diamond");
  const firstAidIndex = findIndex("first aid");

  const volHeaders = volunteerData[0].map(h => h.toString().toLowerCase());
  const firstIndex = volHeaders.indexOf("volunteer first name");
  const lastIndex = volHeaders.indexOf("volunteer last name");
  const emailIndex = volHeaders.indexOf("volunteer email address");
  const streetIndex = volHeaders.indexOf("volunteer street address");
  const cityIndex = volHeaders.indexOf("volunteer city");
  const phoneIndex = volHeaders.indexOf("volunteer cellphone");
  const roleIndex = volHeaders.indexOf("volunteer role");

  const identogoHeaders = identoGoData[0].map(h => h.toLowerCase());
  const expirationIndex = identogoHeaders.indexOf("identogo expiration year");

  const rows = [];
  for (let i = 1; i < volunteerData.length; i++) {
    const row = volunteerData[i];
    const first = row[firstIndex]?.trim();
    const last = row[lastIndex]?.trim();
    const fullName = `${first.toLowerCase()} ${last.toLowerCase()}`;
    const role = row[roleIndex]?.trim() || "";

    // Initialize dashboardRow with default values.
    const dashboardRow = [
      first,
      last,
      "🔴", // JDP
      "🔴", // CDC
      "🔴", // AA
      "🔴", // Diamond
      "🔴", // First Aid
      "🔴", // Next IdentoGo
      row[emailIndex],
      row[streetIndex],
      row[cityIndex],
      row[phoneIndex],
      role
    ];

    // 3. Updating Status Columns
    // JDP Status
    if (jdpMap.has(fullName)) {
      const jdp = jdpMap.get(fullName);
      const completedIndex = jdpData[0].map(h => h.toLowerCase()).findIndex(h => h.includes("completed"));
      const date = jdp[completedIndex];
      if (date) dashboardRow[2] = "🟢";
    }

    // Role-Based Statuses (CDC, AA, Diamond, IdentoGo)
    const simplifiedRole = role.toLowerCase().trim();
    const exactMatchRole = simplifiedRole === "parent volunteer" || simplifiedRole === "snack shack volunteer";
    if (exactMatchRole) {
      dashboardRow[3] = "⚪"; // CDC
      dashboardRow[4] = "⚪"; // AA
      dashboardRow[5] = "⚪"; // Diamond
      dashboardRow[7] = "⚪"; // IdentoGo Exp. (initially)
    }

    // JotForm Statuses (CDC, AA, Diamond, First Aid)
    if (jotFormMap.has(fullName)) {
      const jot = jotFormMap.get(fullName);
      if (exactMatchRole && firstAidIndex !== -1 && jot[firstAidIndex]) {
        dashboardRow[6] = "🟢"; // First Aid
      } else if (!exactMatchRole) {
        if (cdcIndex !== -1 && jot[cdcIndex]) dashboardRow[3] = "🟢"; // CDC
        if (aaIndex !== -1 && jot[aaIndex]) dashboardRow[4] = "🟢"; // AA
        if (diamondIndex !== -1 && jot[diamondIndex]) dashboardRow[5] = "🟢"; // Diamond
        if (firstAidIndex !== -1 && jot[firstAidIndex]) dashboardRow[6] = "🟢"; // First Aid
      }
    }

    // IdentoGo Status
    if (identoGoMap.has(fullName)) {
      const idento = identoGoMap.get(fullName);
      const expiration = idento[expirationIndex];
      if (expiration) {
        dashboardRow[7] = expiration;  // Store the year
      }
      else if (exactMatchRole){
        dashboardRow[7] = "⚪"
      }
      else{
        dashboardRow[7] = "🔴"
      }
    }

    rows.push(dashboardRow);
  }

  if (rows.length > 0) {
    dashboardSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

    // Center status columns: JDP through IdentoGo Exp.
    const statusStart = dashboardHeaders.indexOf("JDP") + 1;
    const statusEnd = dashboardHeaders.indexOf("Next IdentoGo") + 1;
    for (let col = statusStart; col <= statusEnd; col++) {
      dashboardSheet.getRange(2, col, rows.length).setHorizontalAlignment("center");
    }
  }

  const successMessage = "✅ Dashboard updated!";
  sendStatusUpdate(successMessage);
  return successMessage;
}
