// Bump this version and update these notes for every published development release.
// Shared by the page and service worker so the offline cache has the same version.
globalThis.DAYMARK_RELEASE = Object.freeze({
  version: '0.1.0-dev.49',
  date: '2026-10-31',
  changes: [
    'Prevent mouse-wheel momentum from skipping weeks.'
  ]
});
