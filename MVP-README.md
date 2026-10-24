# RGMCE Teacher Attendance — Simple MVP

A tiny attendance app for Rajiv Gandhi Memorial College of Education, Kathua.

- **Frontend:** plain HTML/CSS/JavaScript, hosted free on GitHub Pages (`docs/` folder)
- **Backend:** one Google Apps Script file (`apps-script/Code.gs`)
- **Storage:** one private Google Spreadsheet
- **Cost:** free tier only

Only `docs/` and `apps-script/` are needed for the live application.

## What it does

1. Teacher opens the app and enters their Teacher ID once.
2. Backend checks the ID against the private Teachers sheet and returns the name.
3. Teacher confirms the name. The ID is saved in the phone browser and is never
   shown on screen again.
4. Three clear actions: **Check In**, **Check Out** and **Mark Leave**.
   A compact **Attendance Status** card and a line under it explain the current
   state and the next permitted action.
5. Tapping Check In or Check Out asks for one GPS reading, checks it is within
   the college radius (default 200 m), then sends the request. Leave needs no
   location.
6. All three actions ask for confirmation before saving. While a request is
   running, the buttons are disabled so a double tap cannot submit twice.
7. Apps Script writes the row in Google Sheets with a server-generated time
   (Asia/Kolkata). Duplicate check-in/check-out/leave, check-out-before-check-in,
   leave-after-attendance, attendance-after-leave, out-of-hours marking and
   inactive teachers are all rejected on the server.

## Rules enforced on the server

| Rule | Behaviour |
|---|---|
| Opening hours | The college opens at 8:00 AM and closes at 3:00 PM IST |
| Check-in / Check-out hours | 08:00–14:59 IST only (server clock, not the phone clock) |
| Leave hours | 08:00–14:59 IST only, same window as check-in and check-out |
| Button states before check-in | Check In and Leave are enabled inside the window, Check Out is disabled |
| Button states after check-in | Check In and Leave are disabled, only Check Out stays enabled |
| Button states after 3 PM | Check In, Check Out and Leave are all disabled; they come back at 8:00 AM the next day |
| Check-in before check-out | Check Out is rejected until check-in exists for that day |
| One action per day | A second check-in, check-out or Leave is rejected with a clear message |
| Leave vs Attendance | Leave is rejected if attendance already exists, and vice versa |
| Attendance status | Check-in shows `Present`; Leave shows `Leave` |
| Automatic leave | Teachers with no check-in and no leave by 3:00 PM are marked `Leave` by the scheduled trigger |
| Teacher ID privacy | Kept internally only; never rendered in the frontend |

The frontend never trusts the phone's clock. It takes the server's clock offset
from the `date` and `serverTime` fields of the `today` response (falling back to
the server's `attendanceOpen` flag), so a wrong phone clock or timezone cannot
enable an action the server would reject. The page keeps that offset and
refreshes it every minute, so the buttons switch themselves off at 3:00 PM and
come back at 8:00 AM the next day even if the page is left open.

The college location comes from the server only. If it cannot be loaded there is
no guessed fallback position: Check In and Check Out stay disabled with a clear
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

One row per teacher per date. Check-in creates the row, check-out updates it.
Raw history is never rewritten.

**Leaves sheet:** `Teacher ID | Teacher Name | Date | Leave Time | Marked At`

**Config sheet:** `Key | Value` with `COLLEGE_LAT`, `COLLEGE_LNG`, `RADIUS_M`,
`MAX_ACCURACY_M`. Edit these values directly in the sheet — no code change
needed. The defaults already point at the college campus.

## Local checks that were run

- `node --check docs/app.js` — pass
- `node --check` on a temporary `.js` copy of `apps-script/Code.gs` — pass
- `npm run test:appscript` — local tests for the backend rules and frontend
  behaviour

The full Apps Script backend still needs a live deployment and a real phone test;
local tests cannot prove the live Google Sheets integration works.

## Not yet tested (needs your Google account / a phone)

- Real Apps Script deployment and web app URL
- Real GPS radius check on an actual Android/iPhone
- End-to-end flow with a real spreadsheet

See `DEPLOYMENT.md` for the setup steps.
