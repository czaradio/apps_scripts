/**
 * Generates a simplified Webshare sheet from the Dashboard.
 * Shows only: Name, JDP, CDC, AA, Diamond, First Aid, Next IdentoGo, and Last Updated.
 */
function createWebShareDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboard = ss.getSheetByName("Dashboard");
  const webshareName = "Webshare";
  let web = ss.getSheetByName(webshareName);

  sendStatusUpdate("🌐 Creating Webshare dashboard...");

  if (!dashboard) {
    const error = "❌ Dashboard sheet not found.";
    Logger.log(error);
    sendStatusUpdate(error);
    return;
  }

  // Create or clear the Webshare sheet
  if (web) {
    web.clear();
  } else {
    web = ss.insertSheet(webshareName);
  }

  const data = dashboard.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  // Get column indices
  const colMap = name => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const firstNameCol = colMap("volunteer first name");
  const lastNameCol = colMap("volunteer last name");
  const jdpCol = colMap("jdp");
  const cdcCol = colMap("cdc");
  const aaCol = colMap("aa");
  const diamondCol = colMap("diamond");
  const firstAidCol = colMap("first aid");
  const identogoCol = colMap("next identogo"); // Changed column name here

  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, HH:mm");

  // Write "Last Updated" timestamp and legend in A1 (white background, small italic font)
  const lastUpdatedCell = web.getRange("A1")
    .setValue(`Last Updated: ${now}  🟢 = ON FILE, 🔴 = NEEDED, ⚪ = NOT REQUIRED`) // Added legend to the string
    .setFontStyle("italic")
    .setFontSize(9)
    .setBackground("#ffffff");

  //Merge A1 and D1
  web.getRange("A1:D1").merge();


  // Write headers to row 2
  const outputHeaders = ["Name", "JDP", "CDC", "AA", "Diamond", "First Aid", "Next IdentoGo"]; // Changed column name here
  const headerRange = web.getRange(2, 1, 1, outputHeaders.length);
  headerRange.setValues([outputHeaders]);
  headerRange
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBackground("#eeeeee");

  // Build output rows with first initial + dot + last name (e.g., J. Smith)
  const output = rows.map(r => {
    const newRow = [
      `${String(r[firstNameCol]).trim().charAt(0).toUpperCase()}. ${String(r[lastNameCol]).trim()}`,
      r[jdpCol], r[cdcCol], r[aaCol], r[diamondCol], r[firstAidCol], r[identogoCol],
    ];

    return newRow;
  });

  if (output.length > 0) {
    const dataRange = web.getRange(3, 1, output.length, outputHeaders.length);
    dataRange.setValues(output);

    // Apply formatting to the "Next IdentoGo" column (column index is 7, 1-based)
    for (let i = 0; i < output.length; i++) {
      const identogoValue = output[i][6]; // 0-based index
      if (typeof identogoValue === 'number') { // Check if it is a number
        web.getRange(i + 3, 7) // i+3 because data starts on row 3
          .setFontWeight("bold")
          .setFontColor("green");
      }
    }
    web.getRange(3, 2, output.length, 6).setHorizontalAlignment("center");
  }

  Logger.log("🌐 Webshare sheet created with simplified view.");
  sendStatusUpdate("✅ Webshare dashboard updated!");
  return "✅ Webshare dashboard updated!";
}
