/**
 * RGMCE Teacher Attendance - Google Apps Script backend
 *
 * One-time setup from the Apps Script editor (script.google.com):
 *   1. Tools > Script properties > add key SPREADSHEET_ID  (or run setup(id) once)
 *   2. Run setup("YOUR_SPREADSHEET_ID") and authorise.
 *   3. Deploy > New deployment > Web app > Execute as: Me, Access: Anyone.
 *   4. Copy the Web app URL into docs/app.js (CONFIG.ENDPOINT).
 *
 * All dates and times use Asia/Kolkata.
 */

var TIMEZONE = "Asia/Kolkata";
var FMT_DATE = "yyyy-MM-dd";
var FMT_TIME = "HH:mm:ss";
var SHEET_TEACHERS = "Teachers";
var SHEET_ATTENDANCE = "Attendance";
var SHEET_CONFIG = "Config";
var SHEET_LEAVE = "Leaves";
var LOCK_WAIT_MS = 10000;

var CONFIG_DEFAULTS = [
  ["COLLEGE_LAT", 32.4017359985446],
  ["COLLEGE_LNG", 75.5026562104331],
  ["RADIUS_M", 200],
  ["LATE_AFTER", "10:00"],
  ["MAX_ACCURACY_M", 250]
];

var HEADERS_TEACHERS = ["Teacher ID", "Teacher Name", "Active"];
var HEADERS_ATTENDANCE = [
  "Teacher ID", "Teacher Name", "Date", "Arrival Time", "Departure Time",
  "Arrival Latitude", "Arrival Longitude", "Departure Latitude", "Departure Longitude",
  "Status", "Hours Worked"
];
var HEADERS_LEAVE = ["Teacher ID", "Teacher Name", "Date", "Leave Time", "Marked At"];

function doGet(e) {
  return jsonOut_({ ok: true, service: "rgmce-attendance" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (err) {
    return jsonOut_({ ok: false, error: "The server is busy. Please try again in a moment." });
  }
  try {
    var payload = parsePayload_(e);
    if (!payload.action) return jsonOut_({ ok: false, error: "Missing action." });

    if (payload.action === "config") return jsonOut_(handleConfig_());
    if (payload.action === "identify") return jsonOut_(handleIdentify_(payload));
    if (payload.action === "today") return jsonOut_(handleToday_(payload));
    if (payload.action === "mark") return jsonOut_(handleMark_(payload));
    if (payload.action === "leave") return jsonOut_(handleLeave_(payload));
    return jsonOut_({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function setup(spreadsheetId) {
  if (!spreadsheetId) throw new Error("Pass the spreadsheet ID, e.g. setup('1AbC...').");
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", String(spreadsheetId).trim());
  var ss = SpreadsheetApp.openById(String(spreadsheetId).trim());

  var teachers = ensureSheet_(ss, SHEET_TEACHERS, HEADERS_TEACHERS);
  ensureSheet_(ss, SHEET_ATTENDANCE, HEADERS_ATTENDANCE);
  ensureSheet_(ss, SHEET_LEAVE, HEADERS_LEAVE);
  var config = ensureSheet_(ss, SHEET_CONFIG, ["Key", "Value"]);

  if (teachers.getLastRow() < 2) {
    teachers.appendRow(["T001", "Sample Teacher (replace me)", "yes"]);
  }
  seedConfig_(config);
  return "Spreadsheet connected. Teachers: " + ss.getUrl();
}

function handleConfig_() {
  var cfg = readConfig_();
  return {
    ok: true,
    collegeLat: cfg.COLLEGE_LAT,
    collegeLng: cfg.COLLEGE_LNG,
    radiusM: cfg.RADIUS_M,
    lateAfter: minutesToTime_(minutesOfDay_(cfg.LATE_AFTER)),
    maxAccuracyM: cfg.MAX_ACCURACY_M
  };
}

function handleIdentify_(payload) {
  var teacherId = normalizeId_(payload.teacherId);
  if (!teacherId) return { ok: false, error: "Please enter your Teacher ID." };

  var teacher = findTeacher_(teacherId);
  if (!teacher) return { ok: false, error: "Teacher ID not found. Check the ID and try again." };
  if (!teacher.active) return { ok: false, error: "This Teacher ID is inactive. Contact the admin." };

  return { ok: true, teacherId: teacher.teacherId, name: teacher.name };
}

function handleToday_(payload) {
  var teacherId = normalizeId_(payload.teacherId);
  if (!teacherId) return { ok: false, error: "Missing Teacher ID." };

  var teacher = findTeacher_(teacherId);
  if (!teacher || !teacher.active) return { ok: false, error: "This Teacher ID is not active." };

  var sheet = attendanceSheet_();
  var today = todayStr_();
  var now = new Date();
  var row = findAttendanceRow_(sheet, teacherId, today);
  var leaveSheet = leaveSheet_();
  var leaveRow = findLeaveRow_(leaveSheet, teacherId, today);
  var serverState = {
    date: today,
    serverTime: Utilities.formatDate(now, TIMEZONE, FMT_TIME),
    attendanceOpen: isWithinAllowedHours_(now)
  };

  if (row < 0 && leaveRow < 0) {
    return {
      ok: true,
      marked: false,
      leave: false,
      date: serverState.date,
      serverTime: serverState.serverTime,
      attendanceOpen: serverState.attendanceOpen,
      arrivalTime: null,
      departureTime: null,
      status: null,
      hoursWorked: null
    };
  }
  var values = row >= 0 ? sheet.getRange(row, 1, 1, HEADERS_ATTENDANCE.length).getValues()[0] : null;
  var arrT = values ? emptyToNull_(values[3]) : null;
  return {
    ok: true,
    marked: arrT ? true : false,
    leave: leaveRow >= 0,
    date: serverState.date,
    serverTime: serverState.serverTime,
    attendanceOpen: serverState.attendanceOpen,
    arrivalTime: arrT,
    departureTime: values ? emptyToNull_(values[4]) : null,
    status: values ? emptyToNull_(values[9]) : null,
    hoursWorked: values ? emptyToNull_(values[10]) : null
  };
}

function handleMark_(payload) {
  var teacherId = normalizeId_(payload.teacherId);
  var type = String(payload.type || "").toLowerCase();
  if (!teacherId) return { ok: false, error: "Missing Teacher ID." };
  if (type !== "arrival" && type !== "departure") return { ok: false, error: "Invalid mark type." };

  var coords = validateCoords_(payload.lat, payload.lng);
  if (!coords) return { ok: false, error: "Invalid location reading. Try again." };

  var teacher = findTeacher_(teacherId);
  if (!teacher) return { ok: false, error: "Teacher ID not found." };
  if (!teacher.active) return { ok: false, error: "This Teacher ID is inactive. Contact the admin." };

  var sheet = attendanceSheet_();
  var leaveSheet = leaveSheet_();
  var today = todayStr_();
  if (findLeaveRow_(leaveSheet, teacherId, today) >= 0) {
    return { ok: false, error: "Leave has already been recorded for today." };
  }
  var now = new Date();
  var timeStr = Utilities.formatDate(now, TIMEZONE, FMT_TIME);
  if (!isWithinAllowedHours_(now)) {
    return { ok: false, error: "Attendance can only be marked between 8:00 AM and 3:00 PM IST." };
  }
  var row = findAttendanceRow_(sheet, teacherId, today);

  if (type === "arrival") {
    var cfg = readConfig_();
    if (row > 0) {
      var existingArr = sheet.getRange(row, 4).getValue();
      if (emptyToNull_(existingArr)) {
        return { ok: false, error: "Arrival is already marked for today at " + existingArr + "." };
      }
      sheet.getRange(row, 4).setValue(timeStr);
      sheet.getRange(row, 6).setValue(coords.lat);
      sheet.getRange(row, 7).setValue(coords.lng);
      sheet.getRange(row, 10).setValue(statusFor_(timeStr, cfg.LATE_AFTER));
      return { ok: true, type: "arrival", time: timeStr, date: today };
    }
    var statusArr = statusFor_(timeStr, cfg.LATE_AFTER);
    sheet.appendRow([
      teacher.teacherId, teacher.name, today, timeStr, "",
      coords.lat, coords.lng, "", "", statusArr, ""
    ]);
    return { ok: true, type: "arrival", time: timeStr, date: today };
  }

  if (row < 0) {
    return { ok: false, error: "Arrival has not been marked today. Mark arrival first." };
  }
  var valuesDep = sheet.getRange(row, 1, 1, HEADERS_ATTENDANCE.length).getValues()[0];
  var arrivalTimeDep = emptyToNull_(valuesDep[3]);
  if (!arrivalTimeDep) {
    // Try to find again in case of timing
    row = findAttendanceRow_(sheet, teacherId, today);
    if (row >= 0) {
      valuesDep = sheet.getRange(row, 1, 1, HEADERS_ATTENDANCE.length).getValues()[0];
      arrivalTimeDep = emptyToNull_(valuesDep[3]);
    }
  }
  if (!arrivalTimeDep) {
    return { ok: false, error: "Arrival has not been marked today. Mark arrival first." };
  }
  if (emptyToNull_(valuesDep[4])) {
    return { ok: false, error: "Departure is already marked for today at " + valuesDep[4] + "." };
  }

  var hoursDep = hoursBetween_(arrivalTimeDep, timeStr);
  sheet.getRange(row, 5).setValue(timeStr);
  sheet.getRange(row, 8).setValue(coords.lat);
  sheet.getRange(row, 9).setValue(coords.lng);
  sheet.getRange(row, 11).setValue(hoursDep);
  return { ok: true, type: "departure", time: timeStr, date: today, hoursWorked: hoursDep };
}

function handleLeave_(payload) {
  var teacherId = normalizeId_(payload.teacherId);
  if (!teacherId) return { ok: false, error: "Missing Teacher ID." };

  var teacher = findTeacher_(teacherId);
  if (!teacher) return { ok: false, error: "Teacher ID not found." };
  if (!teacher.active) return { ok: false, error: "This Teacher ID is inactive. Contact the admin." };

  var sheet = attendanceSheet_();
  var leaveSheet = leaveSheet_();
  var today = todayStr_();
  var now = new Date();
  if (findLeaveRow_(leaveSheet, teacherId, today) >= 0) {
    return { ok: false, error: "Leave has already been recorded for today." };
  }
  if (!isWithinAllowedHours_(now)) {
    return { ok: false, error: "Leave can only be marked between 8:00 AM and 3:00 PM IST." };
  }
  var attRow = findAttendanceRow_(sheet, teacherId, today);
  if (attRow >= 0) {
    var valuesL = sheet.getRange(attRow, 1, 1, HEADERS_ATTENDANCE.length).getValues()[0];
    if (emptyToNull_(valuesL[3]) || emptyToNull_(valuesL[4])) {
      return { ok: false, error: "Cannot mark leave after arrival or departure has been recorded for today." };
    }
  }
  var timeStr = Utilities.formatDate(now, TIMEZONE, FMT_TIME);
  var markedAt = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  try {
    leaveSheet.appendRow([teacher.teacherId, teacher.name, today, timeStr, markedAt]);
  } catch (e) {
    var ss2 = getSheet_();
    leaveSheet = ss2.getSheetByName(SHEET_LEAVE);
    if (!leaveSheet) {
      leaveSheet = ss2.insertSheet(SHEET_LEAVE);
      if (leaveSheet.getLastRow() === 0) {
        leaveSheet.appendRow(HEADERS_LEAVE);
        leaveSheet.setFrozenRows(1);
      }
    }
    leaveSheet.appendRow([teacher.teacherId, teacher.name, today, timeStr, markedAt]);
  }
  return { ok: true, type: "leave", time: timeStr, date: today };
}

function getSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("SPREADSHEET_ID is not set. Run setup() from the Apps Script editor first.");
  return SpreadsheetApp.openById(id);
}

function teachersSheet_() { return getSheet_().getSheetByName(SHEET_TEACHERS); }
function attendanceSheet_() { return getSheet_().getSheetByName(SHEET_ATTENDANCE); }
function leaveSheet_() {
  var ss = getSheet_();
  var sheet = ss.getSheetByName(SHEET_LEAVE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LEAVE);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS_LEAVE);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedConfig_(config) {
  var existing = {};
  var last = config.getLastRow();
  if (last >= 2) {
    var rows = config.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) existing[String(rows[i][0])] = true;
  }
  for (var j = 0; j < CONFIG_DEFAULTS.length; j++) {
    if (!existing[CONFIG_DEFAULTS[j][0]]) config.appendRow(CONFIG_DEFAULTS[j]);
  }
}

function readConfig_() {
  var sheet = getSheet_().getSheetByName(SHEET_CONFIG);
  var cfg = {};
  for (var i = 0; i < CONFIG_DEFAULTS.length; i++) cfg[CONFIG_DEFAULTS[i][0]] = CONFIG_DEFAULTS[i][1];
  if (sheet && sheet.getLastRow() >= 2) {
    var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
    var rows = range.getValues();
    var display = typeof range.getDisplayValues === "function" ? range.getDisplayValues() : null;
    for (var j = 0; j < rows.length; j++) {
      var key = String(rows[j][0]).trim();
      if (!key) continue;
      // A time cell read with getValues() comes back as a Date (Sheets stores
      // time-only values against the 1899-12-30 sentinel), and converting that
      // date back with the timezone can drift by a few minutes because of the
      // pre-1906 local-mean-time offset. The displayed text is what the admin
      // actually typed, so use it for LATE_AFTER and keep raw values elsewhere
      // (the coordinates must stay numeric).
      if (key === "LATE_AFTER") {
        var shown = display ? String(display[j][1]).trim() : "";
        cfg[key] = shown && minutesOfDay_(shown) != null ? shown : rows[j][1];
      } else {
        cfg[key] = rows[j][1];
      }
    }
  }
  cfg.RADIUS_M = Number(cfg.RADIUS_M) || 100;
  cfg.MAX_ACCURACY_M = Number(cfg.MAX_ACCURACY_M) || 150;
  cfg.COLLEGE_LAT = Number(cfg.COLLEGE_LAT);
  cfg.COLLEGE_LNG = Number(cfg.COLLEGE_LNG);
  return cfg;
}

function findTeacher_(teacherId) {
  var sheet = teachersSheet_();
  if (!sheet) throw new Error("Teachers sheet is missing. Run setup().");
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var rows = sheet.getRange(2, 1, last - 1, HEADERS_TEACHERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeId_(rows[i][0]) === teacherId) {
      return {
        teacherId: teacherId,
        name: String(rows[i][1] || "").trim(),
        active: isActive_(rows[i][2])
      };
    }
  }
  return null;
}

function findAttendanceRow_(sheet, teacherId, dateStr) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var rows = sheet.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeId_(rows[i][0]) === teacherId && dateKey_(rows[i][2]) === dateStr) {
      return i + 2;
    }
  }
  return -1;
}

function findLeaveRow_(sheet, teacherId, dateStr) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var rows = sheet.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeId_(rows[i][0]) === teacherId && dateKey_(rows[i][2]) === dateStr) {
      return i + 2;
    }
  }
  return -1;
}

function dateKey_(value) {
  if (value === "" || value == null) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TIMEZONE, FMT_DATE);
  }
  var s = String(value).trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    return m[1] + "-" + pad2_(m[2]) + "-" + pad2_(m[3]);
  }
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, TIMEZONE, FMT_DATE);
  }
  return s;
}

function pad2_(value) {
  var s = String(value);
  return s.length < 2 ? "0" + s : s;
}

function isActive_(value) {
  if (value === true || value === 1) return true;
  var s = String(value == null ? "" : value).trim().toLowerCase();
  if (!s) return true;
  return !(s === "no" || s === "false" || s === "0" || s === "inactive");
}

function normalizeId_(value) {
  return String(value == null ? "" : value).trim().toUpperCase();
}

function validateCoords_(lat, lng) {
  var la = Number(lat);
  var lo = Number(lng);
  if (isNaN(la) || isNaN(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la, lng: lo };
}

function statusFor_(arrivalTime, lateAfter) {
  var arrival = minutesOfDay_(arrivalTime);
  var threshold = minutesOfDay_(lateAfter);
  if (arrival == null || threshold == null) return "On time";
  return arrival > threshold ? "Late" : "On time";
}

// Turns any of the shapes a Config/Attendance cell can come back as into
// minutes since midnight IST:
//   - "HH:mm" / "HH:mm:ss"                (plain text or a displayed cell)
//   - a Sheets time value, read back as a Date object (e.g. 1899-12-30T...)
//   - an ISO date-time string             (e.g. "1899-12-30T04:38:50.000Z")
//   - a day fraction 0..1                 (an unformatted Sheets time serial)
//   - a whole number 0..1440              (minutes since midnight)
// Returns null when the value cannot be understood, so status stays "On time".
function minutesOfDay_(value) {
  if (value === "" || value == null) return null;

  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (isNaN(value.getTime())) return null;
    return hmToMinutes_(Utilities.formatDate(value, TIMEZONE, "HH:mm"));
  }

  if (typeof value === "number") return numericMinutes_(value);

  var s = String(value).trim();
  if (!s) return null;

  // A cell can also hand back a numeric serial or minutes as text.
  if (/^\d+(\.\d+)?$/.test(s)) return numericMinutes_(Number(s));

  // An ISO timestamp is a moment in time; read its IST wall clock.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    var parsed = new Date(s);
    if (isNaN(parsed.getTime())) return null;
    return hmToMinutes_(Utilities.formatDate(parsed, TIMEZONE, "HH:mm"));
  }

  return hmToMinutes_(s);
}

function numericMinutes_(value) {
  if (!isFinite(value) || value < 0) return null;
  if (value < 1) return Math.round(value * 1440);
  if (value <= 1440) return Math.round(value);
  return null;
}

function hmToMinutes_(text) {
  var m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(text).trim());
  if (!m) return null;
  var h = Number(m[1]);
  var min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutesToTime_(minutes) {
  if (minutes == null) return null;
  return pad2_(Math.floor(minutes / 60)) + ":" + pad2_(minutes % 60);
}

function timeToMs_(value) {
  var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(value == null ? "" : value).trim());
  if (!m) return null;
  return Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3] || 0) * 1000;
}

function hoursBetween_(arrivalTime, departureTime) {
  var a = timeToMs_(arrivalTime);
  var d = timeToMs_(departureTime);
  if (a == null || d == null || d < a) return "";
  return Math.round(((d - a) / 3600000) * 100) / 100;
}

function isWithinAllowedHours_(date) {
  var hour = Number(Utilities.formatDate(date, TIMEZONE, "HH"));
  var minute = Number(Utilities.formatDate(date, TIMEZONE, "mm"));
  if (isNaN(hour) || isNaN(minute)) return false;
  var total = hour * 60 + minute;
  var start = 8 * 60;
  var end = 15 * 60; // 3:00 PM
  return total >= start && total < end;
}

function todayStr_() {
  return Utilities.formatDate(new Date(), TIMEZONE, FMT_DATE);
}

function emptyToNull_(value) {
  if (value === "" || value == null) return null;
  return value;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parsePayload_(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    throw new Error("Invalid request body.");
  }
}
