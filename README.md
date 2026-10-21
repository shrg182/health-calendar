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

- Chinese, English, and Russian interface choices, remembered per browser, with localized dates and GanZhi pronunciation in day details
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

Ship JSON export and validated JSON import with a preview and conflict choices alongside note entry. Include a readable Markdown export if useful. Explain that browser data can be cleared and does not synchronize between devices. Local storage is not encryption; avoid describing it as a secure vault. Optional account-based synchronization is now implemented; see the setup below.

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

Chinese lunar formatting depends on browser `Intl` support. Dates use the device’s local timezone. Cloud synchronization is optional and requires the Supabase setup below. Without configuration, daily notes stay local. The app captures “today” on load; reload after midnight to refresh it.

## Mobile design priority

Phones, especially iPhones, are the primary target. Mobile controls have at least 44px height, form inputs use 16px text, and the layout respects screen safe areas. Month cells show Gregorian and lunar dates; traditional markers remain available in day details. Pinch zoom remains enabled. Validate on real iPhone Safari before release; desktop browser emulation cannot reproduce native date pickers, keyboard behavior, or all Safari behavior.

## GitHub Pages

The `.github/workflows/pages.yml` workflow publishes the calendar and install/offline assets on pushes to `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the source. The reference prototype and test files are kept in the repository but excluded from the deployed site.

## Daily notes and installation

Open any date to write, save, edit, or delete its note. A dot marks dates with a saved note. Notes are plain text, limited to 20,000 characters, and saved in this device/browser’s IndexedDB. They are never sent to GitHub. When signed in, account notes are sent to the configured Supabase project. Storage failures are shown without claiming a successful save.

Use **Notes & backups** to export a versioned JSON file or import one. Imports validate all records before writing, preview the count and conflicts, and default to keeping existing notes. Choosing replacement affects conflicting dates only. Unsaved drafts must be saved before an import. Export files contain your note text; keep them somewhere appropriate.

**Install app** opens the browser install prompt when available. On iPhone it explains Safari’s Share → Add to Home Screen flow (keep Open as Web App enabled if shown). See [Apple’s instructions](https://support.apple.com/en-eg/guide/iphone/iphea86e5236/ios) and [MDN’s install prompt documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt). Export before moving to an installed app or another browser, and import if the notes are absent there.

A relative-path manifest supports GitHub Pages hosting. A service worker caches the app shell for offline use after a successful online load. Notes are kept separately from that cache. First use requires a connection; offline storage is not a backup. Real iPhone installation and native picker behavior still require device testing.

Additional integration test (serve the project on localhost:8769):

```sh
PLAYWRIGHT_PATH=/path/to/playwright node tests/notes-install.cjs
```

## Multiple users and cloud sync

The app supports optional Supabase email/password accounts. Each account has private daily notes, enforced by database ownership rules, and its own IndexedDB database. The public calendar needs no account. Local mode is a shared browser notebook, not a private account: anyone using that browser profile can see its local notes.

### Enable synchronization

1. Create a Supabase project and run [supabase/schema.sql](supabase/schema.sql) in its SQL editor. This is an initial migration; run it once on a fresh project.
2. Enable email/password authentication and email confirmation. Configure your production Site URL, allowed confirmation redirects, and mail delivery in Supabase. After confirmation, users return to the app and sign in with their password. Tokens from email links are not consumed by the app.
3. Set the project URL and **publishable key** (or legacy `anon` key) in [sync-config.js](sync-config.js). These are public browser settings. Never use a service-role or secret key. Use a separate project for testing.
4. Deploy the updated static files. GitHub Pages packaging and the offline cache include the new scripts.
5. Run [supabase/verify.sql](supabase/verify.sql) against a test project to check account isolation and revision behavior, then verify with two real accounts and devices. The SQL script rolls back its fixtures.

The Daymark project URL and public publishable key are configured in this repository. The database schema is installed. A rollback-only live database test passed on October 20, 2026: owner isolation, rejected direct writes, revision conflicts, deletion conflicts, and denied anonymous access. Existing-account synchronization between browsers was also confirmed by the user. Real phone testing remains outstanding. Official references: [password authentication](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [database functions](https://supabase.com/docs/guides/database/functions).

### Saving, conflicts, and account changes

- Saving commits to IndexedDB first. Sync runs after saves/imports/deletions, when connectivity returns, when the window gains focus, every minute, and through **Sync now**. The app must be open; it does not run background sync after closing.
- The server assigns revisions and timestamps. Writes compare the last known revision atomically. Conflicts retain the local and cloud versions for review; neither is silently overwritten. A lost response may produce a reviewable conflict on retry.
- Deletions remain as cloud tombstones, so an offline device cannot silently resurrect a note.
- Existing local notes are never automatically assigned or uploaded. Export them in local mode, sign in to the intended account, and import after reviewing conflicts.
- Unsaved drafts block account changes. Signing out clears that account's cached notes and in-memory credentials. Pending changes must be synced or backed up; discarding them requires explicit confirmation. Signing out affects this session, not other devices.
- Credentials are held in memory only. Reloading or reopening requires online sign-in again; offline editing works within an already signed-in page. Saved pending changes survive reload in the account-specific cache and resume after signing in again. Closing a tab does not erase its account cache; sign out on shared devices.
- A Web Lock permits only one tab per account in the same browser profile, preventing competing local writers and cache removal races. Current browsers with Web Locks support are required for cloud accounts. Other accounts can use separate tabs.
- Account caches are separated for ordinary app use, but browser storage is not encrypted or protected from someone with access to the browser's developer tools. Cloud notes are not end-to-end encrypted. JSON backups contain plain text.
- Dates remain Gregorian date keys without timezone conversion. Changing device timezone does not move a saved note.

Browser integration test with a mocked Supabase API (does not validate deployed SQL policies):

```sh
PLAYWRIGHT_PATH=/path/to/playwright node tests/account-sync.cjs
```

Covers two-account separation, two-device synchronization, legacy notes, sign-out cache removal, tab locking, offline queuing, conflict resolution, and deletion propagation. Live database and real iPhone checks remain necessary before release.

## Languages

Use the language selector at the top of the app: **中文 / English / Русский**. First use follows the browser's preferred supported language; later visits remember your choice in this browser. Changes apply without reloading or signing out. Notes, drafts, backup data, and Gregorian date keys retain their original contents.

Chinese retains traditional lunar labels. English and Russian use numeric lunar months/days and explicitly identify leap months. GanZhi characters remain the reference notation, with pinyin in English day details and Cyrillic pronunciation in Russian. Solar-term explanations and estimate labels are translated. The calendar calculations and Sunday-first week layout are unchanged.

See [language implementation notes](docs/languages.md). Validate with:

```sh
node tests/translation-catalog.cjs
PLAYWRIGHT_PATH=/path/to/playwright node tests/languages.cjs
TEST_ENGINE=webkit PLAYWRIGHT_PATH=/path/to/playwright node tests/languages.cjs
```

## Development versions and updates

The header shows the current development version (starting with `0.1.0-dev.1`). **What’s new** opens translated release notes; a **New** badge remains until those notes are opened in this browser. **Check for updates** checks for a new offline app bundle. A downloaded update shows **Refresh to update**. Refresh is explicit and blocked while notes have drafts, pending account changes, unresolved conflicts, or active storage/sync operations. Only the requesting tab reloads; other tabs keep their drafts and sessions. After refresh, account users sign in again.

For every publication, increment `version` in [release.js](release.js), update its date and changes, and add Chinese/Russian translations for new release-note messages. The service worker imports that same metadata to name its offline cache, so version and cache identity share one source. `daymark.seenRelease` stores the version whose notes were read on this device. If browser storage is unavailable, read status lasts only for the current page.

Run `tests/updates.cjs` with Playwright (Chrome or `TEST_ENGINE=webkit`) to verify an actual waiting-worker update, release-note tracking, draft protection, note/date preservation, other-tab protection, and offline messages. A browser may update on its own after all app tabs close; the explicit refresh protection applies to the app's update button. Existing older tabs need one online reload to acquire this update UI.
