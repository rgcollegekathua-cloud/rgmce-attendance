# RGMCE Teacher Attendance — Simple MVP

A tiny attendance app for Rajiv Gandhi Memorial College of Education, Kathua.

- **Frontend:** plain HTML/CSS/JavaScript, hosted free on GitHub Pages (`docs/` folder)
- **Backend:** one Google Apps Script file (`apps-script/Code.gs`)
- **Storage:** one private Google Spreadsheet
- **Cost:** free tier only

The older React/Firebase app still exists in `src/`, `functions/` and `dist/`.
Nothing was deleted. The MVP is completely separate and does not use them.

## What it does

1. Teacher opens the app and enters their Teacher ID once.
2. Backend checks the ID against the private Teachers sheet and returns the name.
3. Teacher confirms the name. The ID is saved in the phone browser.
4. Two big buttons: **MARK ARRIVAL** and **MARK DEPARTURE**.
5. Tapping a button asks for one GPS reading, checks it is within the college
   radius (default 100 m), then sends the request.
6. Apps Script writes the row in Google Sheets with a server-generated time
   (Asia/Kolkata). Duplicate arrival/departure, departure-before-arrival and
   inactive teachers are rejected on the server.

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
| `docs/app.js` | Teacher ID flow, GPS check, submit to Apps Script |
| `apps-script/Code.gs` | The whole backend — paste into Google Apps Script |
| `apps-script/test/logic.test.mjs` | Local tests for the backend rules |
| `DEPLOYMENT.md` | Step-by-step setup guide |

## Spreadsheet layout (created automatically by `setup()`)

**Teachers sheet:** `Teacher ID | Teacher Name | Active`

**Attendance sheet:** `Teacher ID | Teacher Name | Date | Arrival Time | Departure Time | Arrival Latitude | Arrival Longitude | Departure Latitude | Departure Longitude | Status | Hours Worked`

One row per teacher per date. Arrival creates the row, departure updates it.

**Config sheet:** `Key | Value` with `COLLEGE_LAT`, `COLLEGE_LNG`, `RADIUS_M`,
`LATE_AFTER`, `MAX_ACCURACY_M`. Edit these values directly in the sheet —
no code change needed. Use placeholder coordinates until you set the real ones.

## Local checks that were run

- `node --check` on `docs/app.js` and `apps-script/Code.gs` — pass
- `node --test apps-script/test/logic.test.mjs` — 14/14 pass (identify rules,
  arrival creation, duplicate rejection, late status, hours worked,
  departure-before-arrival, inactive teacher, invalid coordinates, lock release)
- Existing React project checks (`npm run typecheck`, `npm run lint`,
  `npm run build`) still pass — they were not touched.

## Not yet tested (needs your Google account / a phone)

- Real Apps Script deployment and web app URL
- Real GPS radius check on an actual Android/iPhone
- End-to-end flow with a real spreadsheet

See `DEPLOYMENT.md` for the setup steps.
