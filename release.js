// Bump this version and update these notes for every published development release.
// Shared by the page and service worker so the offline cache has the same version.
globalThis.DAYMARK_RELEASE = Object.freeze({
  version: '0.1.0-dev.5',
  date: '2026-10-22',
  changes: [
    'Remembered sign-in and automatic session renewal across app restarts.',
    'Clearer same-browser tab guidance; independent device sessions stay separate.'
  ]
});
