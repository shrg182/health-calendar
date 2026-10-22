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
  async function request(path, body, authenticated = true, method = 'POST') {
    if (authenticated && !session) throw Error('Sign in to synchronize.');
    if (authenticated && Date.now() >= session.expires_at * 1000 - 60000) {
      refreshing ||= request('/auth/v1/token?grant_type=refresh_token', { refresh_token:session.refresh_token }, false)
        .then(data => { session = { ...data, expires_at:Math.floor(Date.now()/1000) + data.expires_in }; })
        .finally(() => { refreshing = null; });
      await refreshing;
    }
    const response = await fetch(config.url.replace(/\/$/, '') + path, {
      method, headers:{ apikey:config.publishableKey, 'Content-Type':'application/json',
        ...(authenticated ? { Authorization:`Bearer ${session.access_token}` } : {}) },
      body:JSON.stringify(body), signal:AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.msg || data.message || data.error_description || 'Cloud request failed.');
    return data;
  }
  window.DaymarkSync = {
    enabled,
    callbackMessage,
    async signIn(email, password) {
      const data = await request('/auth/v1/token?grant_type=password', { email, password }, false);
      session = { ...data, expires_at:Math.floor(Date.now()/1000) + data.expires_in };
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
      session = { ...data, expires_at:Math.floor(Date.now()/1000) + data.expires_in };
      await request('/auth/v1/user', {password, current_password:currentPassword}, true, 'PUT');
    },
    async signOut() {
      try { await request('/auth/v1/logout?scope=local', {}); } finally { session = null; }
    },
    read:() => request('/rest/v1/rpc/read_daily_notes', {}),
    write:note => request('/rest/v1/rpc/sync_daily_note', {
      p_date:note.date, p_text:note.text, p_deleted:Boolean(note.deleted), p_revision:note.revision || 0
    })
  };
})();
