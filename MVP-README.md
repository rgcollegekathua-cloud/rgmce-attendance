# RGMCE Teacher Attendance — Simple MVP

A tiny attendance app for Rajiv Gandhi Memorial College of Education, Kathua.

- **Frontend:** plain HTML/CSS/JavaScript, hosted free on GitHub Pages (`docs/` folder)
- **Backend:** one Google Apps Script file (`apps-script/Code.gs`)
- **Storage:** one private Google Spreadsheet
- **Cost:** free tier only

The older React/Firebase app still exists in `src/`, `functions/` and `dist/`.
It is retained for reference and is not used or deployed by this MVP. Only
`docs/` and `apps-script/` are needed for the live application.

## What it does

1. Teacher opens the app and enters their Teacher ID once.
2. Backend checks the ID against the private Teachers sheet and returns the name.
3. Teacher confirms the name. The ID is saved in the phone browser and is never
   shown on screen again.
4. Three clear actions: **Mark Arrival**, **Mark Departure** and **Record Leave**.
   A compact **Attendance Status** card and a line under it explain the current
   state and the next permitted action.
5. Tapping Arrival or Departure asks for one GPS reading, checks it is within the
   college radius (default 200 m), then sends the request. Leave needs no location.
6. Departure and Leave ask for confirmation before saving. While a request is
   running, the buttons are disabled and the active action shows a progress label
   so a double tap cannot submit twice.
7. Apps Script writes the row in Google Sheets with a server-generated time
   (Asia/Kolkata). Duplicate arrival/departure/leave, departure-before-arrival,
   leave-after-attendance, attendance-after-leave, out-of-hours marking and
   inactive teachers are all rejected on the server.

## Rules enforced on the server

| Rule | Behaviour |
|---|---|
| Opening hours | The college opens at 8:00 AM and closes at 3:00 PM IST |
| Arrival / Departure hours | 08:00–14:59 IST only (server clock, not the phone clock) |
| Leave hours | 08:00–14:59 IST only, same window as arrival and departure |
| Button states before arrival | Arrival and Leave are enabled inside the window, Departure is disabled |
| Button states after arrival | Arrival and Leave are disabled, only Departure stays enabled |
| Button states after 3 PM | Arrival, Departure and Leave are all disabled; they come back at 8:00 AM the next day |
| Arrival before Departure | Departure is rejected until arrival exists for that day |
| One action per day | A second Arrival, Departure or Leave is rejected with a clear message |
| Leave vs Attendance | Leave is rejected if attendance already exists, and vice versa |
| Late marking | Arrival after `LATE_AFTER` (default `10:00` IST) is recorded as `Late`; at or before it is `On time` |
| Teacher ID privacy | Kept internally only; never rendered in the frontend |

The frontend never trusts the phone's clock. It takes the server's clock offset
from the `date` and `serverTime` fields of the `today` response (falling back to
the server's `attendanceOpen` flag), so a wrong phone clock or timezone cannot
enable an action the server would reject. The page keeps that offset and
refreshes it every minute, so the buttons switch themselves off at 3:00 PM and
come back at 8:00 AM the next day even if the page is left open.

The college location comes from the server only. If it cannot be loaded there is
no guessed fallback position: Arrival and Departure stay disabled with a clear
message and a **Retry location connection** button, while Leave keeps working
because it needs no location.

If today's attendance status cannot be loaded, all actions are paused and a
**Retry status** button appears, so the app never guesses from stale data. The
frontend uses the server's `date`, `serverTime` and `attendanceOpen` fields to
restore the state after a refresh and to switch the buttons off at 3:00 PM even
if the page is left open.

Requests have a 25-second timeout. Network failures, slow responses and invalid
server responses show a short, actionable message instead of a raw browser error.
A successful action is never followed by a duplicate success/error notification;
if the status refresh fails after a successful action, the success is kept and
the status card offers a retry.

## Security limits of this MVP (please read)

- Anyone who guesses a Teacher ID can mark attendance for it. There are no passwords yet.
- The GPS check runs on the phone, so a spoofed location can bypass it. Submitted
  coordinates are stored for the admin to review.
- Do not put real staff data in a public repository. The spreadsheet stays private;
  only the Apps Script web URL is public.

## Files

| File | Purpose |
|---|---|
| `docs/index.html` | The app page (served by GitHub Pages) |
| `docs/styles.css` | Mobile-friendly styling |
| `docs/app.js` | Teacher ID flow, GPS check, action buttons |
| `apps-script/Code.gs` | The whole backend — paste into Google Apps Script |
| `apps-script/test/logic.test.mjs` | Local tests for the backend rules |
| `apps-script/test/frontend.test.mjs` | Local tests for the frontend button states and privacy |
| `DEPLOYMENT.md` | Step-by-step setup guide |

## Spreadsheet layout (created automatically by `setup()`)

**Teachers sheet:** `Teacher ID | Teacher Name | Active`

**Attendance sheet:** `Teacher ID | Teacher Name | Date | Arrival Time | Departure Time | Arrival Latitude | Arrival Longitude | Departure Latitude | Departure Longitude | Status | Hours Worked`

One row per teacher per date. Arrival creates the row, departure updates it.
Raw history is never rewritten.

**Leaves sheet:** `Teacher ID | Teacher Name | Date | Leave Time | Marked At`

**Config sheet:** `Key | Value` with `COLLEGE_LAT`, `COLLEGE_LNG`, `RADIUS_M`,
`LATE_AFTER`, `MAX_ACCURACY_M`. Edit these values directly in the sheet — no code
change needed. The defaults already point at the college campus and set
`LATE_AFTER` to `10:00`.

`LATE_AFTER` accepts a plain `HH:mm` text value, a real Google Sheets time value,
an ISO timestamp, or a number of minutes. The backend reads the cell as it is
displayed, so a time cell that Sheets stored as a date (the `1899-12-30`
sentinel) is still understood. If the value cannot be read, arrivals are treated
as `On time` instead of failing.

## Local checks that were run

- `node --check docs/app.js` — pass
- `node --check` on a temporary `.js` copy of `apps-script/Code.gs` — pass
- `npm run test:appscript` — **61/61 pass** (identify rules, arrival/departure/leave
  creation and duplicates, out-of-hours rejection for all three actions,
  leave/attendance conflicts, late detection at the threshold, Date/ISO/serial
  thresholds, server-time state, Date-object rows, frontend button states,
  status display, next-action guidance, campus-location retry and Teacher ID
  privacy)
- `git diff --check` — clean (Git only reports expected CRLF line-ending warnings)
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run build` — pass; the legacy React/Firebase bundle still emits Vite's
  large-chunk warning, which does not affect the `docs/` MVP
- `npm run test:rules` — exits 0, but only checks that `firebase-tools` is
  available; it does not run Firestore emulator tests
- `npm test` (legacy React project) — **pre-existing failure**: no test files
  found
- `npm run test:functions` — **pre-existing failure**: no test files found

The full Apps Script backend still needs a live deployment and a real phone test;
local tests cannot prove the live Google Sheets integration works.

## Not yet tested (needs your Google account / a phone)

- Real Apps Script deployment and web app URL
- Real GPS radius check on an actual Android/iPhone
- End-to-end flow with a real spreadsheet

See `DEPLOYMENT.md` for the setup steps.
