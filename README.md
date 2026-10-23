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

- Chinese, English, Russian, and French interface choices, remembered per browser, with localized dates and GanZhi pronunciation in day details
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

Use **Settings → Sync & backups → Notes & backups** to export a versioned JSON file or import one. Imports validate all records before writing, preview the count and conflicts, and default to keeping existing notes. Choosing replacement affects conflicting dates only. Unsaved drafts must be saved before an import. Export files contain your note text; keep them somewhere appropriate.

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
- Sign-in tokens are remembered in this browser (passwords are not stored). Reloading or reopening renews and verifies the session online before opening account notes. Offline startup keeps the remembered session for retry when connectivity returns or the page reloads; it does not open an unverified cached account. Offline editing still works within an already signed-in page. Explicit sign-out removes this browser’s saved session and account cache, without signing out other devices. Sign out on shared devices.
- A Web Lock permits only one tab per account in the same browser profile, preventing competing local writers and cache removal races. Current browsers with Web Locks support are required for cloud accounts. Other accounts can use separate tabs.
- Account caches are separated for ordinary app use, but browser storage is not encrypted or protected from someone with access to the browser's developer tools. Cloud notes are not end-to-end encrypted. JSON backups contain plain text.
- Dates remain Gregorian date keys without timezone conversion. Changing device timezone does not move a saved note.

Browser integration test with a mocked Supabase API (does not validate deployed SQL policies):

```sh
PLAYWRIGHT_PATH=/path/to/playwright node tests/account-sync.cjs
```

Covers two-account separation, two-device synchronization, legacy notes, sign-out cache removal, tab locking, offline queuing, conflict resolution, and deletion propagation. Live database and real iPhone checks remain necessary before release.

## Languages

Use the language selector at the top of the app: **中文 / English / Русский / Français**. First use follows the browser's preferred supported language; later visits remember your choice in this browser. Changes apply without reloading or signing out. Notes, drafts, backup data, and Gregorian date keys retain their original contents.

Chinese retains traditional lunar labels. English, Russian, and French use numeric lunar months/days and explicitly identify leap months. GanZhi characters remain the reference notation, with pinyin in English and French day details and Cyrillic pronunciation in Russian. Solar-term explanations and estimate labels are translated. The calendar calculations and Sunday-first week layout are unchanged.

See [language implementation notes](docs/languages.md). Validate with:

```sh
node tests/translation-catalog.cjs
PLAYWRIGHT_PATH=/path/to/playwright node tests/languages.cjs
TEST_ENGINE=webkit PLAYWRIGHT_PATH=/path/to/playwright node tests/languages.cjs
```

## Development versions and updates

Settings → App shows the current development version (the first numbered release was `0.1.0-dev.1`). **What’s new** opens translated release notes; a **New** badge remains until those notes are opened in this browser. **Check for updates** checks for a new offline app bundle. A downloaded update shows **Refresh to update**. Refresh is explicit and blocked while notes have drafts, pending account changes, unresolved conflicts, or active storage/sync operations. Only the requesting tab reloads; other tabs keep their drafts and sessions. After refresh, remembered account sessions are restored online.

For every publication, increment `version` in [release.js](release.js), update its date and changes, and add Chinese/Russian/French translations for new release-note messages. The service worker imports that same metadata to name its offline cache, so version and cache identity share one source. `daymark.seenRelease` stores the version whose notes were read on this device. If browser storage is unavailable, read status lasts only for the current page.

Run `tests/updates.cjs` with Playwright (Chrome or `TEST_ENGINE=webkit`) to verify an actual waiting-worker update, release-note tracking, draft protection, note/date preservation, other-tab protection, and offline messages. A browser may update on its own after all app tabs close; the explicit refresh protection applies to the app's update button. Existing older tabs need one online reload to acquire this update UI.

## Calendar and Settings navigation

The main screen starts with a calendar icon, language selector, and Settings gear, followed by the Calendar heading, compact sync status, month navigation, and month grid. Date searches and month/year jumps sit below the grid. The visible Language label is removed; its screen-reader label is retained.

Settings (`#settings`) is a separate view within the same document, so navigation keeps account sessions and note drafts. It groups Account, Sync & backups, Calendar display, and App controls. The display selector and version/update controls live there. Sync errors and downloaded updates link from the calendar directly to `#settings-sync` or `#settings-app`. Signed-out local status links to `#settings-account`. Sign-in errors and sign-up results appear beside the account form.

Use the Back to calendar button or calendar icon to return to the month grid; browser Back can return to an open day. Direct Settings URLs work on static hosting and offline. Validate with `tests/settings.cjs` (Chrome or WebKit), plus the account, language, offline, navigation, and update regression checks.

## Explanatory captions

Regular users see compact calendar and date details. Daily notes follow the Gregorian/lunar date cards. Explanatory captions appear after signing in with the confirmed email `ruixing.shi@yahoo.com`, configured in `sync-config.js`, or with Supabase `app_metadata.role` set to `admin` by an auth administrator. User-editable `user_metadata` does not grant this role. Sign out to hide the captions again. These captions are public interface text, not confidential data; this visibility rule is not a data-access boundary. Essential field labels, storage/sync notices, and solar-term estimate information remain available to everyone.

Signed-in users can change their password in **Settings → Account → Change password**. Press **Change password** to open the normally hidden form. **Hide password form** collapses it and clears the fields. Enter the current password and the new password twice (at least eight characters; the server may enforce a stronger policy). The current password is verified before the authenticated password update. Password fields are cleared after the request, and note drafts remain intact. This setting requires an online connection.

## Manual Shensha matching (starter)

Open **Settings → Shensha matching** (`#settings-shensha`). Check any of the 18 named items, open **Choose targets**, and select one or more values from the searchable 天干、地支、干支组合 groups. Remove selections with their chip’s × button. For example, enable 十恶大败 with targets `庚辰、戊戌`. Choose **Save & calculate**, then open any date. Matches calculate dynamically against year, month, day, and hour pillars according to section 18 of the calculation document.

天德/月德 offer individual stems and branches. 天乙、禄神、文昌、驿马、华盖、将星、金舆、天医、桃花、羊刃、空亡、劫煞 offer branches only. 十恶大败 offers only 甲辰、乙巳、丙申、丁亥、戊戌、己丑、庚辰、辛巳、壬申、癸亥. 阴阳差错 offers only 丙子、丁丑、戊寅、辛卯、壬辰、癸巳、丙午、丁未、戊申、辛酉、壬戌、癸亥, in the 煞 group. 天罗地网 offers only 戌、亥、辰、巳, in the 煞 group; any selected branch matching the date’s 日支 triggers the item. 灾煞 and the custom slots retain all three target groups. 元辰 and 魁罡 have been removed from the checklist and matching. On upgrade, unsupported saved targets are excluded, an item with no remaining targets is disabled, and a review notice is shown; other settings are preserved.

These are user-specified matching targets, not birth-chart inputs or automatic traditional rule lookups. Nothing is enabled by default. 神 matches appear green and 煞 red, with text labels. If enabled 空亡 matches, all matched items including 空亡 remain listed in gray as inactive, with one explanation. No combined Sha count is displayed. Signed-out selections stay in this browser. Signed-in selections are stored separately per account and sync through Supabase user metadata. Shensha selections are not included in note backups.

Run `tests/shensha.cjs` with the same Playwright setup as other browser tests.

Three unnamed custom target slots (①–③) are also available. Select stems, branches, or full pillars from the same picker. Enabled custom target chips and their matching values in date details appear in bold. Custom matches use a neutral color, carry no invented Shen/Sha name, and become inactive gray when Kongwang matches. Existing saved settings retain their original rules; custom slots start disabled.

### Remembered sessions and multiple devices

The same account may sign in on different devices or browser profiles simultaneously. The Web Lock only prevents competing tabs in one browser profile; it is not a device limit. A rejected second tab does not revoke the active tab’s session. Password sign-in and refreshed tokens are persisted after the account store opens successfully. Permanent refresh rejection clears the saved session; transient network errors retain it for an online retry/reload (automatic on the browser online event if there are no local drafts). Browser storage restrictions may make a session temporary.

If real devices still displace one another, check Supabase **Authentication → Sessions → Single session per user**: it must be disabled. This is a server-side project setting, not a browser-code toggle. Client tests simulate independent device sessions and do not validate that production setting. Run `tests/persistent-session.cjs` for reload/reopen, rotation, two-device coexistence, local sign-out, lock isolation, and error recovery.

### Shensha encounter periods

Below the calendar and day details, **Shensha encounters** lists matching dates using the saved targets. Enter inclusive **Start date** and **End date**, then choose **Show encounters**. Results use calendar-style cards with Gregorian date, weekday, lunar date, year/month/day pillars, and one badge per Shensha (including ongoing year/month encounters). Single matches have no signs; repeated matches show `++`/`--`, `+++`/`---`, etc. Hour details start collapsed. **Close list** hides the results. Longer ranges are paginated in blocks of 31 civil dates using **Earlier dates** / **Later dates**, with the displayed range and matching-date count shown per page. The full 1901–2100 range is supported. Choose a reference date, then **Previous/Next 7 days**, **Previous/Next 10 days**, or **Previous/Next month**. Day ranges exclude the reference date; month ranges cover the entire adjacent Gregorian calendar month. The actual inclusive start/end dates are shown, clipped to the supported 1901–2100 range. The reference starts at today on the calendar or the opened day before the first search. Once a period is selected, the reference remains stable when opening a result.

Click the selected period button again to close its list; click it once more to reopen, or choose a different period to switch lists. Each result opens its date details. Green/red matches, bold custom targets, and the gray Kongwang override work exactly as in single-date matching. Days without matches are omitted; empty results and missing settings are explained. The list recalculates when saved targets or language change; reference-date changes update an active shortcut range. Test with `tests/shensha-periods.cjs`.

### Account synchronization of Shensha preferences

Signed-in **Save & calculate** uploads all selected items, target values, and custom slots as `user_metadata.daymark_shensha = {version:1, encoding:"target-indices-v1", settings:...}` (target values use compact catalog indexes in the cloud, decoded to Chinese characters by the app) through Supabase Auth’s authenticated `/user` API. No new SQL migration is required. Note synchronization keeps its existing database/revision behavior. These preferences do not grant admin privileges; caption authorization still uses server-managed app metadata or the configured confirmed admin email.

After the update, sign in and press **Use local selections** in Shensha matching to copy this browser’s existing local selections into an account with no cloud preferences. Local selections are never automatically assigned to an account. Otherwise choose targets and save. Existing cloud preferences load on sign-in and on the usual focus, online, one-minute, and **Sync now** checks. Account A, Account B, and signed-out selections have separate caches. Sign-out clears the account’s preference cache and restores local selections.

Offline saves are queued per account and resume after connectivity returns or sign-in is restored. Pending preference saves and unsaved picker changes block app-update reloads; sign-out requires saving edits and confirming any pending selection loss. Background pulls preserve unsaved picker changes. Preference saves use **last successful save wins for the entire selection set**: simultaneous saves from different devices do not merge individual checkbox changes. User-metadata updates send only the dedicated preference key and preserve unrelated metadata. This is account configuration, not the revision-conflict system used for daily notes.

Validate with `tests/shensha-sync.cjs`: explicit local import, two-device pulls and saves, custom values, user isolation, offline save/reload/retry, unsaved changes, sign-out, and preservation of unrelated metadata. Browser tests mock Supabase; real signed-in devices still need an end-to-end check. API references: [user management](https://supabase.com/docs/guides/auth/managing-user-data) and [update user metadata](https://supabase.com/docs/reference/javascript/auth-updateuser).

### Shensha names and encounter symbols

Named encounter badges use `+` for 神 and `−` for 煞 in every language, with the full classification retained in accessible labels. English, Russian, and French display explanatory translations followed by the Chinese name, for example **+ Relay Horse（驿马）**; Chinese displays **+ 驿马**. These translations are interface labels rather than claims of universally standardized terminology. Names update in Settings, day details, and encounter lists without altering target selections or cloud data. Inactive matches keep their classification sign but remain gray with an inactive label. Unnamed custom entries keep their bold target values without an assigned positive/negative sign.

### Four encounter pillars (section 18)

All 18 remaining named items and three custom slots apply to year/month/day/hour pillars as assigned in `docs/shensha_calculation.md` §18. Old 元辰/魁罡 selections are ignored; saving settings removes those entries without changing other targets. Date details group matches by pillar. **Local time for hour matching** selects the displayed hour pillar (default 12:00); **Hour encounters** expands matching time slots only for items already encountered in at least two of the year, month, and day pillars. Counts are per item, not per selected target. This also applies to Sha and custom items. 羊刃 is translated as Sheep Blade.

Year/month ranges use the app’s existing approximate solar-term boundaries evaluated at local noon, so their displayed inclusive civil dates agree with the calendar markers. A term arriving after local noon first applies on the following date. Year changes use Beginning of Spring; month changes use the twelve existing jie boundaries. Period lists deduplicate year/month matches by effective interval and list daily/hourly matches under individual dates. Mixed inactive intervals receive a note instead of being marked inactive for their entire span.

Hour branches use local wall-clock intervals from 子 23:00–01:00 through 亥 21:00–23:00. Day-stem/hour-stem lookup follows [HKO tables 3 and 5](https://www.weather.gov.hk/en/gts/time/stemsandbranches.htm). The app retains its civil-midnight day change: 子 is displayed as 00:00–01:00 and 23:00–24:00 within each civil date and uses that date’s day stem. This is a documented product convention rather than a 23:00 day change or true-solar-time birth-chart calculation.

The whole-date 空亡 rule remains in force for encounters. An isolated hour target does not qualify as an encounter: hours are shown only after the same item matches at least two year/month/day pillars.

Run `tests/shensha-repeated-hours.cjs` for the repeated-item threshold and `tests/shensha-pillars.cjs` for the four groups, hour-table fixtures, period intervals, removed-entry migration, inactive handling, and responsive translations.

Encounter signs follow the name (`Relay Horse（驿马）`, repeated `+++` or `---`). Counts represent matching year/month/day pillars, plus the matching hour in hour rows; separate hour intervals are not added together. Four matching pillars receive a strong green (Shen) or red (Sha) highlight. Inactive encounters stay gray.

The main month calendar previews up to two encountered Shensha per date, with repeated signs and an additional-item count. Long preview names truncate to fit the seven-column mobile calendar; full names are included in accessible labels and date details. Previews include ongoing year/month matches and obey the inactive Void rule. They update after saved or synced selection changes. Run `tests/shensha-calendar.cjs` for this display.
