# RGMCE Teacher Attendance System

> **Active application:** The live attendance app is the lightweight MVP in
> `docs/` with the Google Apps Script backend in `apps-script/`. See
> [`MVP-README.md`](MVP-README.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md) for the
> current setup and rules.
>
> The React/Firebase PWA described below is a legacy, separate implementation.
> It is retained for reference and is not used by the `docs/` application.

A PWA for Rajiv Gandhi Memorial College of Education, Kathua (J&K) to manage teacher attendance using QR scanning with server-enforced rules.

## Roles
- Admin: manage teachers, devices, QR token, settings, corrections, audit logs
- Teacher: mark arrival/departure via approved device + college QR

## Tech Stack
- Frontend: React + TypeScript + Vite + Tailwind + PWA
- Backend: Firebase Auth, Firestore, Cloud Functions (Node 20)
- Region: asia-south1

## Quick Start (Local)
1. Install dependencies
```bash
npm install
npm --prefix functions install
```
2. Create `.env` from `.env.example` and fill Firebase web config
3. Build functions
```bash
npm --prefix functions run build
```
4. Run dev server
```bash
npm run dev
```

## Available Scripts
- `npm run dev` - Vite dev
- `npm run build` - TypeScript build + Vite build
- `npm run lint` - ESLint (zero warnings)
- `npm run typecheck` - Root typecheck
- `npm test` - Frontend tests (vitest; no test files are currently present)
- `npm --prefix functions test` - Functions tests (no test files are currently present)
- `npm run test:rules` - Firestore rules test script
- `npm run test:appscript` - Local tests for the active MVP backend and frontend

## Firebase Configuration Required
Create a Firebase project with:
- Authentication (Email/Password)
- Firestore
- Cloud Functions (enabled)
- Hosting (optional for deployment)

Add web app config to `.env` (see `.env.example`).

## First Admin Setup (Secure)
**Do not** hardcode admin credentials. Recommended secure approach:
1. Create the first user in Firebase Authentication (console or Admin SDK) with email/password.
2. In Firestore, create document `users/{uid}` with:
```json
{
  "uid": "<uid>",
  "teacherId": "ADMIN001",
  "name": "Administrator",
  "role": "admin",
  "active": true,
  "email": "<email>",
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}
```
3. Sign in via the app - only this user can access admin features.

Ensure no unauthenticated/bootstrap endpoint exists in code. Repeated bootstrap must not be possible after first admin exists.

## Deployment
```bash
npm run build
firebase deploy --only hosting,functions,firestore:rules
```

## Mobile Installation
- Android (Chrome): Menu > Install app / Add to Home screen
- iOS (Safari): Share > Add to Home Screen

## Security Notes
- All sensitive operations enforced by Cloud Functions
- Teachers cannot modify/delete attendance directly
- Device approval required; admin can revoke
- QR token validated server-side
- Timestamps from server (Asia/Kolkata)
- Corrections require reason and create audit trail
