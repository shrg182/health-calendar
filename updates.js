(() => {
  const {t, setText} = window.DaymarkI18n;
  const release = window.DAYMARK_RELEASE;
  const $ = selector => document.querySelector(selector);
  let seen = false;
  try { seen = localStorage.getItem('daymark.seenRelease') === release.version; } catch {}
  $('#app-version').textContent = `v${release.version}`;
  function renderRelease() {
    $('#release-new').hidden = seen;
    $('#release-version').textContent = `v${release.version}`;
    $('#release-date').dateTime = release.date;
    $('#release-date').textContent = new Intl.DateTimeFormat(window.DaymarkI18n.locale, {dateStyle:'long'})
      .format(new Date(`${release.date}T12:00:00`));
    $('#release-changes').replaceChildren(...release.changes.map(key => {
      const item = document.createElement('li'); item.textContent = t(key); return item;
    }));
  }
  $('#whats-new').addEventListener('click', () => {
    $('#release-help').showModal();
    seen = true;
    try { localStorage.setItem('daymark.seenRelease', release.version); } catch {}
    renderRelease();
  });
  window.addEventListener('daymark:language', renderRelease);
  renderRelease();

  let registration = null;
  let activating = false;
  let checking = false;
  let lastCheck = 0;
  function showWaiting() {
    if (!registration?.waiting) return;
    $('#update-notice').hidden = false;
    setText('#update-status', 'An update is ready.');
  }
  function watchWorker() {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showWaiting();
      if (worker.state === 'redundant') setText('#update-status', 'Could not download the update. Try again when online.');
    });
  }
  async function checkUpdate() {
    if (!registration || checking) return;
    if (!navigator.onLine) {
      setText('#update-status', 'Could not check for updates. Connect to the internet and try again.'); return;
    }
    checking = true; lastCheck = Date.now();
    $('#check-updates').disabled = true;
    setText('#update-status', 'Checking for updates…');
    try {
      await registration.update();
      if (registration.waiting) showWaiting();
      else setText('#update-status', registration.installing ? 'Downloading update…' : 'You are using the latest version.');
    } catch { setText('#update-status', 'Could not check for updates. Connect to the internet and try again.'); }
    finally { checking = false; $('#check-updates').disabled = false; }
  }
  const canReload = () => window.DaymarkNotes?.canReload?.() === true;
  $('#apply-update').addEventListener('click', () => {
    if (!canReload()) {
      setText('#update-status', 'Save your drafts and finish syncing or resolving conflicts before updating.'); return;
    }
    if (!registration?.waiting || activating) return;
    activating = true;
    $('#apply-update').disabled = true;
    setText('#update-status', 'Applying update…');
    registration.waiting.postMessage({type:'DAYMARK_ACTIVATE_UPDATE'});
  });
  $('#check-updates').addEventListener('click', checkUpdate);
  if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Other tabs keep their session and drafts; only the requesting tab reloads.
      if (!activating) return;
      activating = false;
      if (canReload()) location.reload();
      else {
        $('#update-notice').hidden = true;
        setText('#update-status', 'Update installed. Save and sync your notes, then reload when ready.');
      }
    });
    navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'}).then(result => {
      registration = result;
      $('#check-updates').disabled = false;
      registration.addEventListener('updatefound', watchWorker);
      watchWorker(); showWaiting();
    }).catch(() => {
      setText('#update-status', 'Update checks are unavailable. Reload while online to get the latest version.');
      setText('#backup-status', 'Offline setup is unavailable. You can still use the calendar online.');
    });
    const checkOnReturn = () => { if (Date.now() - lastCheck > 60000) checkUpdate(); };
    window.addEventListener('online', checkOnReturn);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkOnReturn(); });
  } else setText('#update-status', 'Update checks are unavailable. Reload while online to get the latest version.');
})();
