(() => {
  const {setText} = window.DaymarkI18n;
  const button = document.querySelector('#install-app');
  let installPrompt = null;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const update = () => { button.hidden = standalone(); };
  update();
  matchMedia('(display-mode: standalone)').addEventListener('change', update);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
  window.addEventListener('appinstalled', () => { installPrompt = null; button.hidden = true; });
  button.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt; installPrompt = null;
      try { await prompt.prompt(); await prompt.userChoice; } catch { showHelp(); }
    } else showHelp();
  });
  function showHelp() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setText('#install-instructions', ios
      ? 'In Safari, open the Share menu (you may need the More button first), choose Add to Home Screen, keep Open as Web App enabled if shown, then tap Add.'
      : 'Open your browser’s menu and choose Install app or Add to Home screen. On desktop Safari, choose File → Add to Dock. If the option is unavailable, try opening this site in Safari or Chrome.');
    document.querySelector('#install-help').showModal();
  }
})();
