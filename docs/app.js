"use strict";

/* ============================================================
 * RGMCE Teacher Attendance - frontend
 * After deploying the Apps Script backend, paste its Web App URL
 * into ENDPOINT below, then reload this page.
 * ============================================================ */

var CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbzm799e-F02_iS1dKRB54tygo93G58Qmcjb8SZXkM_Pdpdbo_2Hfvmsrs1FisodaRJH/exec",
  FALLBACK_COLLEGE_LAT: 32.404675579556205,
  FALLBACK_COLLEGE_LNG: 75.50894736551503,
  FALLBACK_RADIUS_M: 100,
  GPS_TIMEOUT_MS: 20000,
  GPS_HIGH_ACCURACY: true,
  STORAGE_KEY: "rgmce_teacher_id"
};

var state = {
  teacher: null,
  pendingTeacher: null,
  serverConfig: null,
  busy: false
};

function $(id) {
  return document.getElementById(id);
}

function showView(id) {
  ["view-loading", "view-id", "view-confirm", "view-home", "view-error"].forEach(function (v) {
    $(v).classList.toggle("hidden", v !== id);
  });
}

var messageTimer = null;

function showMessage(text, kind) {
  var el = $("message");
  el.textContent = text;
  el.className = "message " + (kind || "info");
  el.classList.remove("hidden");
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(function () {
    el.classList.add("hidden");
  }, 4500);
}

function setBusy(busy) {
  state.busy = busy;
  $("btn-arrival").disabled = busy;
  $("btn-departure").disabled = busy;
  $("btn-arrival").textContent = busy ? "WORKING..." : "MARK ARRIVAL";
  $("btn-departure").textContent = busy ? "WORKING..." : "MARK DEPARTURE";
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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

function callBackend(payload) {
  if (!CONFIG.ENDPOINT) {
    return Promise.reject(new Error("App is not configured yet. The owner must add the Apps Script URL in app.js."));
  }
  return fetch(CONFIG.ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then(function (res) {
    if (!res.ok) throw new Error("Server error (HTTP " + res.status + ").");
    return res.json();
  }).then(function (data) {
    if (!data || data.ok !== true) {
      throw new Error(data && data.error ? data.error : "Unexpected server response.");
    }
    return data;
  });
}

function loadServerConfig() {
  if (state.serverConfig) return Promise.resolve(state.serverConfig);
  return callBackend({ action: "config" }).then(function (data) {
    state.serverConfig = {
      lat: Number(data.collegeLat),
      lng: Number(data.collegeLng),
      radiusM: Number(data.radiusM),
      lateAfter: String(data.lateAfter || ""),
      maxAccuracyM: Number(data.maxAccuracyM) || 150
    };
    if (isNaN(state.serverConfig.lat) || isNaN(state.serverConfig.lng)) {
      throw new Error("College coordinates are not configured on the server.");
    }
    return state.serverConfig;
  }).catch(function () {
    state.serverConfig = {
      lat: CONFIG.FALLBACK_COLLEGE_LAT,
      lng: CONFIG.FALLBACK_COLLEGE_LNG,
      radiusM: CONFIG.FALLBACK_RADIUS_M,
      lateAfter: "",
      maxAccuracyM: 150
    };
    return state.serverConfig;
  });
}

function identify(teacherId) {
  return callBackend({ action: "identify", teacherId: teacherId }).then(function (data) {
    return { teacherId: data.teacherId, name: data.name };
  });
}

function loadToday() {
  return callBackend({ action: "today", teacherId: state.teacher.teacherId }).then(function (data) {
    renderToday(data);
  });
}

function renderToday(data) {
  var statusValue = $("status-value");
  statusValue.className = "status-value";

  if (!data.marked) {
    statusValue.textContent = "Not marked yet";
    $("arrival-time").textContent = "—";
    $("departure-time").textContent = "—";
    $("hours-worked").textContent = "—";
    return;
  }

  $("arrival-time").textContent = data.arrivalTime || "—";
  $("departure-time").textContent = data.departureTime || "—";
  $("hours-worked").textContent = data.hoursWorked != null ? data.hoursWorked + " h" : "—";

  if (data.departureTime) {
    statusValue.textContent = "Completed (" + data.status + ")";
    statusValue.classList.add("done");
  } else if (data.status === "Late") {
    statusValue.textContent = "Late";
    statusValue.classList.add("late");
  } else {
    statusValue.textContent = "On time";
    statusValue.classList.add("on-time");
  }
}

function renderHome() {
  $("home-name").textContent = state.teacher.name;
  $("home-id").textContent = "ID: " + state.teacher.teacherId;
  $("home-date").textContent = prettyDate();
  showView("view-home");
  loadToday().catch(function (err) {
    showMessage(err.message, "error");
  });
}

function getPosition() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error("This phone does not support location services."));
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
        var msg = "Could not get your location.";
        if (err.code === 1) msg = "Location permission was denied. Please allow location access.";
        else if (err.code === 2) msg = "Location is unavailable right now.";
        else if (err.code === 3) msg = "Location request timed out. Try again outdoors.";
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
  if (coords.accuracy > cfg.maxAccuracyM) {
    throw new Error(
      "Your GPS reading is too imprecise (" + Math.round(coords.accuracy) +
      " m). Move away from buildings or go outdoors and try again."
    );
  }
  var d = distanceMetres(coords.lat, coords.lng, cfg.lat, cfg.lng);
  if (d > cfg.radiusM) {
    throw new Error(
      "You are about " + Math.round(d) + " m from the college. " +
      "Attendance can only be marked within " + cfg.radiusM + " m of the campus."
    );
  }
  return d;
}

function markAttendance(type) {
  if (state.busy || !state.teacher) return;
  setBusy(true);
  showMessage("Getting your location...", "info");

  loadServerConfig()
    .then(getPosition)
    .then(function (coords) {
      checkLocation(coords);
      return callBackend({
        action: "mark",
        teacherId: state.teacher.teacherId,
        type: type,
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy
      });
    })
    .then(function (data) {
      var label = type === "arrival" ? "Arrival" : "Departure";
      showMessage(label + " recorded at " + data.time + ".", "success");
      return loadToday();
    })
    .catch(function (err) {
      showMessage(err.message, "error");
      return null;
    })
    .then(function () {
      setBusy(false);
    });
}

function enterTeacher(teacher, persist) {
  state.teacher = teacher;
  state.pendingTeacher = null;
  if (persist) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, teacher.teacherId);
    } catch (e) { /* storage may be blocked */ }
  }
  renderHome();
}

function resetToIdEntry() {
  state.teacher = null;
  state.pendingTeacher = null;
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  } catch (e) { /* ignore */ }
  $("teacher-id-input").value = "";
  showView("view-id");
}

function showFatal(err) {
  $("error-text").textContent = err.message || String(err);
  showView("view-error");
}

function init() {
  $("id-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var raw = $("teacher-id-input").value.trim().toUpperCase();
    if (!raw) return;
    $("id-submit").disabled = true;
    identify(raw)
      .then(function (teacher) {
        state.pendingTeacher = teacher;
        $("confirm-name").textContent = teacher.name;
        $("confirm-id").textContent = "Teacher ID: " + teacher.teacherId;
        showView("view-confirm");
      })
      .catch(function (err) {
        showMessage(err.message, "error");
      })
      .then(function () {
        $("id-submit").disabled = false;
      });
  });

  $("confirm-yes").addEventListener("click", function () {
    if (state.pendingTeacher) enterTeacher(state.pendingTeacher, true);
  });

  $("confirm-no").addEventListener("click", function () {
    state.pendingTeacher = null;
    $("teacher-id-input").value = "";
    showView("view-id");
  });

  $("btn-arrival").addEventListener("click", function () { markAttendance("arrival"); });
  $("btn-departure").addEventListener("click", function () { markAttendance("departure"); });

  $("btn-change").addEventListener("click", function () {
    if (confirm("Forget this Teacher ID on this phone?")) resetToIdEntry();
  });

  $("btn-retry").addEventListener("click", function () { boot(); });

  boot();
}

function boot() {
  showView("view-loading");
  $("loading-text").textContent = "Loading…";

  if (!CONFIG.ENDPOINT) {
    showFatal(new Error(
      "This app is not connected yet. The owner must paste the Google Apps Script Web App URL into the ENDPOINT setting in app.js."
    ));
    return;
  }

  var saved = null;
  try {
    saved = localStorage.getItem(CONFIG.STORAGE_KEY);
  } catch (e) { /* ignore */ }

  if (!saved) {
    showView("view-id");
    return;
  }

  $("loading-text").textContent = "Checking your saved Teacher ID…";
  identify(saved)
    .then(function (teacher) {
      enterTeacher(teacher, false);
    })
    .catch(function (err) {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      } catch (e) { /* ignore */ }
      showView("view-id");
      showMessage("Saved Teacher ID was not accepted: " + err.message, "error");
    });
}

document.addEventListener("DOMContentLoaded", init);
