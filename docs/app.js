"use strict";

/* ============================================================
 * RGMCE Teacher Attendance - frontend
 * The Apps Script Web App URL is configured in ENDPOINT below.
 * ============================================================ */

var CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbzm799e-F02_iS1dKRB54tygo93G58Qmcjb8SZXkM_Pdpdbo_2Hfvmsrs1FisodaRJH/exec",
  GPS_TIMEOUT_MS: 20000,
  GPS_HIGH_ACCURACY: true,
  REQUEST_TIMEOUT_MS: 25000,
  STORAGE_KEY: "rgmce_teacher_id",
  // Arrival, Departure and Leave are available from 8:00 AM to 2:59 PM IST.
  WINDOW_START_MINUTES: 480,
  WINDOW_END_MINUTES: 900,
  REFRESH_MS: 60000
};

var LABELS = {
  arrival: "Mark Arrival",
  departure: "Mark Departure",
  leave: "Record Leave"
};

var BUSY_LABELS = {
  arrival: "Marking Arrival\u2026",
  departure: "Marking Departure\u2026",
  leave: "Recording Leave\u2026"
};

var state = {
  teacher: null,
  pendingTeacher: null,
  serverConfig: null,
  configError: null,
  configPromise: null,
  configBusy: false,
  serverOffsetMs: null,
  todayData: null,
  todayDate: null,
  todayError: null,
  statusLoading: false,
  clockTimer: null,
  busy: false
};

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  var el = $(id);
  if (el) el.textContent = text;
}

function setNote(text) {
  var el = $("action-note");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}

function setRetryConfigVisible(visible) {
  var el = $("btn-retry-config");
  if (el) el.classList.toggle("hidden", !visible);
}

function setRetryStatusVisible(visible) {
  var el = $("btn-reload-status");
  if (el) el.classList.toggle("hidden", !visible);
}

function setWindowChip(text, closed) {
  var el = $("window-status");
  if (!el) return;
  el.textContent = text || "";
  el.className = "window-chip" + (closed ? " closed" : "");
}

function setWindowStatus(open) {
  setWindowChip(open ? "Open until 3 PM" : "Closed", !open);
}

function showView(id) {
  ["view-loading", "view-id", "view-confirm", "view-home", "view-error"].forEach(function (v) {
    var el = $(v);
    if (el) el.classList.toggle("hidden", v !== id);
  });
}

var messageTimer = null;

function hideMessage() {
  var el = $("message");
  if (el) el.classList.add("hidden");
}

function showMessage(text, kind) {
  var el = $("message");
  if (!el) return;
  el.textContent = text;
  el.className = "message " + (kind || "info");
  if (el.setAttribute) el.setAttribute("role", kind === "error" ? "alert" : "status");
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(hideMessage, kind === "error" ? 7000 : 4500);
}

function setBusy(busy, action) {
  state.busy = busy;
  ["arrival", "departure", "leave"].forEach(function (key) {
    var btn = $("btn-" + key);
    if (!btn) return;
    if (busy) {
      btn.disabled = true;
      btn.textContent = key === action ? BUSY_LABELS[key] : LABELS[key];
    } else {
      btn.textContent = LABELS[key];
    }
  });
  var change = $("btn-change");
  if (change) change.disabled = busy;
  var retryConfig = $("btn-retry-config");
  if (retryConfig) retryConfig.disabled = busy;
  var retryStatus = $("btn-reload-status");
  if (retryStatus) retryStatus.disabled = busy;
  if (!busy) updateActionButtons(state.todayData);
}

function prettyDate() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateKey(key) {
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(key || ""));
  if (!m) return prettyDate();
  var date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  if (isNaN(date.getTime())) return prettyDate();
  return date.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function networkError(err) {
  if (err && err.name === "AbortError") {
    return new Error("The server took too long to respond. Check your internet connection and try again.");
  }
  return new Error("Unable to reach the attendance server. Check your internet connection and try again.");
}

function callBackend(payload) {
  if (!CONFIG.ENDPOINT) {
    return Promise.reject(new Error("This app is not configured. Please contact the college administrator."));
  }

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = null;
  if (controller && typeof setTimeout === "function") {
    timer = setTimeout(function () {
      try { controller.abort(); } catch (ignore) {}
    }, CONFIG.REQUEST_TIMEOUT_MS);
  }

  var request = fetch(CONFIG.ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal: controller ? controller.signal : undefined
  }).then(function (res) {
    if (!res.ok) {
      throw new Error("The server returned an error (HTTP " + res.status + "). Please try again.");
    }
    return res.json().catch(function () {
      throw new Error("The server returned an unexpected response. Please try again.");
    });
  }, function (err) {
    throw networkError(err);
  }).then(function (data) {
    if (!data || data.ok !== true) {
      var error = new Error(data && data.error ? data.error : "The server returned an unexpected response. Please try again.");
      if (data && data.code) error.code = data.code;
      error.isServerError = true;
      throw error;
    }
    return data;
  });

  if (timer && request && typeof request.finally === "function") {
    return request.finally(function () { clearTimeout(timer); });
  }
  if (timer) {
    request.then(function () { clearTimeout(timer); }, function () { clearTimeout(timer); });
  }
  return request;
}

// The college location comes from the server only. If it cannot be loaded,
// Arrival and Departure stay disabled until the teacher retries; Leave keeps
// working because it does not need a location.
function loadServerConfig() {
  if (state.serverConfig) return Promise.resolve(state.serverConfig);
  if (state.configPromise) return state.configPromise;

  state.configError = null;
  var pending = callBackend({ action: "config" }).then(function (data) {
    var cfg = {
      lat: Number(data.collegeLat),
      lng: Number(data.collegeLng),
      radiusM: Number(data.radiusM),
      maxAccuracyM: Number(data.maxAccuracyM) || 150
    };
    if (isNaN(cfg.lat) || isNaN(cfg.lng)) {
      throw new Error("College coordinates are not configured on the server.");
    }
    if (!(cfg.radiusM > 0) || !(cfg.maxAccuracyM > 0)) {
      throw new Error("The college location settings are incomplete.");
    }
    state.serverConfig = cfg;
    state.configError = null;
    return cfg;
  }).catch(function (err) {
    state.serverConfig = null;
    state.configError = err && err.message ? err.message : String(err);
    if (typeof console !== "undefined" && console.error) {
      console.error("College location could not be loaded:", state.configError);
    }
    throw new Error("Unable to load the college location. Check your internet connection and try again.");
  });

  state.configPromise = pending;
  pending.then(clearConfigPromise, clearConfigPromise);
  return pending;
}

function clearConfigPromise() {
  state.configPromise = null;
}

function identify(teacherId) {
  return callBackend({ action: "identify", teacherId: teacherId }).then(function (data) {
    return { teacherId: data.teacherId, name: data.name };
  });
}

function isCurrentTeacher(teacherId) {
  return !!(state.teacher && state.teacher.teacherId === teacherId);
}

function setStatusValue(text, className) {
  var el = $("status-value");
  if (!el) return;
  el.textContent = text;
  el.className = "status-value";
  if (className) el.classList.add(className);
}

function clearStatusDetails() {
  setText("arrival-time", "\u2014");
  setText("departure-time", "\u2014");
}

function renderStatusLoading() {
  state.statusLoading = true;
  setStatusValue("Loading\u2026", "");
  clearStatusDetails();
  setWindowChip("Checking hours", false);
  setNote("Loading today's attendance status\u2026");
  updateActionButtons(state.todayData);
}

function loadToday() {
  if (!state.teacher) return Promise.reject(new Error("Please enter your Teacher ID."));
  var teacherId = state.teacher.teacherId;

  return callBackend({ action: "today", teacherId: teacherId }).then(function (data) {
    if (!isCurrentTeacher(teacherId)) return null;
    state.statusLoading = false;
    state.todayError = null;
    state.todayData = data || {};
    state.todayDate = state.todayData.date || null;
    applyServerClock(state.todayData);
    renderToday(state.todayData);
    setText("home-date", formatDateKey(state.todayDate));
    updateActionButtons(state.todayData);
    return state.todayData;
  }).catch(function (err) {
    if (!isCurrentTeacher(teacherId)) throw err;
    state.statusLoading = false;
    state.todayError = err && err.message ? err.message : "Unable to load today's attendance status.";
    updateActionButtons(state.todayData);
    throw err;
  });
}

// The server is the source of truth for time. The offset is stored once so the
// buttons can switch off at 3:00 PM even if the page stays open all day.
function applyServerClock(data) {
  var d = data || {};
  if (!d.date || !d.serverTime) return;
  var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(d.serverTime).trim());
  if (!m) return;
  var serverEpoch = Date.parse(
    d.date + "T" + m[1] + ":" + m[2] + ":" + (m[3] || "00") + "+05:30"
  );
  if (isNaN(serverEpoch)) return;
  state.serverOffsetMs = serverEpoch - Date.now();
}

function istMinutesOfDay(date) {
  var shifted = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return shifted.getHours() * 60 + shifted.getMinutes();
}

function istDateKey(date) {
  var shifted = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return shifted.getFullYear() + "-" + pad2(shifted.getMonth() + 1) + "-" + pad2(shifted.getDate());
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function to12Hour(hours, minutes) {
  var period = hours >= 12 ? "PM" : "AM";
  var hour = hours % 12;
  if (hour === 0) hour = 12;
  return pad2(hour) + ":" + minutes + " " + period;
}

// Times come back either as "HH:mm:ss" or as a time-only sheet value
// serialized by the server (for example 1899-12-30T03:59:48.000Z).
// Always show the wall-clock time in IST as HH:MM AM/PM.
function formatTimeValue(value) {
  if (value === null || value === undefined) return "\u2014";
  var raw = String(value).trim();
  if (!raw) return "\u2014";

  var hhmm = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw);
  if (hhmm) return to12Hour(Number(hhmm[1]), hhmm[2]);

  var parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    try {
      var formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      if (typeof formatter.formatToParts === "function") {
        var parts = formatter.formatToParts(parsed);
        var hour = "";
        var minute = "";
        var period = "";
        parts.forEach(function (part) {
          if (part.type === "hour") hour = part.value;
          else if (part.type === "minute") minute = part.value;
          else if (part.type === "dayPeriod") period = part.value.toUpperCase();
        });
        if (hour && minute && period) return hour + ":" + minute + " " + period;
      } else {
        var formatted = formatter.format(parsed).replace(/\s+/g, " ");
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(formatted)) return formatted.toUpperCase();
      }
    } catch (ignore) { /* fall back to UTC components below */ }
    return to12Hour(parsed.getUTCHours(), pad2(parsed.getUTCMinutes()));
  }

  var fallback = /(\d{1,2}):(\d{2})/.exec(raw);
  if (fallback) return to12Hour(Number(fallback[1]), fallback[2]);
  return "\u2014";
}

function isAttendanceOpenNow(data) {
  var now = Date.now();
  if (state.serverOffsetMs != null) now += state.serverOffsetMs;
  var minutes = istMinutesOfDay(new Date(now));
  if (state.serverOffsetMs != null) {
    return minutes >= CONFIG.WINDOW_START_MINUTES && minutes < CONFIG.WINDOW_END_MINUTES;
  }
  var d = data || {};
  if (typeof d.attendanceOpen === "boolean") return d.attendanceOpen;
  return minutes >= CONFIG.WINDOW_START_MINUTES && minutes < CONFIG.WINDOW_END_MINUTES;
}

function startClockWatcher() {
  if (typeof setInterval !== "function") return;
  if (state.clockTimer) clearInterval(state.clockTimer);
  state.clockTimer = setInterval(function () {
    if (!state.teacher) return;
    var offset = state.serverOffsetMs == null ? 0 : state.serverOffsetMs;
    var currentDate = istDateKey(new Date(Date.now() + offset));
    if (state.todayDate && currentDate !== state.todayDate) {
      loadToday().catch(function () { /* the status note and retry button explain the failure */ });
      return;
    }
    updateActionButtons(state.todayData);
  }, CONFIG.REFRESH_MS);
}

function renderToday(data) {
  var d = data || {};
  if (d.leave) {
    setStatusValue("Leave", "done");
    clearStatusDetails();
    return;
  }
  if (!d.arrivalTime) {
    setStatusValue("Not marked", "");
    clearStatusDetails();
    return;
  }
  setText("arrival-time", formatTimeValue(d.arrivalTime));
  setText("departure-time", formatTimeValue(d.departureTime));
  setStatusValue("Present", "on-time");
}

function renderHome() {
  var teacherId = state.teacher.teacherId;
  setText("home-name", state.teacher.name);
  setText("home-date", prettyDate());
  renderStatusLoading();
  showView("view-home");
  loadToday().catch(function (err) {
    if (isCurrentTeacher(teacherId)) showMessage(err.message, "error");
  });
}

function getPosition() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error("Location services are not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 9999
        });
      },
      function (err) {
        var msg = "Unable to verify your location. Please try again.";
        if (err.code === 1) {
          msg = "Unable to verify your location. Please enable location access in your browser settings and try again.";
        } else if (err.code === 2) {
          msg = "Your location is unavailable right now. Move to an open area and try again.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please try again.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: CONFIG.GPS_HIGH_ACCURACY,
        timeout: CONFIG.GPS_TIMEOUT_MS,
        maximumAge: 0
      }
    );
  });
}

function distanceMetres(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = function (d) { return (d * Math.PI) / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkLocation(coords) {
  var cfg = state.serverConfig;
  if (!cfg) {
    throw new Error("Campus location settings are not available. Retry the location connection and try again.");
  }
  if (coords.accuracy > cfg.maxAccuracyM) {
    throw new Error(
      "Your GPS accuracy is too low (" + Math.round(coords.accuracy) +
      " m). Move to an open area and try again."
    );
  }
  var d = distanceMetres(coords.lat, coords.lng, cfg.lat, cfg.lng);
  if (d > cfg.radiusM) {
    throw new Error(
      "You appear to be outside the permitted campus area (about " +
      Math.round(d) + " m from the college)."
    );
  }
  return d;
}

function markAttendance(type) {
  if (state.busy || !state.teacher) return;
  if (type === "departure") {
    if (!confirm("Mark your Departure now? This cannot be undone from this app.")) return;
  }

  var teacherId = state.teacher.teacherId;
  var label = type === "departure" ? "Departure" : "Arrival";
  setBusy(true, type);
  showMessage("Verifying your location\u2026", "info");

  loadServerConfig()
    .then(getPosition)
    .then(function (coords) {
      checkLocation(coords);
      return callBackend({
        action: "mark",
        teacherId: teacherId,
        type: type,
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy
      });
    })
    .then(function (data) {
      var suffix = data && data.time ? " at " + data.time : "";
      showMessage(label + " marked successfully" + suffix + ".", "success");
      return loadToday().catch(function () { /* the status note offers a retry */ });
    })
    .catch(function (err) {
      showMessage(err && err.message ? err.message : "Unable to mark " + label + ". Please try again.", "error");
      updateActionButtons(state.todayData);
      if (err && err.isServerError) {
        loadToday().catch(function () { /* keep the original message visible */ });
      }
    })
    .then(function () {
      setBusy(false);
    });
}

function markLeave() {
  if (state.busy || !state.teacher) return;
  if (!confirm("Record Leave for today? This cannot be undone from this app.")) return;

  var teacherId = state.teacher.teacherId;
  setBusy(true, "leave");
  showMessage("Recording your Leave\u2026", "info");

  callBackend({ action: "leave", teacherId: teacherId })
    .then(function (data) {
      var suffix = data && data.time ? " at " + data.time : "";
      showMessage("Leave recorded successfully" + suffix + ".", "success");
      return loadToday().catch(function () { /* the status note offers a retry */ });
    })
    .catch(function (err) {
      showMessage(err && err.message ? err.message : "Unable to record Leave. Please try again.", "error");
      updateActionButtons(state.todayData);
      if (err && err.isServerError) {
        loadToday().catch(function () { /* keep the original message visible */ });
      }
    })
    .then(function () {
      setBusy(false);
    });
}

function enterTeacher(teacher, persist) {
  state.teacher = teacher;
  state.pendingTeacher = null;
  state.todayData = null;
  state.todayDate = null;
  state.todayError = null;
  state.serverOffsetMs = null;
  if (persist) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, teacher.teacherId);
    } catch (e) { /* storage may be blocked */ }
  }
  renderHome();
  startClockWatcher();
}

function resetToIdEntry() {
  state.teacher = null;
  state.pendingTeacher = null;
  state.todayData = null;
  state.todayDate = null;
  state.todayError = null;
  state.statusLoading = false;
  state.busy = false;
  state.serverOffsetMs = null;
  if (state.clockTimer) {
    clearInterval(state.clockTimer);
    state.clockTimer = null;
  }
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  } catch (e) { /* ignore */ }
  var input = $("teacher-id-input");
  if (input) input.value = "";
  var submit = $("id-submit");
  if (submit) submit.disabled = false;
  showView("view-id");
}

function showFatal(err) {
  state.statusLoading = false;
  setText("error-text", err && err.message ? err.message : String(err));
  showView("view-error");
}

function retryConfig() {
  if (state.busy || state.configBusy) return;
  state.configBusy = true;
  state.serverConfig = null;
  state.configError = null;
  state.configPromise = null;

  var btn = $("btn-retry-config");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Retrying\u2026";
  }
  showMessage("Reconnecting to the attendance server\u2026", "info");

  loadServerConfig().then(function () {
    showMessage("Connection restored. You can mark attendance.", "success");
  }).catch(function (err) {
    showMessage(err.message, "error");
  }).then(function () {
    state.configBusy = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Retry location connection";
    }
    updateActionButtons(state.todayData);
  });
}

function retryStatus() {
  if (state.busy || state.statusLoading || !state.teacher) return;
  var teacherId = state.teacher.teacherId;
  renderStatusLoading();
  loadToday().then(function () {
    if (isCurrentTeacher(teacherId)) showMessage("Attendance status refreshed.", "success");
  }).catch(function (err) {
    if (isCurrentTeacher(teacherId)) showMessage(err.message, "error");
  });
}

function updateActionButtons(data) {
  var btnArr = $("btn-arrival");
  var btnDep = $("btn-departure");
  var btnLeave = $("btn-leave");
  if (!btnArr || !btnDep || !btnLeave) return;

  var d = data || {};
  var open = isAttendanceOpenNow(d);
  var hasArrival = !!(d.arrivalTime && String(d.arrivalTime).trim());
  var hasDeparture = !!(d.departureTime && String(d.departureTime).trim());
  var locationKnown = !state.configError;
  var note = "";
  var showConfigRetry = false;
  var showStatusRetry = false;

  if (state.busy) {
    btnArr.disabled = true;
    btnDep.disabled = true;
    btnLeave.disabled = true;
    setNote("");
    setRetryConfigVisible(false);
    setRetryStatusVisible(false);
    return;
  }

  if (state.statusLoading) {
    btnArr.disabled = true;
    btnDep.disabled = true;
    btnLeave.disabled = true;
    setWindowChip("Checking hours", false);
    setNote("Loading today's attendance status\u2026");
    setRetryConfigVisible(false);
    setRetryStatusVisible(false);
    return;
  }

  if (state.todayError) {
    btnArr.disabled = true;
    btnDep.disabled = true;
    btnLeave.disabled = true;
    setWindowChip("Unavailable", true);
    setNote("Attendance status could not be loaded. Check your connection and try again.");
    setRetryConfigVisible(false);
    setRetryStatusVisible(true);
    return;
  }

  setWindowStatus(open);

  if (d.leave) {
    btnArr.disabled = true;
    btnDep.disabled = true;
    btnLeave.disabled = true;
    note = "Leave has been recorded for today.";
  } else if (hasArrival && hasDeparture) {
    btnArr.disabled = true;
    btnDep.disabled = true;
    btnLeave.disabled = true;
    note = "Attendance for today is complete.";
  } else if (hasArrival) {
    btnArr.disabled = true;
    btnLeave.disabled = true;
    btnDep.disabled = !open || !locationKnown;
    showConfigRetry = !locationKnown && open;
    if (!open) {
      note = "Attendance can be marked between 8:00 AM and 3:00 PM.";
    } else if (!locationKnown) {
      note = "Campus location is unavailable. Retry the connection to mark Departure.";
    } else {
      note = "Mark Departure when you leave the campus.";
    }
  } else {
    btnArr.disabled = !open || !locationKnown;
    btnDep.disabled = true;
    btnLeave.disabled = !open;
    showConfigRetry = !locationKnown && open;
    if (!open) {
      note = "Attendance can be marked between 8:00 AM and 3:00 PM.";
    } else if (!locationKnown) {
      note = "Campus location is unavailable. Retry the connection to mark Arrival. You can still record Leave.";
    } else {
      note = "Mark Arrival to begin. Location access is required.";
    }
  }

  setNote(note);
  setRetryConfigVisible(showConfigRetry);
  setRetryStatusVisible(showStatusRetry);
}

function boot() {
  showView("view-loading");
  setText("loading-text", "Loading attendance\u2026");

  if (!CONFIG.ENDPOINT) {
    showFatal(new Error("This app is not configured. Please contact the college administrator."));
    return;
  }

  loadServerConfig().catch(function () {
    /* The reason is kept in state.configError and explained on the home screen. */
  }).then(function () {
    if (state.teacher) updateActionButtons(state.todayData);
  });

  var saved = null;
  try {
    saved = localStorage.getItem(CONFIG.STORAGE_KEY);
  } catch (e) { /* ignore */ }

  if (!saved) {
    showView("view-id");
    return;
  }

  setText("loading-text", "Checking your saved Teacher ID\u2026");
  identify(saved).then(function (teacher) {
    enterTeacher(teacher, false);
  }).catch(function (err) {
    if (err && (err.code === "TEACHER_NOT_FOUND" || err.code === "TEACHER_INACTIVE")) {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      } catch (e) { /* ignore */ }
      showView("view-id");
      showMessage(err.message, "error");
      return;
    }
    showFatal(new Error("Unable to verify your saved Teacher ID. Check your internet connection and try again."));
  });
}

function init() {
  $("id-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var input = $("teacher-id-input");
    var submit = $("id-submit");
    var raw = input.value.trim().toUpperCase();
    if (!raw) {
      input.focus();
      return;
    }
    if (submit.disabled) return;
    submit.disabled = true;
    state.pendingTeacher = null;
    identify(raw)
      .then(function (teacher) {
        state.pendingTeacher = teacher;
        setText("confirm-name", teacher.name);
        showView("view-confirm");
      })
      .catch(function (err) {
        showMessage(err.message, "error");
      })
      .then(function () {
        submit.disabled = false;
      });
  });

  $("confirm-yes").addEventListener("click", function () {
    if (state.pendingTeacher) enterTeacher(state.pendingTeacher, true);
  });

  $("confirm-no").addEventListener("click", function () {
    state.pendingTeacher = null;
    var input = $("teacher-id-input");
    input.value = "";
    showView("view-id");
    input.focus();
  });

  $("btn-arrival").addEventListener("click", function () { markAttendance("arrival"); });
  $("btn-departure").addEventListener("click", function () { markAttendance("departure"); });
  $("btn-leave").addEventListener("click", function () { markLeave(); });

  $("btn-change").addEventListener("click", function () {
    if (confirm("Remove your Teacher ID from this device? You will need to enter it again next time.")) {
      resetToIdEntry();
    }
  });

  $("btn-retry").addEventListener("click", function () { boot(); });
  $("btn-use-different").addEventListener("click", function () { resetToIdEntry(); });

  var retryConfigBtn = $("btn-retry-config");
  if (retryConfigBtn) retryConfigBtn.addEventListener("click", retryConfig);

  var retryStatusBtn = $("btn-reload-status");
  if (retryStatusBtn) retryStatusBtn.addEventListener("click", retryStatus);

  var message = $("message");
  if (message) message.addEventListener("click", hideMessage);

  boot();
}

document.addEventListener("DOMContentLoaded", init);
