# Deployment Guide — RGMCE Teacher Attendance MVP

Follow these steps in order. No coding is needed. Everything used here is free.

## Updating an existing installation

Always update in this order:

1. **Back up the data.** In Google Sheets, use **File → Make a copy** and keep the
   copy until the update has been tested. Do not edit the live `Attendance` or
   `Leaves` sheets by hand during the update.
2. **Update and verify the backend.** Copy the new `apps-script/Code.gs` into the
   Apps Script editor, then create a new deployment version (Step 4). Test the
   `config`, `identify` and `today` actions with a test Teacher ID.
3. **Publish the frontend last.** Only after the backend is live and verified,
   upload the new `docs/` files to GitHub Pages.

If the frontend is published first, it may call actions or expect response fields
that the old backend does not provide yet.

## Step 1 — Create the spreadsheet

1. Go to <https://sheets.google.com> and sign in with the college Google account
   (use a college account, not a personal one, so it survives staff changes).
2. Create a new spreadsheet. Name it `RGMCE Attendance`.
3. Copy the spreadsheet ID from the address bar:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
4. Keep this tab open. Leave the spreadsheet empty — the script will create the sheets.

## Step 2 — Create the Apps Script backend

1. Go to <https://script.google.com> and sign in with the **same** Google account.
2. Click **New project**. Rename it `RGMCE Attendance Backend`.
3. Delete everything in the code editor.
4. Open `apps-script/Code.gs` from this repository, copy **all** the text, paste it in.
5. Click **Save** (Ctrl+S).

## Step 3 — Connect the spreadsheet

1. In the Apps Script editor, find the function dropdown at the top, choose `setup`.
2. Click **Run**. Google will ask for permission — click **Review permissions**,
   choose your account, then **Advanced** > **Go to project (unsafe)** > **Allow**.
   (The warning appears because the script is your own and unverified — it is safe.)
3. If asked for a value, paste the spreadsheet ID from Step 1.
4. Wait for it to finish, then open the spreadsheet again. You should see four
   sheets: `Teachers`, `Attendance`, `Leaves`, `Config`.
5. In the `Teachers` sheet, replace the sample row with your real staff:
   - `Teacher ID` — e.g. `T001`, `ASHA01` (any code you choose)
   - `Teacher Name` — full name
   - `Active` — `yes` or `no`
6. In the `Config` sheet, check the college coordinates and the late rule:
   - `COLLEGE_LAT` and `COLLEGE_LNG` already point at the campus. Find them on
     Google Maps if you want to correct them: right-click the campus location →
     the first number is latitude, the second is longitude.
   - `RADIUS_M` — how far from the campus centre a teacher may stand (200 m).
   - `MAX_ACCURACY_M` — how precise the phone's GPS must be (250 m).
   - `LATE_AFTER` — arrival after this time is marked `Late` (default `10:00`).
     Type it as `10:00`; Sheets may turn it into a time value, which the backend
     also understands. If the cell ends up holding an odd date (a `1899-12-30`
     value), select it and retype `10:00`.

## Step 4 — Publish the web app

1. In Apps Script, click **Deploy** > **New deployment**.
2. Click the gear icon → choose **Web app**.
3. Description: `v1`. Execute as: **Me**. Who has access: **Anyone**.
4. Click **Deploy** and copy the **Web app URL**
   (`https://script.google.com/macros/s/.../exec`). Keep it safe.

Every time you change `Code.gs` later, you must redeploy
(**Deploy** > **Manage deployments** → edit → **Version: New version** → **Deploy**).
Without this step the live app keeps running the old code, which is why a
backend change is not visible on the phones until the redeploy is done.

**Deploy the backend first, then publish the frontend.** The frontend expects the
`leave` action and the `attendanceOpen` / `serverTime` fields in the `today`
response. If the frontend goes live first, **MARK LEAVE** fails and the buttons
fall back to the phone's clock until the backend catches up.

The new backend also needs the `Leaves` sheet — if it is missing, `setup()` creates
it automatically the next time you run it. Running `setup()` again is safe: it
only adds missing sheets and config rows, and it never touches the `Teachers` or
`Attendance` sheets.

## Step 5 — Connect the frontend

1. Open `docs/app.js` in this repository.
2. Find the `ENDPOINT` setting near the top and make sure it contains your Web
   app URL:
   `ENDPOINT: "https://script.google.com/macros/s/..../exec"`
3. Save the file. This URL is public and is not a secret; the spreadsheet stays
   private.

## Step 6 — Publish on GitHub Pages

1. Create a free GitHub account / repository (e.g. `rgmce-attendance`) and upload
   this project folder. Do **not** upload `node_modules` or the old `dist`/`src`
   Firebase app if you want a small repo — only `docs/` and `apps-script/` are needed.
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Source: **Deploy from a branch**. Branch: `main`, folder: **`/docs`**. Save.
4. Wait 2 minutes. Your app is now at:
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`

   **Important:** the repository must be **public** for free GitHub Pages.
   Nothing secret lives in `docs/` — only the web app URL, which teachers need anyway.

## Step 7 — Test on a real phone

1. Open the GitHub Pages link on a phone.
2. Enter one of the Teacher IDs you created, then confirm the name on the
   identity screen.
3. Stand on campus (or set the Config radius large for a first remote test),
   tap **Mark Arrival**, and allow location access.
4. Check the spreadsheet — a new row should appear with today's date and time.
   The app should show **Arrival marked successfully** and update the
   **Attendance Status** card.
5. Tap **Mark Departure** later and confirm the same row updates. The app asks
   for confirmation first.
6. Tap **Record Leave** on a day you want to record a leave — no location is
   needed, but it also has to be done between 8:00 AM and 3:00 PM and is
   confirmed before it is saved.
7. Refresh the page. The saved Teacher ID should be verified again and today's
   status should come back from the spreadsheet.

The three buttons follow the college hours: before 8:00 AM and after 3:00 PM
all three are switched off, and they come back the next morning. Once the
arrival is marked, only **Mark Departure** stays available. An arrival after
`LATE_AFTER` shows `Late` instead of `On time`. A short note under the status
card explains the next permitted action or why an action is unavailable.

### If something goes wrong on the phone

- **Location permission denied:** allow location access for the site in the
  browser settings, then tap the action again.
- **Outside campus or poor GPS accuracy:** move to an open area on campus and
  try again. The message shows the approximate distance or accuracy.
- **Campus location could not be loaded:** Mark Arrival and Mark Departure stay
  disabled and a **Retry location connection** button appears. Record Leave
  remains available inside college hours.
- **Attendance status could not be loaded:** tap **Retry status**. Do not keep
  tapping the action buttons; the server rejects duplicates in any case.
- **Slow or failed request:** wait for the progress message to clear, check the
  mobile data or Wi-Fi connection, and try once more. Never reload the page
  repeatedly while a request is in progress.

## Ongoing tasks (the admin's routine)

- Add/remove staff and flip `Active` to `no` in the `Teachers` sheet.
- Adjust `RADIUS_M`, `MAX_ACCURACY_M`, `LATE_AFTER`, or the coordinates in the
  `Config` sheet any time — changes take effect immediately, no redeploy needed.
- To fix a wrong entry, edit the cell in the `Attendance` sheet directly.
- A leave can only be recorded between 8:00 AM and 3:00 PM. For a leave that was
  missed, add the row to the `Leaves` sheet by hand:
  `Teacher ID | Teacher Name | Date | Leave Time | Marked At`.
