(() => {
  const $ = s => document.querySelector(s);
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
  const dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open('daymark-notes', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('notes', { keyPath:'date' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Daymark tabs and try again.'));
  });
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
    for (const key of records.keys()) dates.add(key);
    window.dispatchEvent(new Event('daymark:notes'));
  }
  function showNote() {
    if (!current) return;
    const saved = records.get(current);
    $('#daily-note').value = drafts.get(current) ?? saved?.text ?? '';
    $('#daily-note').disabled = false;
    $('#save-note').disabled = busy;
    $('#delete-note').disabled = busy || !saved;
    $('#note-status').textContent = drafts.has(current) ? 'Unsaved changes. Tap Save note to keep them.' : saved ? 'Saved on this device.' : 'No note yet. Saved only on this device.';
  }
  const ready = transaction('readonly', store => store.getAll()).then(all => {
    records = new Map(all.map(record => [record.date, record]));
    refreshDates();
    showNote();
  });
  ready.catch(() => {
    $('#note-status').textContent = 'Notes storage is unavailable. Try a regular browser window and reload.';
    $('#backup-status').textContent = 'Notes storage is unavailable; no notes can be saved or imported.';
  });
  window.addEventListener('daymark:day', event => { current = event.detail; ready.then(showNote).catch(() => {}); });
  $('#daily-note').addEventListener('input', () => {
    if ($('#daily-note').value === (records.get(current)?.text ?? '')) drafts.delete(current);
    else drafts.set(current, $('#daily-note').value);
    $('#note-status').textContent = drafts.has(current) ? 'Unsaved changes. Tap Save note to keep them.' : 'No unsaved changes.';
  });
  window.addEventListener('beforeunload', event => { if (drafts.size) { event.preventDefault(); event.returnValue = ''; } });
  $('#note-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!current || busy) return;
    const key = current;
    const text = $('#daily-note').value;
    if (!text.trim()) { $('#note-status').textContent = 'Write a note, or use Delete note to remove the saved note.'; return; }
    busy = true; $('#save-note').disabled = true;
    try {
      const now = new Date().toISOString();
      const record = { date:key, text, createdAt:records.get(key)?.createdAt || now, updatedAt:now };
      await transaction('readwrite', store => store.put(record));
      records.set(key, record);
      if (drafts.get(key) === text) drafts.delete(key);
      refreshDates();
      if (current === key) $('#note-status').textContent = drafts.has(key) ? 'Saved. New edits are not saved yet.' : 'Saved on this device.';
    } catch { $('#note-status').textContent = 'Could not save. Your draft is still here; export a backup of saved notes and try again.'; }
    finally { busy = false; $('#save-note').disabled = false; $('#delete-note').disabled = !records.has(current); }
  });
  $('#delete-note').addEventListener('click', async () => {
    if (!current || busy || !confirm('Delete this date’s note from this device?')) return;
    const key = current;
    busy = true;
    try {
      await transaction('readwrite', store => store.delete(key));
      records.delete(key); drafts.delete(key); refreshDates();
      if (current === key) { showNote(); $('#note-status').textContent = 'Note deleted.'; }
    } catch { $('#note-status').textContent = 'Could not delete the note. Please try again.'; }
    finally { busy = false; showNote(); }
  });
  $('#export-notes').addEventListener('click', async () => {
    try {
      await ready;
      const data = { app:'daymark', version:1, exportedAt:new Date().toISOString(), notes:[...records.values()].sort((a,b) => a.date.localeCompare(b.date)) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], { type:'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `daymark-notes-${new Date().toISOString().slice(0,10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      $('#backup-status').textContent = `Backup prepared: ${records.size} saved notes. Unsaved drafts are not included.`;
    } catch { $('#backup-status').textContent = 'Could not export notes.'; }
  });
  $('#import-notes').addEventListener('change', async event => {
    pendingImport = null; $('#import-preview').hidden = true;
    try {
      await ready;
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) throw Error('Backup must be smaller than 10 MB.');
      const data = JSON.parse(await file.text());
      if (data.app !== 'daymark' || data.version !== 1 || !Array.isArray(data.notes)) throw Error('Choose a Daymark version 1 backup.');
      const seen = new Set();
      for (const item of data.notes) {
        if (!item || !validDate(item.date) || seen.has(item.date) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 20000 || !['createdAt','updatedAt'].every(key => typeof item[key] === 'string' && Number.isFinite(Date.parse(item[key])))) throw Error('Backup contains invalid or duplicate notes. Nothing was imported.');
        seen.add(item.date);
      }
      pendingImport = data.notes.map(({date,text,createdAt,updatedAt}) => ({date,text,createdAt,updatedAt}));
      const conflicts = pendingImport.filter(note => records.has(note.date)).length;
      $('#import-summary').textContent = `${pendingImport.length} notes ready to import; ${conflicts} dates already have notes. Review before importing.`;
      $('#import-conflicts').value = 'keep'; $('#import-preview').hidden = false;
      $('#backup-status').textContent = '';
    } catch (error) { $('#backup-status').textContent = error instanceof SyntaxError ? 'Invalid JSON backup. Nothing was imported.' : error.message; }
    finally { event.target.value = ''; }
  });
  $('#cancel-import').addEventListener('click', () => { pendingImport = null; $('#import-preview').hidden = true; });
  $('#confirm-import').addEventListener('click', async () => {
    if (!pendingImport || busy) return;
    if (drafts.size) { $('#backup-status').textContent = 'Save your unsaved notes before importing.'; return; }
    const replace = $('#import-conflicts').value === 'replace';
    const items = pendingImport.filter(note => replace || !records.has(note.date));
    busy = true; $('#confirm-import').disabled = true;
    try {
      await transaction('readwrite', store => { for (const note of items) store.put(note); });
      for (const note of items) records.set(note.date, note);
      pendingImport = null; $('#import-preview').hidden = true;
      refreshDates(); showNote();
      $('#backup-status').textContent = `Imported ${items.length} notes on this device.`;
    } catch { $('#backup-status').textContent = 'Import failed. No changes were committed.'; }
    finally { busy = false; $('#confirm-import').disabled = false; if (current) showNote(); }
  });
})();
