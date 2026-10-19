# Daymark Calendar

A Gregorian and Chinese lunar calendar, imported from the supplied ChatGPT HTML prototype. The original design and behavior are preserved as the project baseline.

## Run locally

No build step or dependencies are needed. Open `index.html` in a browser, or serve the project:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Project files

- `index.html`: page structure
- `styles.css`: responsive layout and styling
- `app.js`: calendar calculations, navigation, and day details
- `reference/original.html`: unchanged source supplied by the user

## Current features

- Monthly calendar with previous, next, and Today navigation
- Month/year selection and date search (1901–2100)
- Calendar-view preference saved on this browser, with a fallback when storage is unavailable
- Gregorian, Chinese lunar, and combined views
- Day details with shareable hash URLs
- Traditional year, month, and day markers
- Approximate solar-term boundaries
- Responsive layout and keyboard focus styles

## Agreed health scope

Start with daily notes only: one free-text note per Gregorian date, editable and deletable from day details. Show a small indicator on dates with notes. No symptom, sleep, medication, or clinical interpretation fields in the initial scope. Implemented with IndexedDB storage, explicit Save/Delete controls, calendar note indicators, and validated JSON backups. Unsaved drafts survive navigation within the current page; save before closing or reloading.

## Storage and backup recommendation (step 4)

For the first version, store notes locally in IndexedDB under Gregorian `YYYY-MM-DD` keys, with created/updated timestamps and a versioned record schema. Offer explicit Save/Delete controls and visible save confirmation. Use a stable localhost address or hosted origin; opening files directly is unsuitable for dependable record storage.

Ship JSON export and validated JSON import with a preview and conflict choices alongside note entry. Include a readable Markdown export if useful. Explain that browser data can be cleared and does not synchronize between devices. Local storage is not encryption; avoid describing it as a secure vault. Keep cloud synchronization out of the first version, and revisit it if cross-device access becomes a requirement.

## Calendar validation recommendation (step 5)

Use the [Hong Kong Observatory conversion tables](https://www.hko.gov.hk/en/gts/time/conversion.htm) as fixtures for lunar dates and solar-term dates in 1901–2100. Check new years, leap lunar months, month ends, and midnight-adjacent boundaries. HKO notes that some predicted dates near midnight may differ by a day.

Document the timezone convention before comparing results: distinguish the device's civil date from the Chinese calendar reference timezone. Test multiple timezones and daylight-saving transitions. HKO tables can validate lunar dates and solar-term dates, but traditional sexagenary markers need a separately documented reference and boundary convention. The existing year/month markers use solar-term boundaries evaluated at local noon.

Replace approximate solar-term times with a validated calculation or sourced data before claiming precise instants. Keep the current estimate labels until then. If expanding solar terms, include all 24; the current app contains only 12 month boundaries. This is a validation plan, not a claim that the current calculations have been validated.

## Verification

JavaScript syntax: `node --check app.js`.

Browser regression checks (requires Playwright and installed Google Chrome):

```sh
PLAYWRIGHT_PATH=/path/to/playwright node tests/navigation.cjs
```

Covers leap-day navigation, date search and return, saved preference reload, range boundaries, and mobile horizontal overflow.

## Baseline limitations

Chinese lunar formatting depends on browser `Intl` support. Dates use the device’s local timezone. There is no backend, account system, or cloud synchronization. Daily notes are stored locally. The app captures “today” on load; reload after midnight to refresh it.

## Mobile design priority

Phones, especially iPhones, are the primary target. Mobile controls have at least 44px height, form inputs use 16px text, and the layout respects screen safe areas. Month cells show Gregorian and lunar dates; traditional markers remain available in day details. Pinch zoom remains enabled. Validate on real iPhone Safari before release; desktop browser emulation cannot reproduce native date pickers, keyboard behavior, or all Safari behavior.

## GitHub Pages

The `.github/workflows/pages.yml` workflow publishes the calendar and install/offline assets on pushes to `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the source. The reference prototype and test files are kept in the repository but excluded from the deployed site.

## Daily notes and installation

Open any date to write, save, edit, or delete its note. A dot marks dates with a saved note. Notes are plain text, limited to 20,000 characters, and saved in this device/browser’s IndexedDB. They are never sent to GitHub. Storage failures are shown without claiming a successful save.

Use **Notes & backups** to export a versioned JSON file or import one. Imports validate all records before writing, preview the count and conflicts, and default to keeping existing notes. Choosing replacement affects conflicting dates only. Unsaved drafts must be saved before an import. Export files contain your note text; keep them somewhere appropriate.

**Install app** opens the browser install prompt when available. On iPhone it explains Safari’s Share → Add to Home Screen flow (keep Open as Web App enabled if shown). See [Apple’s instructions](https://support.apple.com/en-eg/guide/iphone/iphea86e5236/ios) and [MDN’s install prompt documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt). Export before moving to an installed app or another browser, and import if the notes are absent there.

A relative-path manifest supports GitHub Pages hosting. A service worker caches the app shell for offline use after a successful online load. Notes are kept separately from that cache. First use requires a connection; offline storage is not a backup. Real iPhone installation and native picker behavior still require device testing.

Additional integration test (serve the project on localhost:8769):

```sh
PLAYWRIGHT_PATH=/path/to/playwright node tests/notes-install.cjs
```
