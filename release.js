// Bump this version and update these notes for every published development release.
// Shared by the page and service worker so the offline cache has the same version.
globalThis.DAYMARK_RELEASE = Object.freeze({
  version: '0.1.0-dev.44',
  date: '2026-10-30',
  changes: [
    'Add year, month, and week calendar views.',
    'Use a date-free calendar icon for the installed app.'
  ]
});
