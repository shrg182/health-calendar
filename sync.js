(() => {
  const config = window.DAYMARK_SYNC || {};
  const enabled = Boolean(config.url && config.publishableKey);
  // Email confirmation redirects can include credentials in the fragment.
  // This app uses password sign-in; discard callback credentials immediately.
  const callback = new URLSearchParams(location.hash.slice(1));
  let callbackMessage = '';
  if (['access_token', 'refresh_token', 'error', 'error_code'].some(key => callback.has(key))) {
    callbackMessage = callback.has('error') || callback.has('error_code')
      ? 'The confirmation link could not be completed. Try signing in, or request a new confirmation email.'
      : 'Confirmation link received. Sign in with your email and password to open your notes.';
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  let session = null;
  let refreshing = null;
  let remembered = false;
  const storageKey = `daymark.auth.v1:${config.url || ''}`;
  function savedSession() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey));
      return data && typeof data.refresh_token === 'string' && typeof data.user?.id === 'string' ? data : null;
    } catch { return null; }
  }
  function storeSession(data) {
    if (!data?.access_token || !data.refresh_token || !data.user?.id) throw Error('Invalid account session. Sign in again.');
    session = {...data, expires_at:Math.floor(Date.now()/1000) + data.expires_in};
    if (remembered) persist();
  }
  function persist(replace = false) {
    const saved = savedSession();
    if (!replace && saved && saved.user.id !== session?.user.id) return false;
    try { localStorage.setItem(storageKey,JSON.stringify(session)); return true; }
    catch { return false; }
  }
  function forget() {
    const saved = savedSession();
    if (saved?.user.id === session?.user.id) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }

  async function request(path, body, authenticated = true, method = 'POST') {
    if (authenticated && !session) throw Error('Sign in to synchronize.');
    if (authenticated && Date.now() >= session.expires_at * 1000 - 60000) {
      refreshing ||= request('/auth/v1/token?grant_type=refresh_token', { refresh_token:session.refresh_token }, false)
        .then(storeSession)
        .finally(() => { refreshing = null; });
      await refreshing;
    }
    const response = await fetch(config.url.replace(/\/$/, '') + path, {
      method, headers:{ apikey:config.publishableKey, 'Content-Type':'application/json',
        ...(authenticated ? { Authorization:`Bearer ${session.access_token}` } : {}) },
      body:JSON.stringify(body), signal:AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Error(data.msg || data.message || data.error_description || 'Cloud request failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  window.DaymarkSync = {
    enabled,
    callbackMessage,
    get savedUser() { return savedSession()?.user || null; },
    remember() { remembered = true; return persist(true); },
    async resume(id) {
      const saved = savedSession();
      if (!saved || saved.user.id !== id) throw Error('Sign in to synchronize.');
      session = saved;
      try {
        const data = await request('/auth/v1/token?grant_type=refresh_token', {refresh_token:saved.refresh_token}, false);
        if (data.user?.id !== id) throw Error('Account verification failed. Sign out and sign in again.');
        remembered = true; storeSession(data);
        return data.user;
      } catch (error) {
        if (error.status === 400 || error.status === 401 || error.status === 403) forget();
        session = null; remembered = false; throw error;
      }
    },
    abandon() { session = null; remembered = false; },
    async signIn(email, password) {
      const data = await request('/auth/v1/token?grant_type=password', { email, password }, false);
      storeSession(data);
      return data.user;
    },
    async signUp(email, password) {
      await request('/auth/v1/signup', { email, password }, false);
      return 'Check your email to confirm your account, then sign in. If already registered, sign in.';
    },
    async changePassword(currentPassword, password) {
      if (!session) throw Error('Sign in to synchronize.');
      const id = session.user.id;
      const data = await request('/auth/v1/token?grant_type=password', {
        email:session.user.email, password:currentPassword
      }, false);
      if (data.user.id !== id) throw Error('Account verification failed. Sign out and sign in again.');
      storeSession(data);
      await request('/auth/v1/user', {password, current_password:currentPassword}, true, 'PUT');
    },
    async signOut() {
      try { await request('/auth/v1/logout?scope=local', {}); } finally { forget(); session = null; remembered = false; }
    },
    read:() => request('/rest/v1/rpc/read_daily_notes', {}),
    write:note => request('/rest/v1/rpc/sync_daily_note', {
      p_date:note.date, p_text:note.text, p_deleted:Boolean(note.deleted), p_revision:note.revision || 0
    })
  };
})();
