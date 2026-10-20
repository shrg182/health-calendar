(() => {
  const $ = s => document.querySelector(s);
  const {t, setText} = window.DaymarkI18n;
  const dates = new Set();
  window.DaymarkNotes = { dates };
  const drafts = new Map();
  let current = null;
  let records = new Map();
  let pendingImport = null;
  let busy = false;
  const validDate = key => {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const [y,m,d] = key.split('-').map(Number);
    const date = new Date(y,m-1,d,12);
    return y >= 1901 && y <= 2100 && date.getFullYear() === y && date.getMonth() === m-1 && date.getDate() === d;
  };
  let account = null;
  let syncing = false;
  let switching = false;
  let releaseAccountLock = null;
  const cloud = window.DaymarkSync;
  function openDB(name) { return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('notes', { keyPath:'date' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Daymark tabs and try again.'));
  }); }
  let dbReady = openDB('daymark-notes');
  async function transaction(mode, action) {
    const db = await dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', mode);
      const request = action(tx.objectStore('notes'));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage operation cancelled'));
    });
  }
  function refreshDates() {
    dates.clear();
    for (const [key, note] of records) if (!note.deleted) dates.add(key);
    window.dispatchEvent(new Event('daymark:notes'));
  }
  function showNote() {
    if (!current) return;
    const stored = records.get(current);
    const saved = stored?.deleted ? null : stored;
    $('#daily-note').value = drafts.get(current) ?? saved?.text ?? '';
    $('#daily-note').disabled = switching;
    $('#save-note').disabled = busy || syncing || switching;
    $('#delete-note').disabled = busy || syncing || switching || !saved;
    setText('#note-status', drafts.has(current) ? 'Unsaved changes. Tap Save note to keep them.' : saved ? (account ? (stored.pending ? 'Saved on this device. Waiting to sync.' : 'Synced.') : 'Saved on this device.') : 'No note yet.');
  }
  const ready = transaction('readonly', store => store.getAll()).then(all => {
    records = new Map(all.map(record => [record.date, record]));
    refreshDates();
    showNote();
  });
  ready.catch(() => {
    setText('#note-status', 'Notes storage is unavailable. Try a regular browser window and reload.');
    setText('#backup-status', 'Notes storage is unavailable; no notes can be saved or imported.');
  });
  window.addEventListener('daymark:day', event => { current = event.detail; ready.then(showNote).catch(() => {}); });
  $('#daily-note').addEventListener('input', () => {
    if ($('#daily-note').value === (records.get(current)?.text ?? '')) drafts.delete(current);
    else drafts.set(current, $('#daily-note').value);
    setText('#note-status', drafts.has(current) ? 'Unsaved changes. Tap Save note to keep them.' : 'No unsaved changes.');
  });
  window.addEventListener('beforeunload', event => { if (drafts.size) { event.preventDefault(); event.returnValue = ''; } });
  $('#note-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!current || busy || syncing || switching) return;
    const key = current;
    const text = $('#daily-note').value;
    if (!text.trim()) { setText('#note-status', 'Write a note, or use Delete note to remove the saved note.'); return; }
    busy = true; $('#save-note').disabled = true;
    try {
      const now = new Date().toISOString();
      const record = { ...records.get(key), date:key, text, deleted:false, createdAt:records.get(key)?.createdAt || now, updatedAt:now, ...(account ? {pending:true} : {}) };
      await transaction('readwrite', store => store.put(record));
      records.set(key, record);
      if (drafts.get(key) === text) drafts.delete(key);
      refreshDates();
      if (current === key) setText('#note-status', drafts.has(key) ? 'Saved. New edits are not saved yet.' : (account ? 'Saved on this device. Waiting to sync.' : 'Saved on this device.'));
    } catch { setText('#note-status', 'Could not save. Your draft is still here; export a backup of saved notes and try again.'); }
    finally { busy = false; showNote(); if (account) synchronize(); }
  });
  $('#delete-note').addEventListener('click', async () => {
    if (!current || busy || syncing || switching || !confirm(t(account ? 'Delete this date’s note from your account and synced devices?' : 'Delete this date’s note from this device?'))) return;
    const key = current;
    busy = true;
    try {
      if (account) {
        const note = { ...records.get(key), text:'', deleted:true, pending:true, updatedAt:new Date().toISOString() };
        await transaction('readwrite', store => store.put(note)); records.set(key, note);
      } else { await transaction('readwrite', store => store.delete(key)); records.delete(key); } drafts.delete(key); refreshDates();
      if (current === key) { showNote(); setText('#note-status', 'Note deleted.'); }
    } catch { setText('#note-status', 'Could not delete the note. Please try again.'); }
    finally { busy = false; showNote(); if (account) synchronize(); }
  });
  $('#export-notes').addEventListener('click', async () => {
    if (switching) return;
    try {
      await ready;
      const data = { app:'daymark', version:1, exportedAt:new Date().toISOString(), notes:[...records.values()].filter(note => !note.deleted).map(({date,text,createdAt,updatedAt}) => ({date,text,createdAt,updatedAt})).sort((a,b) => a.date.localeCompare(b.date)) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], { type:'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `daymark-notes-${new Date().toISOString().slice(0,10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setText('#backup-status', 'Backup prepared: {count} saved notes. Unsaved drafts are not included.', {count:data.notes.length});
    } catch { setText('#backup-status', 'Could not export notes.'); }
  });
  $('#import-notes').addEventListener('change', async event => {
    if (switching || busy || syncing) return;
    const importAccount = account;
    pendingImport = null; $('#import-preview').hidden = true;
    try {
      await ready;
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) throw Error('Backup must be smaller than 10 MB.');
      const data = JSON.parse(await file.text());
      if (account !== importAccount || switching) return;
      if (data.app !== 'daymark' || data.version !== 1 || !Array.isArray(data.notes)) throw Error('Choose a Daymark version 1 backup.');
      const seen = new Set();
      for (const item of data.notes) {
        if (!item || !validDate(item.date) || seen.has(item.date) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 20000 || !['createdAt','updatedAt'].every(key => typeof item[key] === 'string' && Number.isFinite(Date.parse(item[key])))) throw Error('Backup contains invalid or duplicate notes. Nothing was imported.');
        seen.add(item.date);
      }
      pendingImport = data.notes.map(({date,text,createdAt,updatedAt}) => ({date,text,createdAt,updatedAt}));
      const conflicts = pendingImport.filter(note => records.has(note.date)).length;
      setText('#import-summary', '{count} notes ready to import; {conflicts} dates already have notes. Review before importing.', {count:pendingImport.length, conflicts});
      $('#import-conflicts').value = 'keep'; $('#import-preview').hidden = false;
      setText('#backup-status', '');
    } catch (error) { setText('#backup-status', error instanceof SyntaxError ? 'Invalid JSON backup. Nothing was imported.' : error.message); }
    finally { event.target.value = ''; }
  });
  $('#cancel-import').addEventListener('click', () => { pendingImport = null; $('#import-preview').hidden = true; });
  $('#confirm-import').addEventListener('click', async () => {
    if (!pendingImport || busy || syncing || switching) return;
    if (drafts.size) { setText('#backup-status', 'Save your unsaved notes before importing.'); return; }
    const replace = $('#import-conflicts').value === 'replace';
    const items = pendingImport.filter(note => replace || !records.has(note.date) || records.get(note.date).deleted)
      .map(note => ({...records.get(note.date), ...note, deleted:false, ...(account ? {pending:true} : {})}));
    busy = true; $('#confirm-import').disabled = true;
    try {
      await transaction('readwrite', store => { for (const note of items) store.put(note); });
      for (const note of items) records.set(note.date, note);
      pendingImport = null; $('#import-preview').hidden = true;
      refreshDates(); showNote();
      setText('#backup-status', 'Imported {count} notes on this device.', {count:items.length});
    } catch { setText('#backup-status', 'Import failed. No changes were committed.'); }
    finally { busy = false; $('#confirm-import').disabled = false; if (current) showNote(); if (account) synchronize(); }
  });
  const status = message => { setText('#sync-status', message); };
  function fromCloud(note) {
    return {date:note.date, text:note.text, deleted:note.deleted, revision:note.revision,
      createdAt:note.created_at, updatedAt:note.updated_at, pending:false};
  }
  function showConflict() {
    const note = [...records.values()].find(n => n.conflict);
    $('#sync-conflict').hidden = !note;
    if (!note) return;
    setText('#conflict-title', 'Conflicting edits · {date}', {date:note.date});
    $('#conflict-local').textContent = note.deleted ? t('(Deleted)') : note.text;
    $('#conflict-cloud').textContent = note.conflict.deleted ? t('(Deleted)') : note.conflict.text;
  }
  async function synchronize() {
    if (!account || syncing || switching || busy) return;
    syncing = true; showNote(); status('Synchronizing…');
    try {
      for (const note of records.values()) {
        if (!note.pending || note.conflict) continue;
        const result = await cloud.write(note);
        const next = result.conflict ? {...note, conflict:fromCloud(result.note)} : fromCloud(result.note);
        await transaction('readwrite', store => store.put(next)); records.set(note.date, next);
      }
      const remote = await cloud.read();
      for (const raw of remote) {
        const note = fromCloud(raw), local = records.get(note.date);
        if (local?.pending || drafts.has(note.date)) continue;
        await transaction('readwrite', store => store.put(note)); records.set(note.date, note);
      }
      status([...records.values()].some(n => n.conflict) ? 'Review conflicting edits below.' : 'Synced.');
    } catch (error) { setText('#sync-status', 'Sync failed. Saved changes remain on this device. {error}', {error:error.message}); }
    finally { syncing = false; refreshDates(); showNote(); showConflict(); }
  }
  for (const [id, localChoice] of [['keep-local', true], ['keep-cloud', false]]) {
    $( `#${id}`).addEventListener('click', async () => {
      if (syncing || switching || busy) return;
      const note = [...records.values()].find(n => n.conflict);
      if (!note) return;
      busy = true;
      try {
        const next = localChoice ? {...note, revision:note.conflict.revision, pending:true} : note.conflict;
        delete next.conflict;
        await transaction('readwrite', store => store.put(next)); records.set(note.date, next);
      } catch { status('Could not save your conflict choice. Try again.'); }
      finally { busy = false; showConflict(); showNote(); }
      synchronize();
    });
  }
  function hidePassword() {
    $('#account-password').type = 'password';
    setText('#toggle-password', 'Show password');
  }
  $('#toggle-password').addEventListener('click', () => {
    const reveal = $('#account-password').type === 'password';
    $('#account-password').type = reveal ? 'text' : 'password';
    setText('#toggle-password', reveal ? 'Hide password' : 'Show password');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hidePassword();
  });
  function accountUI() {
    if (account) setText('#account-label', 'Signed in as {email}', {email:account.email});
    else setText('#account-label', 'Local notes · this browser only');
    $('#account-form').hidden = Boolean(account);
    $('#account-actions').hidden = !account;
    $('#account-password').value = '';
    hidePassword();
  }
  async function switchStore(user) {
    const previous = await dbReady;
    const nextDB = await openDB(user ? `daymark-account-${user.id}` : 'daymark-notes');
    let all;
    try {
      all = await new Promise((resolve, reject) => {
        const tx = nextDB.transaction('notes', 'readonly');
        const request = tx.objectStore('notes').getAll();
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Could not open account notes.'));
      });
    } catch (error) { nextDB.close(); throw error; }
    previous.close();
    dbReady = Promise.resolve(nextDB);
    account = user; drafts.clear(); pendingImport = null;
    $('#import-preview').hidden = true;
    setText('#backup-status', '');
    $('#daily-note').value = '';
    records = new Map(all.map(note => [note.date, note]));
    accountUI(); refreshDates(); showConflict();
  }
  function canSwitch() {
    if (busy || syncing || switching) return false;
    if (drafts.size) { status('Save your unsaved notes before changing accounts.'); return false; }
    return true;
  }
  $('#account-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!canSwitch()) return;
    hidePassword();
    switching = true; showNote();
    try {
      await ready;
      const user = await cloud.signIn($('#account-email').value.trim(), $('#account-password').value);
      if (!navigator.locks) throw Error('This browser does not support safe account storage. Use a current browser.');
      await new Promise((resolve, reject) => {
        navigator.locks.request(`daymark-account-${user.id}`, {ifAvailable:true}, lock => {
          if (!lock) { reject(Error('This account is already open in another tab. Sign out or close that tab first.')); return; }
          return new Promise(release => { releaseAccountLock = release; resolve(); });
        }).catch(reject);
      });
      await switchStore(user);
      status('Account opened. Existing local notes were not uploaded.');
    } catch (error) {
      if (!account) { releaseAccountLock?.(); releaseAccountLock = null; await cloud.signOut().catch(() => {}); }
      status(error.message);
    }
    finally { switching = false; accountUI(); showNote(); }
    synchronize();
  });
  $('#sign-up').addEventListener('click', async () => {
    if (!canSwitch() || !$('#account-form').reportValidity()) return;
    hidePassword();
    switching = true;
    try { status(await cloud.signUp($('#account-email').value.trim(), $('#account-password').value)); }
    catch (error) { status(error.message); }
    finally { switching = false; $('#account-password').value = ''; }
  });
  $('#sign-out').addEventListener('click', async () => {
    if (!canSwitch()) return;
    if ([...records.values()].some(n => n.pending || n.conflict)) {
      status('Sync or export your pending notes first. Signing out removes this account’s cached notes.');
      if (!confirm(t('Unsynced notes will be removed from this device. Continue only if you have exported a backup. Sign out and discard them?'))) return;
    }
    switching = true; showNote();
    try {
      await transaction('readwrite', store => store.clear());
      await cloud.signOut().catch(() => {});
      await switchStore(null);
      releaseAccountLock?.(); releaseAccountLock = null;
      status('Signed out. Account notes were removed from this device.');
    } catch { status('Could not finish signing out. Try again.'); }
    finally { switching = false; showNote(); }
  });
  window.addEventListener('daymark:language', showConflict);
  $('#sync-now').addEventListener('click', synchronize);
  window.addEventListener('online', synchronize);
  window.addEventListener('focus', synchronize);
  setInterval(synchronize, 60000);
  if (!cloud?.enabled) {
    for (const element of $('#account-form').elements) element.disabled = true;
    status('Cloud sync is not configured. Local notes and backups remain available.');
  } else status(cloud.callbackMessage || 'Sign in to access your account notes. On shared devices, local notes are visible to anyone using this browser.');
})();
