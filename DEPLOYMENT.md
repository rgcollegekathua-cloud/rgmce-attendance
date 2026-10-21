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
4. Wait for it to finish, then open the spreadsheet again. You should see three
   sheets: `Teachers`, `Attendance`, `Config`.
5. In the `Teachers` sheet, replace the sample row with your real staff:
   - `Teacher ID` — e.g. `T001`, `ASHA01` (any code you choose)
   - `Teacher Name` — full name
   - `Active` — `yes` or `no`
6. In the `Config` sheet, set the real college coordinates:
   - Find them on Google Maps: right-click the campus location →
     the first number is latitude, the second is longitude.
   - `LATE_AFTER` — e.g. `10:00` means arrival after 10:00 shows as `Late`.

## Step 4 — Publish the web app

1. In Apps Script, click **Deploy** > **New deployment**.
2. Click the gear icon → choose **Web app**.
3. Description: `v1`. Execute as: **Me**. Who has access: **Anyone**.
4. Click **Deploy** and copy the **Web app URL**
   (`https://script.google.com/macros/s/.../exec`). Keep it safe.

Every time you change `Code.gs` later, you must redeploy
(**Deploy** > **Manage deployments** → edit → **Version: New version** → **Deploy**).

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

## Ongoing tasks (the admin's routine)

- Add/remove staff and flip `Active` to `no` in the `Teachers` sheet.
- Adjust `RADIUS_M`, `LATE_AFTER`, or coordinates in the `Config` sheet any time
  — changes take effect immediately, no redeploy needed.
- To fix a wrong entry, edit the cell in the `Attendance` sheet directly.
