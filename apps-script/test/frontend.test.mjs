import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "..", "docs", "app.js"), "utf8");

function makeElement(id) {
  return {
    id,
    className: "",
    textContent: "",
    disabled: false,
    classList: {
      added: [],
      add(name) { this.added.push(name); },
      remove() {}
    }
  };
}

function makeButtons() {
  return {
    "btn-arrival": { disabled: false, textContent: "" },
    "btn-departure": { disabled: false, textContent: "" },
    "btn-leave": { disabled: false, textContent: "" },
    "status-value": makeElement("status-value"),
    "arrival-time": makeElement("arrival-time"),
    "departure-time": makeElement("departure-time"),
    "hours-worked": makeElement("hours-worked")
  };
}

function loadApp(buttons) {
  const ctx = {
    console: { log() { }, warn() { }, error() { } },
    document: {
      getElementById(id) {
        return buttons[id] || null;
      },
      addEventListener() {}
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: () => Promise.reject(new Error("no network in tests")),
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    confirm: () => true,
    navigator: {},
    Promise,
    Date,
    JSON,
    Number,
    String,
    Math,
    Object,
    Array,
    Error
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

function state(buttons, data, configError) {
  const ctx = loadApp(buttons);
  if (configError) ctx.state.configError = configError;
  ctx.updateActionButtons(data);
  return {
    arrival: buttons["btn-arrival"].disabled,
    departure: buttons["btn-departure"].disabled,
    leave: buttons["btn-leave"].disabled
  };
}

test("departure is enabled after arrival is marked", () => {
  const s = state(makeButtons(), {
    marked: true,
    arrivalTime: "09:10:00",
    departureTime: null,
    leave: false,
    attendanceOpen: true
  });
  assert.equal(s.arrival, true, "arrival must be disabled");
  assert.equal(s.departure, false, "departure must be enabled");
  assert.equal(s.leave, true, "leave must be disabled once attendance exists");
});

test("departure stays disabled after 3 PM even when arrival is marked", () => {
  const s = state(makeButtons(), {
    marked: true,
    arrivalTime: "09:10:00",
    departureTime: null,
    leave: false,
    attendanceOpen: false
  });
  assert.equal(s.arrival, true);
  assert.equal(s.departure, true);
  assert.equal(s.leave, true);
});

test("all actions are disabled once departure is marked", () => {
  const s = state(makeButtons(), {
    marked: true,
    arrivalTime: "09:10:00",
    departureTime: "14:00:00",
    leave: false,
    attendanceOpen: true
  });
  assert.deepEqual(s, { arrival: true, departure: true, leave: true });
});

test("all actions are disabled when leave is recorded", () => {
  const s = state(makeButtons(), {
    marked: false,
    arrivalTime: null,
    departureTime: null,
    leave: true,
    attendanceOpen: true
  });
  assert.deepEqual(s, { arrival: true, departure: true, leave: true });
});

test("before arrival only the arrival button is enabled inside working hours", () => {
  const s = state(makeButtons(), {
    marked: false,
    arrivalTime: null,
    departureTime: null,
    leave: false,
    attendanceOpen: true
  });
  assert.deepEqual(s, { arrival: false, departure: true, leave: false });
});

test("all three actions are disabled outside working hours", () => {
  const s = state(makeButtons(), {
    marked: false,
    arrivalTime: null,
    departureTime: null,
    leave: false,
    attendanceOpen: false
  });
  assert.deepEqual(s, { arrival: true, departure: true, leave: true });
});

test("leave is available before arrival inside working hours", () => {
  const s = state(makeButtons(), {
    marked: false,
    arrivalTime: null,
    departureTime: null,
    leave: false,
    attendanceOpen: true
  });
  assert.deepEqual(s, { arrival: false, departure: true, leave: false });
});

test("leave is disabled after 3 PM even when nothing is marked yet", () => {
  const s = state(makeButtons(), {
    marked: false,
    arrivalTime: null,
    departureTime: null,
    leave: false,
    attendanceOpen: false
  });
  assert.equal(s.leave, true);
});

test("arrival and departure stay disabled when the college location is unknown", () => {
  const s = state(
    makeButtons(),
    {
      marked: true,
      arrivalTime: "09:10:00",
      departureTime: null,
      leave: false,
      attendanceOpen: true
    },
    "Could not load the college location from the server."
  );
  assert.equal(s.arrival, true, "arrival must be disabled without a known location");
  assert.equal(s.departure, true, "departure must be disabled without a known location");
  assert.equal(s.leave, true, "leave must be disabled once attendance exists");
});

test("leave still works when the college location is unknown", () => {
  const s = state(
    makeButtons(),
    {
      marked: false,
      arrivalTime: null,
      departureTime: null,
      leave: false,
      attendanceOpen: true
    },
    "Could not load the college location from the server."
  );
  assert.equal(s.arrival, true, "arrival must be disabled without a known location");
  assert.equal(s.departure, true, "departure must be disabled without a known location");
  assert.equal(s.leave, false, "leave does not need a location and stays available");
});

test("the college location is never guessed from hard coded coordinates", () => {
  const source = fs.readFileSync(path.join(here, "..", "..", "docs", "app.js"), "utf8");
  assert.ok(!/FALLBACK_COLLEGE/.test(source), "no fallback college coordinates are allowed");
  assert.ok(
    !/collegeLat[\s\S]{0,200}FALLBACK/i.test(source),
    "the config response must not be mixed with fallback coordinates"
  );
});

test("a failed config load explains the problem instead of showing a raw network error", async () => {
  const ctx = loadApp(makeButtons());
  await assert.rejects(() => ctx.loadServerConfig(), /college location/i);
  assert.ok(ctx.state.configError, "the original reason must be kept for the admin");
});

test("server attendanceOpen is used instead of the device clock", () => {
  const buttons = makeButtons();
  const ctx = loadApp(buttons);
  ctx.updateActionButtons({
    marked: true,
    arrivalTime: "09:10:00",
    departureTime: null,
    leave: false,
    attendanceOpen: true
  });
  assert.equal(buttons["btn-departure"].disabled, false);
});

test("a late arrival is displayed as Late", () => {
  const buttons = makeButtons();
  const ctx = loadApp(buttons);
  ctx.renderToday({
    arrivalTime: "10:30:00",
    departureTime: null,
    status: "Late",
    hoursWorked: null,
    leave: false
  });
  assert.equal(buttons["status-value"].textContent, "Late");
  assert.ok(buttons["status-value"].classList.added.includes("late"));
});

test("an on-time arrival is displayed as On time", () => {
  const buttons = makeButtons();
  const ctx = loadApp(buttons);
  ctx.renderToday({
    arrivalTime: "09:00:00",
    departureTime: null,
    status: "On time",
    hoursWorked: null,
    leave: false
  });
  assert.equal(buttons["status-value"].textContent, "On time");
  assert.ok(buttons["status-value"].classList.added.includes("on-time"));
});

test("a finished day is displayed as Completed", () => {
  const buttons = makeButtons();
  const ctx = loadApp(buttons);
  ctx.renderToday({
    arrivalTime: "10:30:00",
    departureTime: "14:00:00",
    status: "Late",
    hoursWorked: 3.5,
    leave: false
  });
  assert.equal(buttons["status-value"].textContent, "Completed");
  assert.equal(buttons["hours-worked"].textContent, "3.5 h");
});

test("frontend never renders the teacher id after it is entered", () => {
  const html = fs.readFileSync(path.join(here, "..", "..", "docs", "index.html"), "utf8");
  assert.ok(!/id="confirm-id"/.test(html), "confirmation view must not show a teacher id element");
  assert.ok(!/id="home-id"/.test(html), "home view must not show a teacher id element");
  assert.ok(!/placeholder=/.test(html), "no placeholder teacher id hints");
  assert.ok(!/e\.g\.|example\s*id|T\d{3}/i.test(html), "no example teacher ids in the markup");
});
