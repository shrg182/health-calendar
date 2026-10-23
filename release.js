// Bump this version and update these notes for every published development release.
// Shared by the page and service worker so the offline cache has the same version.
globalThis.DAYMARK_RELEASE = Object.freeze({
  version: '0.1.0-dev.32',
  date: '2026-10-23',
  changes: [
    'Remove the date-heading outline after opening or reloading a day.'
  ]
});
