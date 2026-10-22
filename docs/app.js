"use strict";

/* ============================================================
 * RGMCE Teacher Attendance - frontend
 * After deploying the Apps Script backend, paste its Web App URL
 * into ENDPOINT below, then reload this page.
 * ============================================================ */

var CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbzm799e-F02_iS1dKRB54tygo93G58Qmcjb8SZXkM_Pdpdbo_2Hfvmsrs1FisodaRJH/exec",
  GPS_TIMEOUT_MS: 20000,
  GPS_HIGH_ACCURACY: true,
  STORAGE_KEY: "rgmce_teacher_id",
  // The college opens at 8:00 AM and closes at 3:00 PM IST. Arrival, Departure
  // and Leave are only available inside this window.
  WINDOW_START_MINUTES: 480,
  WINDOW_END_MINUTES: 900,
  REFRESH_MS: 60000
};

var state = {
  teacher: null,
  pendingTeacher: null,
  serverConfig: null,
  configError: null,
  configPromise: null,
  serverOffsetMs: null,
  todayData: null,
  todayDate: null,
  clockTimer: null,
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
  if ($("btn-arrival")) {
    $("btn-arrival").textContent = busy ? "WORKING..." : "MARK ARRIVAL";
  }
  if ($("btn-departure")) {
    $("btn-departure").textContent = busy ? "WORKING..." : "MARK DEPARTURE";
  }
  if ($("btn-leave")) {
    $("btn-leave").textContent = busy ? "WORKING..." : "MARK LEAVE";
  }
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

// The college location and the marking window both come from the server.
// If the configuration cannot be loaded there is no safe fallback: the GPS
// based actions stay disabled so a teacher is never rejected for the wrong
// reason. Leave does not need a location, so it keeps working.
function loadServerConfig() {
  if (state.serverConfig) return Promise.resolve(state.serverConfig);
  if (state.configPromise) return state.configPromise;
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
    state.serverConfig = cfg;
    state.configError = null;
    return cfg;
  }).catch(function (err) {
    state.serverConfig = null;
    state.configError = err.message || String(err);
    if (typeof console !== "undefined" && console.error) {
      console.error("College location could not be loaded:", state.configError);
    }
    throw new Error(
      "Could not load the college location from the server. Check your internet connection, " +
      "and ask the admin if it keeps happening."
    );
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

function loadToday() {
  return callBackend({ action: "today", teacherId: state.teacher.teacherId }).then(function (data) {
    state.todayData = data || {};
    state.todayDate = state.todayData.date || null;
    applyServerClock(state.todayData);
    renderToday(state.todayData);
    updateActionButtons(state.todayData);
  });
}

// The server is the source of truth for the clock. The offset between the
// server time and this device is stored once, so the buttons can switch
// themselves off exactly at 3:00 PM even if the page stays open.
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

// True while the college is open: 8:00 AM to 2:59 PM IST.
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

// Keeps the buttons in step with the clock: they switch off at 3:00 PM and
// come back on at 8:00 AM the next day, and a new day reloads the status.
function startClockWatcher() {
  if (typeof setInterval !== "function") return;
  if (state.clockTimer) clearInterval(state.clockTimer);
  state.clockTimer = setInterval(function () {
    if (!state.teacher) return;
    var offset = state.serverOffsetMs == null ? 0 : state.serverOffsetMs;
    var currentDate = istDateKey(new Date(Date.now() + offset));
    if (state.todayDate && currentDate !== state.todayDate) {
      loadToday().catch(function () { updateActionButtons(state.todayData); });
      return;
    }
    updateActionButtons(state.todayData);
  }, CONFIG.REFRESH_MS);
}

function renderToday(data){
  var statusValue=document.getElementById('status-value');
  statusValue.className='status-value';
  var arrivalEl=document.getElementById('arrival-time');
  var departureEl=document.getElementById('departure-time');
  var hoursEl=document.getElementById('hours-worked');
  if(data.leave){
    statusValue.textContent='Leave';
    statusValue.classList.add('done');
    arrivalEl.textContent='-';
    departureEl.textContent='-';
    hoursEl.textContent='-';
    return;
  }
  if(!data.arrivalTime){
    statusValue.textContent='Not marked yet';
    arrivalEl.textContent='-';
    departureEl.textContent='-';
    hoursEl.textContent='-';
    return;
  }
  arrivalEl.textContent=data.arrivalTime||'-';
  departureEl.textContent=data.departureTime||'-';
  hoursEl.textContent=(data.hoursWorked!=null&&data.hoursWorked!=='')?data.hoursWorked+' h':'-';
  if(data.departureTime){statusValue.textContent='Completed';statusValue.classList.add('done');}
  else{statusValue.textContent='On time';statusValue.classList.add('on-time');}
}


function renderHome() {
  var nameEl = $("home-name");
  if (nameEl) nameEl.textContent = state.teacher.name;
  var dateEl = $("home-date");
  if (dateEl) dateEl.textContent = prettyDate();
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
  if (!cfg) {
    throw new Error(
      "Could not load the college location from the server. Check your internet connection and try again."
    );
  }
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
  if (type === "departure") {
    if (!confirm("Are you sure you want to mark your departure?")) {
      return;
    }
  }
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
      showMessage(label + " recorded at " + (data.time || "") + ".", "success");
      return loadToday();
    })
    .catch(function (err) {
      showMessage(err.message, "error");
      updateActionButtons(state.todayData);
      return null;
    })
    .then(function () {
      setBusy(false);
    });
}

function markLeave() {
  if (state.busy || !state.teacher) return;
  if (!confirm("Are you sure you want to mark leave for today?")) return;
  setBusy(true);
  callBackend({ action: "leave", teacherId: state.teacher.teacherId })
    .then(function (data) {
      showMessage("Leave recorded at " + (data.time || "") + ".", "success");
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
  // Ensure teacherId not displayed anywhere - only internally stored
  renderHome();
  startClockWatcher();
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
  $("btn-departure").addEventListener("click", function () {
    markAttendance("departure");
  });
  var btnLeave = $("btn-leave");
  if (btnLeave) {
    btnLeave.onclick = null;
    btnLeave.addEventListener("click", function () { markLeave(); });
  }

  var btnChange = $("btn-change");
  if (btnChange) {
    btnChange.addEventListener("click", function () {
      if (confirm("Forget this Teacher ID on this phone?")) resetToIdEntry();
    });
  }

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

  // Load the college location up front. If it fails the GPS based buttons
  // stay disabled instead of guessing a position.
  loadServerConfig()
    .catch(function () { /* the reason is kept in state.configError */ })
    .then(function () {
      updateActionButtons(state.todayData);
    });

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

function updateActionButtons(data){
  var btnArr=document.getElementById('btn-arrival');
  var btnDep=document.getElementById('btn-departure');
  var btnLeave=document.getElementById('btn-leave');
  if(!btnArr||!btnDep||!btnLeave)return;
  var d=data||{};
  var open=isAttendanceOpenNow(d);
  var hasArrival=!!(d.arrivalTime&&String(d.arrivalTime).trim());
  var hasDeparture=!!(d.departureTime&&String(d.departureTime).trim());
  // Arrival and Departure need a GPS reading, so they stay off while the
  // college location is unknown. Leave needs neither.
  var locationKnown=!state.configError;
  if(d.leave){btnArr.disabled=true;btnDep.disabled=true;btnLeave.disabled=true;return;}
  if(hasArrival&&hasDeparture){btnArr.disabled=true;btnDep.disabled=true;btnLeave.disabled=true;return;}
  if(hasArrival&&!hasDeparture){btnArr.disabled=true;btnLeave.disabled=true;btnDep.disabled=!open||!locationKnown;return;}
  btnArr.disabled=!open||!locationKnown;btnDep.disabled=true;btnLeave.disabled=!open;
}

function attendanceOpenFallback(){
  var now=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));
  var total=now.getHours()*60+now.getMinutes();
  return total>=CONFIG.WINDOW_START_MINUTES&&total<CONFIG.WINDOW_END_MINUTES;
}
