import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "Code.gs"), "utf8");

function fmtPart(date, tz, type) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return parts.find((p) => p.type === type).value;
}

function formatDateMock(date, tz, fmt) {
  const y = fmtPart(date, tz, "year");
  const m = fmtPart(date, tz, "month");
  const d = fmtPart(date, tz, "day");
  const hh = fmtPart(date, tz, "hour");
  const mm = fmtPart(date, tz, "minute");
  const ss = fmtPart(date, tz, "second");
  if (fmt === "yyyy-MM-dd") return `${y}-${m}-${d}`;
  if (fmt === "HH:mm:ss") return `${hh}:${mm}:${ss}`;
  if (fmt === "HH:mm") return `${hh}:${mm}`;
  if (fmt === "HH") return hh;
  if (fmt === "mm") return mm;
  if (fmt === "H") return String(parseInt(hh, 10));
  if (fmt === "m") return String(parseInt(mm, 10));
  throw new Error("Unsupported format in mock: " + fmt);
}

class MockSheet {
  constructor(name, data) {
    this.name = name;
    this.data = data.map((r) => r.slice());
  }
  getName() { return this.name; }
  getSheetId() { return 1; }
  getLastRow() { return this.data.length; }
  clearContents() { this.data = []; }
  clearFormats() { return this; }
  setFrozenRows() { return this; }
  autoResizeColumns() { return this; }
  deleteRow(row) { this.data.splice(row - 1, 1); return this; }
  appendRow(row) { this.data.push(row.slice()); }
  getRange(row, col, numRows, numCols) {
    const h = numRows == null ? 1 : numRows;
    const w = numCols == null ? 1 : numCols;
    const sheet = this;
    const chain = { merge() { return chain; }, setFontWeight() { return chain; }, setFontSize() { return chain; }, setHorizontalAlignment() { return chain; }, setBorder() { return chain; } };
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < h; i++) {
          const src = sheet.data[row - 1 + i] || [];
          out.push(src.slice(col - 1, col - 1 + w).concat(Array(Math.max(0, w - src.length + col - 1)).fill("")));
        }
        return out;
      },
      getValue() { return this.getValues()[0][0]; },
      setValue(v) {
        if (!sheet.data[row - 1]) sheet.data[row - 1] = [];
        sheet.data[row - 1][col - 1] = v;
        return chain;
      },
      setValues(vals) {
        vals.forEach((r, i) => {
          r.forEach((v, j) => {
            if (!sheet.data[row - 1 + i]) sheet.data[row - 1 + i] = [];
            sheet.data[row - 1 + i][col - 1 + j] = v;
          });
        });
        return chain;
      },
      merge() { return chain; },
      setFontWeight() { return chain; },
      setFontSize() { return chain; },
      setHorizontalAlignment() { return chain; },
      setBorder() { return chain; }
    };
  }
}

function makeContext({ nowIso, teachers, attendance, config, leaves }) {
  const now = new Date(nowIso);
  const sheets = {
    Teachers: new MockSheet("Teachers", teachers),
    Attendance: new MockSheet("Attendance", attendance),
    Config: new MockSheet("Config", config),
    Leaves: new MockSheet("Leaves", leaves || [["Teacher ID", "Teacher Name", "Date", "Leave Time", "Marked At"]])
  };
  const lock = {
    waitCalls: 0,
    releaseCalls: 0,
    waitLock() { this.waitCalls++; },
    releaseLock() { this.releaseCalls++; }
  };

  class MockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
    static now() { return now.getTime(); }
  }

  const ctx = {
    console,
    Date: MockDate,
    PropertiesService: {
      getScriptProperties() {
        return { getProperty: () => "SPREAD123", setProperty: () => {} };
      }
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: (name) => sheets[name] || null,
        insertSheet: (name) => { sheets[name] = new MockSheet(name, []); return sheets[name]; },
        getUrl: () => "https://example.invalid/sheet",
        getSheetId: () => 1
      })
    },
    LockService: { getScriptLock: () => lock },
    Utilities: {
      formatDate(date, tz, pattern) {
        if (pattern === "yyyy-MM-dd HH:mm:ss") {
          return formatDateMock(date, tz, "yyyy-MM-dd") + " " + formatDateMock(date, tz, "HH:mm:ss");
        }
        return formatDateMock(date, tz, pattern);
      }
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) {
        return { setMimeType() { return this; }, getContent: () => text };
      }
    },
    _sheets: sheets,
    _lock: lock
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

function call(ctx, payload) {
  const out = ctx.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(out.getContent());
}

const TEACHERS = [
  ["Teacher ID", "Teacher Name", "Active"],
  ["T001", "Dr Asha Sharma", "yes"],
  ["T002", "Mr Bilal Ahmad", "no"],
  ["T003", "Ms Chitra Devi", "TRUE"]
];

const ATTENDANCE_HEADER = [
  "Teacher ID", "Teacher Name", "Date", "Arrival Time", "Departure Time",
  "Arrival Latitude", "Arrival Longitude", "Departure Latitude", "Departure Longitude",
  "Status", "Hours Worked"
];

const CONFIG_SHEET = [
  ["Key", "Value"],
  ["COLLEGE_LAT", 32.7],
  ["COLLEGE_LNG", 75.3],
  ["RADIUS_M", 100],
  ["MAX_ACCURACY_M", 150]
];

// Older installations still carry this row. The app ignores it and setup()
// removes it.
const CONFIG_SHEET_WITH_LEGACY_KEY = [
  ["Key", "Value"],
  ["COLLEGE_LAT", 32.7],
  ["COLLEGE_LNG", 75.3],
  ["RADIUS_M", 100],
  ["LATE_AFTER", "10:00"],
  ["MAX_ACCURACY_M", 150]
];

function fresh(overrides = {}) {
  return makeContext({
    nowIso: overrides.nowIso || "2026-10-21T08:59:30+05:30",
    teachers: overrides.teachers || TEACHERS,
    attendance: overrides.attendance || [ATTENDANCE_HEADER.slice()],
    config: overrides.config || CONFIG_SHEET,
    leaves: overrides.leaves
  });
}

test("config endpoint returns college settings without a late threshold", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "config" });
  assert.equal(res.ok, true);
  assert.equal(res.collegeLat, 32.7);
  assert.equal(res.radiusM, 100);
  assert.equal(res.lateAfter, undefined);
});

test("config endpoint ignores a leftover LATE_AFTER row", () => {
  const ctx = fresh({ config: CONFIG_SHEET_WITH_LEGACY_KEY });
  const res = call(ctx, { action: "config" });
  assert.equal(res.ok, true);
  assert.equal(res.lateAfter, undefined);
  assert.equal(res.maxAccuracyM, 150);
});

test("setup removes the unused LATE_AFTER config row", () => {
  const ctx = fresh({ config: CONFIG_SHEET_WITH_LEGACY_KEY });
  ctx.setup("SPREAD123");
  const keys = ctx._sheets.Config.data.slice(1).map((row) => String(row[0]).trim());
  assert.ok(!keys.includes("LATE_AFTER"), "LATE_AFTER row must be removed");
  assert.ok(keys.includes("COLLEGE_LAT"), "other config rows must be kept");
  assert.equal(ctx._sheets.Teachers.data.length, TEACHERS.length, "teachers must not be touched");
});

test("setup keeps a config sheet that has no unused rows", () => {
  const ctx = fresh();
  ctx.setup("SPREAD123");
  const keys = ctx._sheets.Config.data.slice(1).map((row) => String(row[0]).trim());
  assert.deepEqual(keys, ["COLLEGE_LAT", "COLLEGE_LNG", "RADIUS_M", "MAX_ACCURACY_M"]);
});

test("identify accepts active teacher, rejects unknown and inactive", () => {
  const ctx = fresh();
  assert.deepEqual(call(ctx, { action: "identify", teacherId: "t001" }), {
    ok: true, teacherId: "T001", name: "Dr Asha Sharma"
  });
  assert.equal(call(ctx, { action: "identify", teacherId: "X999" }).ok, false);
  const inactive = call(ctx, { action: "identify", teacherId: "T002" });
  assert.equal(inactive.ok, false);
  assert.match(inactive.error, /inactive/i);
});

test("arrival creates one row with On time status", () => {
  const ctx = fresh();
  const res = call(ctx, {
    action: "mark", teacherId: "T001", type: "arrival", lat: 32.7001, lng: 75.3001
  });
  assert.equal(res.ok, true);
  assert.equal(res.time, "08:59:30");
  const rows = ctx._sheets.Attendance.data;
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "T001");
  assert.equal(rows[1][2], "2026-10-21");
  assert.equal(rows[1][3], "08:59:30");
  assert.equal(rows[1][9], "On time");
  assert.equal(ctx._lock.releaseCalls, 1);
});

test("duplicate arrival is rejected and original time is kept", () => {
  const ctx = fresh();
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  const second = call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(second.ok, false);
  assert.match(second.error, /already marked/i);
  assert.equal(ctx._sheets.Attendance.data.length, 2);
  assert.equal(ctx._sheets.Attendance.data[1][3], "08:59:30");
});

test("status is always On time because there is no late policy", () => {
  const ctx = fresh({ nowIso: "2026-10-21T14:59:00+05:30" });
  const res = call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(res.ok, true);
  assert.equal(ctx._sheets.Attendance.data[1][9], "On time");
});

test("departure updates the same row and computes hours worked", () => {
  const ctx = fresh({ nowIso: "2026-10-21T09:00:00+05:30" });
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });

  ctx._sheets.Attendance.data[1][3] = "09:00:00";
  const dep = call(ctx, { action: "mark", teacherId: "T001", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(dep.ok, true);
  assert.equal(dep.time, "09:00:00");
  const row = ctx._sheets.Attendance.data[1];
  assert.equal(row[4], "09:00:00");
  assert.equal(row[7], 32.7);
  assert.equal(row[8], 75.3);
  assert.equal(row[10], 0);
  assert.equal(ctx._sheets.Attendance.data.length, 2);
});

test("hours worked spans multiple hours", () => {
  const ctx = fresh({ nowIso: "2026-10-21T14:30:00+05:30" });
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  ctx._sheets.Attendance.data[1][3] = "08:00:00";
  const dep = call(ctx, { action: "mark", teacherId: "T001", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(dep.hoursWorked, 6.5);
});

test("departure without arrival is rejected", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "mark", teacherId: "T003", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(res.ok, false);
  assert.match(res.error, /arrival has not been marked/i);
});

test("duplicate departure is rejected", () => {
  const ctx = fresh({ nowIso: "2026-10-21T14:30:00+05:30" });
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  call(ctx, { action: "mark", teacherId: "T001", type: "departure", lat: 32.7, lng: 75.3 });
  const again = call(ctx, { action: "mark", teacherId: "T001", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(again.ok, false);
  assert.match(again.error, /already marked/i);
});

test("inactive teacher cannot mark attendance", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "mark", teacherId: "T002", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(res.ok, false);
  assert.match(res.error, /inactive/i);
});

test("invalid coordinates are rejected", () => {
  const ctx = fresh();
  assert.equal(call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: "x", lng: 75.3 }).ok, false);
  assert.equal(call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 999, lng: 75.3 }).ok, false);
});

test("today returns current status for the teacher", () => {
  const ctx = fresh();
  assert.equal(call(ctx, { action: "today", teacherId: "T001" }).marked, false);
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  const today = call(ctx, { action: "today", teacherId: "T001" });
  assert.equal(today.marked, true);
  assert.equal(today.arrivalTime, "08:59:30");
  assert.equal(today.departureTime, null);
  assert.equal(today.status, "On time");
});

test("lock is released even when the request fails", () => {
  const ctx = fresh();
  call(ctx, { action: "mark", teacherId: "NOPE", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(ctx._lock.waitCalls, 1);
  assert.equal(ctx._lock.releaseCalls, 1);
});

test("arrival is rejected before 8:00 AM and from 3:00 PM onwards", () => {
  const early = fresh({ nowIso: "2026-10-21T07:59:00+05:30" });
  const earlyRes = call(early, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(earlyRes.ok, false);
  assert.match(earlyRes.error, /8:00 AM and 3:00 PM/i);

  const late = fresh({ nowIso: "2026-10-21T15:00:00+05:30" });
  const lateRes = call(late, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(lateRes.ok, false);
  assert.match(lateRes.error, /8:00 AM and 3:00 PM/i);

  const edge = fresh({ nowIso: "2026-10-21T08:00:00+05:30" });
  assert.equal(call(edge, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 }).ok, true);
});

test("leave is allowed inside working hours and does not require location", () => {
  const ctx = fresh({ nowIso: "2026-10-21T09:00:00+05:30" });
  const res = call(ctx, { action: "leave", teacherId: "T001" });
  assert.equal(res.ok, true);
  assert.equal(res.type, "leave");
  assert.equal(res.time, "09:00:00");
  const row = ctx._sheets.Leaves.data[1];
  assert.equal(row[0], "T001");
  assert.equal(row[1], "Dr Asha Sharma");
  assert.equal(row[2], "2026-10-21");
  assert.equal(row[3], "09:00:00");
  assert.equal(row[4], "2026-10-21 09:00:00");
});

test("leave is rejected outside working hours", () => {
  const evening = fresh({ nowIso: "2026-10-21T18:30:00+05:30" });
  const res = call(evening, { action: "leave", teacherId: "T001" });
  assert.equal(res.ok, false);
  assert.match(res.error, /8:00 AM and 3:00 PM/i);
  assert.equal(evening._sheets.Leaves.data.length, 1, "no leave row may be written");

  const early = fresh({ nowIso: "2026-10-21T07:30:00+05:30" });
  const earlyRes = call(early, { action: "leave", teacherId: "T001" });
  assert.equal(earlyRes.ok, false);
  assert.match(earlyRes.error, /8:00 AM and 3:00 PM/i);

  const edge = fresh({ nowIso: "2026-10-21T14:59:00+05:30" });
  assert.equal(call(edge, { action: "leave", teacherId: "T001" }).ok, true);

  const closing = fresh({ nowIso: "2026-10-21T15:00:00+05:30" });
  assert.equal(call(closing, { action: "leave", teacherId: "T001" }).ok, false);
});

test("a leave that already exists is reported before the working hours check", () => {
  const ctx = fresh({
    nowIso: "2026-10-21T16:00:00+05:30",
    leaves: [
      ["Teacher ID", "Teacher Name", "Date", "Leave Time", "Marked At"],
      ["T001", "Dr Asha Sharma", "2026-10-21", "09:00:00", "2026-10-21 09:00:00"]
    ]
  });
  const res = call(ctx, { action: "leave", teacherId: "T001" });
  assert.equal(res.ok, false);
  assert.match(res.error, /already been recorded/i);
});

test("duplicate leave on the same day is rejected", () => {
  const ctx = fresh();
  assert.equal(call(ctx, { action: "leave", teacherId: "T001" }).ok, true);
  const second = call(ctx, { action: "leave", teacherId: "T001" });
  assert.equal(second.ok, false);
  assert.match(second.error, /already been recorded/i);
  assert.equal(ctx._sheets.Leaves.data.length, 2);
});

test("leave is rejected when attendance already exists", () => {
  const ctx = fresh();
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  const res = call(ctx, { action: "leave", teacherId: "T001" });
  assert.equal(res.ok, false);
  assert.match(res.error, /cannot mark leave after arrival or departure/i);
});

test("attendance is rejected when leave was already recorded", () => {
  const ctx = fresh();
  call(ctx, { action: "leave", teacherId: "T001" });
  const res = call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(res.ok, false);
  assert.match(res.error, /leave has already been recorded/i);
});

test("inactive teacher cannot record leave", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "leave", teacherId: "T002" });
  assert.equal(res.ok, false);
  assert.match(res.error, /inactive/i);
});

test("today reports server time and attendance window", () => {
  const open = fresh({ nowIso: "2026-10-21T09:00:00+05:30" });
  const openRes = call(open, { action: "today", teacherId: "T001" });
  assert.equal(openRes.attendanceOpen, true);
  assert.equal(openRes.serverTime, "09:00:00");
  assert.equal(openRes.date, "2026-10-21");
  assert.equal(openRes.arrivalTime, null);
  assert.equal(openRes.departureTime, null);

  const closed = fresh({ nowIso: "2026-10-21T16:00:00+05:30" });
  assert.equal(call(closed, { action: "today", teacherId: "T001" }).attendanceOpen, false);
});

test("today reports leave state and blocks further attendance", () => {
  const ctx = fresh();
  call(ctx, { action: "leave", teacherId: "T001" });
  const res = call(ctx, { action: "today", teacherId: "T001" });
  assert.equal(res.leave, true);
  assert.equal(res.marked, false);
});

test("today matches an existing row whose date cell is a Date object", () => {
  const ctx = fresh({
    attendance: [
      ATTENDANCE_HEADER.slice(),
      ["T001", "Dr Asha Sharma", new Date("2026-10-21T00:00:00+05:30"), "09:10:00", "", 32.7, 75.3, "", "", "On time", ""]
    ]
  });
  const res = call(ctx, { action: "today", teacherId: "T001" });
  assert.equal(res.marked, true);
  assert.equal(res.arrivalTime, "09:10:00");
  assert.equal(res.departureTime, null);
});

test("departure can be marked when the existing row date cell is a Date object", () => {
  const ctx = fresh({
    nowIso: "2026-10-21T10:00:00+05:30",
    attendance: [
      ATTENDANCE_HEADER.slice(),
      ["T001", "Dr Asha Sharma", new Date("2026-10-21T00:00:00+05:30"), "09:10:00", "", 32.7, 75.3, "", "", "On time", ""]
    ]
  });
  const dep = call(ctx, { action: "mark", teacherId: "T001", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(dep.ok, true);
  assert.equal(ctx._sheets.Attendance.data[1][4], "10:00:00");
});

test("report action is not supported", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "report", month: 10, year: 2026 });
  assert.equal(res.ok, false);
  assert.match(res.error, /unknown action/i);
});

test("doGet reports service health", () => {
  const ctx = fresh();
  const out = ctx.doGet();
  assert.equal(JSON.parse(out.getContent()).ok, true);
});
