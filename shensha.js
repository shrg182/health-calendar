(() => {
  const $ = selector => document.querySelector(selector);
  const {t, setText} = window.DaymarkI18n;
  const key = 'daymark.shensha.v1';
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillars = Array.from({length:60}, (_, i) => stems[i % 10] + branches[i % 12]);
  const items = [
    ['tiande','天德','shen','stem'], ['yuede','月德','shen','stem'],
    ['tianyi','天乙','shen','branch'], ['wenchang','文昌','shen','branch'],
    ['lushen','禄神','shen','branch'], ['yima','驿马','shen','branch'],
    ['yangren','羊刃','sha','branch'], ['jiesha','劫煞','sha','branch'],
    ['zaisha','灾煞','sha','branch'], ['yuanchen','元辰','sha','branch'],
    ['kongwang','空亡','sha','branch'], ['kuigang','魁罡','sha','pillar'],
    ['shie','十恶大败','sha','pillar'],
    ['custom1','①','custom','pillar'], ['custom2','②','custom','pillar'],
    ['custom3','③','custom','pillar']
  ];
  const allowed = [...stems,...branches,...pillars];
  const names = {shen:'Shen · positive', sha:'Sha · negative', custom:'Custom targets'};
  const empty = () => Object.fromEntries(items.map(([id]) => [id,{enabled:false,targets:[]}]));
  function validate(raw) {
    if (!raw || typeof raw !== 'object') throw Error('Invalid matching settings.');
    const result = empty();
    for (const [id] of items) {
      const entry = raw[id];
      if (!entry) continue;
      if (typeof entry.enabled !== 'boolean' || !Array.isArray(entry.targets)
        || entry.targets.length > allowed.length || entry.targets.some(value => !allowed.includes(value))
        || (entry.enabled && !entry.targets.length)) throw Error('Invalid matching settings.');
      result[id] = {enabled:entry.enabled,targets:[...new Set(entry.targets)]};
    }
    return result;
  }
  let settings = empty(), dayPillar = null, loadWarning = false;
  try { const saved = localStorage.getItem(key); if (saved) settings = validate(JSON.parse(saved)); }
  catch { loadWarning = true; }
  // All values are manually chosen daily matching targets, not birth-chart anchors.
  function matches(pillar) {
    return items.filter(([id]) => {
      const rule = settings[id];
      return rule.enabled && rule.targets.some(value => [pillar[0],pillar[1],pillar].includes(value));
    });
  }
  function render() {
    if (!dayPillar) return;
    const selected = items.some(([id]) => settings[id].enabled);
    $('#shensha-detail').hidden = !selected;
    const found = matches(dayPillar), inactive = found.some(([id]) => id === 'kongwang');
    $('#shensha-matches').replaceChildren();
    for (const [id,label,kind] of found) {
      const badge = document.createElement('span');
      badge.className = `shensha-badge ${inactive ? 'inactive' : kind}${kind === 'custom' ? ' important' : ''}`;
      badge.dataset.shensha = id;
      const rule = settings[id];
      const value = rule.targets.filter(value => [dayPillar[0],dayPillar[1],dayPillar].includes(value)).join('、');
      badge.textContent = `${kind === 'custom' ? value : label + ' · ' + t(names[kind])}${inactive ? ' · ' + t('Inactive') : ''}`;
      $('#shensha-matches').append(badge);
    }
    $('#shensha-empty').hidden = Boolean(found.length);
    $('#shensha-inactive').hidden = !inactive;
  }
  const pickers = new Map();
  for (const kind of ['shen','sha','custom']) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    setText(legend,names[kind]); group.append(legend);
    for (const [id,label,itemKind] of items.filter(item => item[2] === kind)) {
      const row = document.createElement('div'); row.className = 'shensha-row';
      const checkLabel = document.createElement('label');
      const check = document.createElement('input'); check.type = 'checkbox'; check.id = `shensha-${id}`;
      check.checked = settings[id].enabled; checkLabel.append(check,document.createTextNode(` ${label}`));
      if (kind === 'custom') row.classList.toggle('important',check.checked);
      const picker = document.createElement('div'); picker.className = 'shensha-picker';
      const selected = new Set(settings[id].targets);
      const chips = document.createElement('div'); chips.className = 'shensha-chips';
      const details = document.createElement('details'); details.id = `shensha-picker-${id}`;
      const summary = document.createElement('summary'); setText(summary,'Choose targets');
      summary.setAttribute('aria-label',label + ' · ' + t('Matching targets'));
      details.append(summary);
      const panel = document.createElement('div'); panel.className = 'shensha-options';
      const searchLabel = document.createElement('label');
      searchLabel.htmlFor = `shensha-search-${id}`; setText(searchLabel,'Search targets');
      const search = document.createElement('input'); search.type = 'search'; search.id = searchLabel.htmlFor;
      search.autocomplete = 'off'; search.spellcheck = false;
      panel.append(searchLabel,search);
      const optionChecks = new Map();
      function updateChips() {
        chips.replaceChildren();
        for (const value of selected) {
          const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'shensha-chip';
          chip.textContent = value + ' ×'; chip.disabled = !check.checked;
          chip.setAttribute('aria-label',t('Remove {value}',{value}));
          chip.addEventListener('click',()=>{selected.delete(value);optionChecks.get(value).checked=false;updateChips();summary.focus();});
          chips.append(chip);
        }
      }
      for (const [title,values] of [['Heavenly Stems',stems],['Earthly Branches',branches],['Stem-branch pairs',pillars]]) {
        const section = document.createElement('fieldset');
        const heading = document.createElement('legend');setText(heading,title);section.append(heading);
        const options = document.createElement('div'); options.className = 'shensha-option-grid';
        for (const value of values) {
          const optionLabel = document.createElement('label');optionLabel.dataset.value = value;
          const option = document.createElement('input');option.type='checkbox';option.value=value;
          option.checked=selected.has(value);option.disabled=!check.checked;
          option.addEventListener('change',()=>{if(option.checked)selected.add(value);else selected.delete(value);updateChips();});
          optionChecks.set(value,option);optionLabel.append(option,document.createTextNode(value));options.append(optionLabel);
        }
        section.append(options);panel.append(section);
      }
      search.addEventListener('input',()=>{
        const query=search.value.trim();
        panel.querySelectorAll('[data-value]').forEach(option=>{option.hidden=!option.dataset.value.includes(query);});
        panel.querySelectorAll('fieldset').forEach(section=>{section.hidden=![...section.querySelectorAll('[data-value]')].some(option=>!option.hidden);});
      });
      function updateEnabled() {
        search.disabled=!check.checked;
        summary.setAttribute('aria-disabled',String(!check.checked));
        if(!check.checked)details.open=false;
        optionChecks.forEach(option=>{option.disabled=!check.checked;});
        if(kind==='custom')row.classList.toggle('important',check.checked);
        updateChips();
      }
      summary.addEventListener('click',event=>{if(!check.checked)event.preventDefault();});
      details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;summary.focus();}});
      details.append(panel);picker.append(chips,details);updateEnabled();
      check.addEventListener('change',updateEnabled);
      pickers.set(id,{selected,summary});
      row.append(checkLabel,picker); group.append(row);
    }
    $('#shensha-fields').append(group);
  }
  $('#shensha-form').addEventListener('submit', event => {
    event.preventDefault();
    const draft = empty();
    for (const [id,label] of items) {
      const enabled = $(`#shensha-${id}`).checked;
      const targets = [...pickers.get(id).selected];
      if (enabled && !targets.length) {
        setText('#shensha-status','Choose at least one target for {name}.',{name:label});
        pickers.get(id).summary.focus(); return;
      }
      draft[id] = {enabled,targets:targets.filter(value => allowed.includes(value))};
    }
    settings = validate(draft);
    try { localStorage.setItem(key,JSON.stringify(settings)); setText('#shensha-status','Matching settings saved. Open any date to calculate.'); }
    catch { setText('#shensha-status','Matching settings apply for this session only; browser storage is unavailable.'); }
    render();
  });
  window.addEventListener('daymark:language',render);
  window.DaymarkShensha = {show(pillar) { dayPillar = pillar; render(); }};
  if (loadWarning) setText('#shensha-status','Saved matching settings could not be loaded. Please configure them again.');
})();
