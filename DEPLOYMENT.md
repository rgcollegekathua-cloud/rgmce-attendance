# Deployment Guide — RGMCE Teacher Attendance MVP

Follow these steps in order. No coding is needed. Everything used here is free.

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
6. In the `Config` sheet, check the college coordinates:
   - `COLLEGE_LAT` and `COLLEGE_LNG` already point at the campus. Find them on
     Google Maps if you want to correct them: right-click the campus location →
     the first number is latitude, the second is longitude.
   - `RADIUS_M` — how far from the campus centre a teacher may stand (200 m).
   - `MAX_ACCURACY_M` — how precise the phone's GPS must be (250 m).
   - There is no late-marking setting. The college opens at 8:00 AM and closes at
     3:00 PM, and every arrival is recorded as `On time`.

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

The new backend also needs the `Leaves` sheet — if it is missing, `setup()` creates
it automatically the next time you run it. Running `setup()` again is safe: it
only adds missing sheets and rows, it never touches the `Teachers` or
`Attendance` sheets, and it removes the old unused `LATE_AFTER` row from
`Config`.

## Step 5 — Connect the frontend

1. Open `docs/app.js` in this repository.
2. Find the line `ENDPOINT: ""` near the top and paste your Web app URL:
   `ENDPOINT: "https://script.google.com/macros/s/..../exec"`
3. Save the file.

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
2. Enter one of the Teacher IDs you created → confirm the name.
3. Stand on campus (or set the Config radius large for a first remote test),
   tap **MARK ARRIVAL**, allow location access.
4. Check the spreadsheet — a new row should appear with today's date and time.
5. Tap **MARK DEPARTURE** later and confirm the same row updates.
6. Tap **MARK LEAVE** on a day you want to record a leave — no location needed,
   but it also has to be done between 8:00 AM and 3:00 PM.

The three buttons follow the college hours: before 8:00 AM and after 3:00 PM
all three are switched off, and they come back the next morning. Once the
arrival is marked, only **MARK DEPARTURE** stays available.

## Ongoing tasks (the admin's routine)

- Add/remove staff and flip `Active` to `no` in the `Teachers` sheet.
- Adjust `RADIUS_M`, `MAX_ACCURACY_M`, or the coordinates in the `Config` sheet
  any time — changes take effect immediately, no redeploy needed.
- To fix a wrong entry, edit the cell in the `Attendance` sheet directly.
- A leave can only be recorded between 8:00 AM and 3:00 PM. For a leave that was
  missed, add the row to the `Leaves` sheet by hand:
  `Teacher ID | Teacher Name | Date | Leave Time | Marked At`.
