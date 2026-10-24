# RGMCE Teacher Attendance System

Teacher attendance app for Rajiv Gandhi Memorial College of Education, Kathua (J&K).

- **Frontend:** plain HTML/CSS/JavaScript in `docs/`, hosted on GitHub Pages
- **Backend:** Google Apps Script in `apps-script/Code.gs`
- **Storage:** a private Google Spreadsheet
- **Cost:** free tier only

## Documentation

- [`MVP-README.md`](MVP-README.md) - what the app does and the rules it enforces
- [`DEPLOYMENT.md`](DEPLOYMENT.md) - step-by-step deployment guide

## Project layout

| Path | Purpose |
|---|---|
| `docs/` | The app page served by GitHub Pages (HTML, CSS, JS, logo) |
| `apps-script/Code.gs` | The whole backend - paste into Google Apps Script |
| `apps-script/test/` | Local tests for backend rules and frontend behaviour |
| `package.json` | Test script only |

## Tests

```bash
npm run test:appscript
```
