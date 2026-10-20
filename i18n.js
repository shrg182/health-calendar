(() => {
  const messages = window.DAYMARK_TRANSLATIONS;
  const locales = {en:'en-US', zh:'zh-CN', ru:'ru-RU'};
  const normalize = code => String(code || '').toLowerCase().split(/[-_]/)[0];
  let language = (navigator.languages || [navigator.language]).map(normalize).find(code => locales[code]) || 'en';
  try { const saved = localStorage.getItem('daymark.language'); if (locales[saved]) language = saved; } catch {}
  function t(key, params = {}) {
    const text = language === 'en' ? key : messages[key]?.[language] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name)
      ? String(name === 'error' ? t(String(params[name])) : params[name]) : match);
  }
  const dynamic = new Map();
  function setText(selector, key, params = {}) {
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    dynamic.set(element, {key, params});
    element.textContent = t(key, params);
  }
  // Capture only original interface text, before notes or account content is loaded.
  // Keep text nodes rather than replacing containers, preserving icons and controls.
  const originals = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, key = node.textContent.trim();
    if (!node.parentElement.closest('script, select#language-choice') && messages[key]) {
      originals.push({node,key,before:node.textContent.match(/^\s*/)[0],after:node.textContent.match(/\s*$/)[0]});
    }
  }
  const attributes = [];
  for (const element of document.querySelectorAll('[aria-label], [placeholder], [title]')) {
    for (const name of ['aria-label','placeholder','title']) {
      const key = element.getAttribute(name);
      if (messages[key]) attributes.push({element,name,key});
    }
  }
  function apply() {
    document.documentElement.lang = locales[language];
    document.querySelector('#language-choice').value = language;
    for (const {node,key,before,after} of originals) if (node.isConnected) node.textContent = before + t(key) + after;
    for (const {element,name,key} of attributes) element.setAttribute(name,t(key));
    for (const [element,{key,params}] of dynamic) element.textContent = t(key,params);
  }
  window.DaymarkI18n = {t, setText, get language() {return language;}, get locale() {return locales[language];}};
  document.querySelector('#language-choice').addEventListener('change', event => {
    if (!locales[event.target.value]) return;
    language = event.target.value;
    let warning = '';
    try { localStorage.setItem('daymark.language',language); }
    catch { warning = 'Language changed for this session; your browser could not save the preference.'; }
    apply();
    setText('#language-status',warning);
    window.dispatchEvent(new Event('daymark:language'));
  });
  apply();
})();
