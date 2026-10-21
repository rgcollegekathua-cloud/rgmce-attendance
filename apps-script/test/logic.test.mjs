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
  throw new Error("Unsupported format in mock: " + fmt);
}

class MockSheet {
  constructor(name, data) {
    this.name = name;
    this.data = data.map((r) => r.slice());
  }
  getLastRow() { return this.data.length; }
  getRange(row, col, numRows, numCols) {
    const h = numRows == null ? 1 : numRows;
    const w = numCols == null ? 1 : numCols;
    const sheet = this;
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
      },
      setValues(vals) {
        vals.forEach((r, i) => {
          r.forEach((v, j) => {
            if (!sheet.data[row - 1 + i]) sheet.data[row - 1 + i] = [];
            sheet.data[row - 1 + i][col - 1 + j] = v;
          });
        });
      }
    };
  }
  appendRow(row) { this.data.push(row.slice()); }
}

function makeContext({ nowIso, teachers, attendance, config }) {
  const now = new Date(nowIso);
  const sheets = {
    Teachers: new MockSheet("Teachers", teachers),
    Attendance: new MockSheet("Attendance", attendance),
    Config: new MockSheet("Config", config)
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
        getUrl: () => "https://example.invalid/sheet"
      })
    },
    LockService: { getScriptLock: () => lock },
    Utilities: { formatDate: formatDateMock },
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
  ["LATE_AFTER", "10:00"],
  ["MAX_ACCURACY_M", 150]
];

function fresh(overrides = {}) {
  return makeContext({
    nowIso: overrides.nowIso || "2026-10-21T08:59:30+05:30",
    teachers: overrides.teachers || TEACHERS,
    attendance: overrides.attendance || [ATTENDANCE_HEADER.slice()],
    config: overrides.config || CONFIG_SHEET
  });
}

test("config endpoint returns college settings", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "config" });
  assert.equal(res.ok, true);
  assert.equal(res.collegeLat, 32.7);
  assert.equal(res.radiusM, 100);
  assert.equal(res.lateAfter, "10:00");
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

test("late arrival after LATE_AFTER is marked Late", () => {
  const ctx = fresh({ nowIso: "2026-10-21T10:15:00+05:30" });
  const res = call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  assert.equal(res.ok, true);
  assert.equal(ctx._sheets.Attendance.data[1][9], "Late");
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
  const ctx = fresh({ nowIso: "2026-10-21T16:30:00+05:30" });
  call(ctx, { action: "mark", teacherId: "T001", type: "arrival", lat: 32.7, lng: 75.3 });
  ctx._sheets.Attendance.data[1][3] = "09:00:00";
  const dep = call(ctx, { action: "mark", teacherId: "T001", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(dep.hoursWorked, 7.5);
});

test("departure without arrival is rejected", () => {
  const ctx = fresh();
  const res = call(ctx, { action: "mark", teacherId: "T003", type: "departure", lat: 32.7, lng: 75.3 });
  assert.equal(res.ok, false);
  assert.match(res.error, /arrival has not been marked/i);
});

test("duplicate departure is rejected", () => {
  const ctx = fresh({ nowIso: "2026-10-21T17:00:00+05:30" });
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

test("doGet reports service health", () => {
  const ctx = fresh();
  const out = ctx.doGet();
  assert.equal(JSON.parse(out.getContent()).ok, true);
});
