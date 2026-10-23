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
    ['huagai','华盖','shen','branch'], ['jiangxing','将星','shen','branch'],
    ['jinyu','金舆','shen','branch'], ['tianyi-medical','天医','shen','branch'],
    ['taohua','桃花','shen','branch'],
    ['yangren','羊刃','sha','branch'], ['jiesha','劫煞','sha','branch'],
    ['zaisha','灾煞','sha','branch'],
    ['kongwang','空亡','sha','branch'],
    ['shie','十恶大败','sha','pillar'], ['yinyang','阴阳差错','sha','pillar'],
    ['tianluodiwang','天罗地网','sha','branch'],
    ['custom1','①','custom','pillar'], ['custom2','②','custom','pillar'],
    ['custom3','③','custom','pillar']
  ];
  // Explanatory localized labels; retain Chinese to distinguish traditional names.
  const itemNames = {
    tiande:'Heavenly Virtue', yuede:'Moon Virtue', tianyi:'Heavenly Mentor',
    wenchang:'Literary Star', lushen:'Emolument God', yima:'Relay Horse',
    huagai:'Splendor Canopy', jiangxing:'General Star', jinyu:'Golden Carriage',
    'tianyi-medical':'Heavenly Doctor', taohua:'Peach Blossom',
    yangren:'Sheep Blade', jiesha:'Robbery Evil', zaisha:'Disaster Evil',
    kongwang:'Empty Void',
    shie:'Ten Defeats', yinyang:'Yin-Yang Mismatch', tianluodiwang:'Heavenly Net'
  };
  function itemName(id,chinese) {
    return window.DaymarkI18n.language === 'zh' || !itemNames[id] ? chinese : `${t(itemNames[id])}（${chinese}）`;
  }
  const allowed = [...stems,...branches,...pillars];
  const branchOnly = new Set(['tianyi','lushen','wenchang','yima','huagai','jiangxing','jinyu','tianyi-medical','taohua','yangren','kongwang','jiesha']);
  const tenDefeats = ['甲辰','乙巳','丙申','丁亥','戊戌','己丑','庚辰','辛巳','壬申','癸亥'];
  const yinYangMismatch = ['丙子','丁丑','戊寅','辛卯','壬辰','癸巳','丙午','丁未','戊申','辛酉','壬戌','癸亥'];
  function groupsFor(id) {
    if (id === 'tianluodiwang') return [['Earthly Branches',['戌','亥','辰','巳']]];
    if (id === 'yinyang') return [['Stem-branch pairs',yinYangMismatch]];
    if (id === 'shie') return [['Stem-branch pairs',tenDefeats]];
    if (branchOnly.has(id)) return [['Earthly Branches',branches]];
    if (id === 'tiande' || id === 'yuede') return [['Heavenly Stems',stems],['Earthly Branches',branches]];
    return [['Heavenly Stems',stems],['Earthly Branches',branches],['Stem-branch pairs',pillars]];
  }
  const allowedFor = id => groupsFor(id).flatMap(([,values])=>values);
  let adjusted = false;
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
      const targets = [...new Set(entry.targets)].filter(value=>allowedFor(id).includes(value));
      if (targets.length !== new Set(entry.targets).size) adjusted = true;
      result[id] = {enabled:entry.enabled && targets.length > 0,targets};
    }
    return result;
  }
  let settings = empty(), loadWarning = false;
  let accountId = null, pending = false, dirty = false, hasCloud = false;
  let syncRunning = false;
  const accountKey = id => `daymark.shensha.account.v1:${id}`;
  $('#shensha-form').inert = Boolean(window.DaymarkSync?.savedUser);
  try { const saved = localStorage.getItem(key); if (saved) settings = validate(JSON.parse(saved)); }
  catch { loadWarning = true; }
  function saveCache() {
    localStorage.setItem(accountId ? accountKey(accountId) : key,
      JSON.stringify(accountId ? {settings,pending,hasCloud} : settings));
  }
  function localSelections() {
    const raw = localStorage.getItem(key);
    return raw ? validate(JSON.parse(raw)) : empty();
  }
  function importVisibility() {
    let available = false;
    try { available = Object.values(localSelections()).some(item=>item.enabled); } catch {}
    $('#shensha-use-local').hidden = !accountId || hasCloud || pending || !available;
    $('#shensha-use-local').disabled = syncRunning || dirty;
  }
  function markDirty() {
    dirty = true;
    importVisibility();
    if(accountId)setText('#shensha-status','Save your changes to sync Shensha selections.');
  }
  function applyWidgets() {
    for(const [id] of items) {
      const picker=pickers.get(id),rule=settings[id];
      picker.selected.clear();rule.targets.forEach(value=>picker.selected.add(value));
      $(`#shensha-${id}`).checked=rule.enabled;
      picker.options.forEach((option,value)=>{option.checked=picker.selected.has(value);});
      picker.updateEnabled();
    }
    render();renderPeriod();importVisibility();
  }
  function setAccount(user) {
    const previous=accountId;
    accountId=user?.id || null;
    dirty=false;pending=false;hasCloud=false;
    $('#shensha-form').inert=false;
    settings=empty();
    try {
      if(accountId) {
        const raw=localStorage.getItem(accountKey(accountId));
        if(raw) {
          const cache=JSON.parse(raw);settings=validate(cache.settings);
          pending=cache.pending===true;hasCloud=cache.hasCloud===true;
        }
      } else {
        if(previous)localStorage.removeItem(accountKey(previous));
        settings=localSelections();
      }
      setText('#shensha-status',accountId ? 'Synchronizing Shensha selections…' : '');
    } catch {setText('#shensha-status','Saved matching settings could not be loaded. Please configure them again.');}
    applyWidgets();
  }
  async function syncSelections() {
    if(!accountId || syncRunning)return;
    const owner=accountId;
    syncRunning=true;importVisibility();
    try {
      // Preference saves use last-successful-save wins, unlike versioned note edits.
      while(pending && accountId===owner) {
        const snapshot=JSON.stringify(settings);
        setText('#shensha-status','Synchronizing Shensha selections…');
        await window.DaymarkSync.writeShensha(JSON.parse(snapshot));
        if(accountId!==owner)return;
        hasCloud=true;
        if(JSON.stringify(settings)===snapshot)pending=false;
        saveCache();
      }
      if(dirty)return; // Never replace unsaved picker changes with a background pull.
      const remote=await window.DaymarkSync.readShensha();
      if(accountId!==owner || dirty)return;
      if(pending) { setTimeout(()=>window.dispatchEvent(new Event('daymark:shensha-save')),0);return; }
      if(remote!==null) {
        if(remote.version!==1 || !remote.settings)throw Error('Unsupported Shensha settings version.');
        settings=validate(remote.settings);hasCloud=true;saveCache();applyWidgets();
      } else { hasCloud=false;importVisibility(); }
      setText('#shensha-status',hasCloud ? 'Shensha selections synced.' : 'No account selections yet. Choose targets or use local selections.');
    } catch(error) {
      if(accountId===owner)setText('#shensha-status','Shensha sync failed. Saved selections remain on this device. {error}',{error:error.message});
      throw error;
    } finally {syncRunning=false;importVisibility();}
  }
  $('#shensha-use-local').addEventListener('click',()=>{
    if(!accountId || dirty || syncRunning)return;
    try {
      settings=localSelections();pending=true;saveCache();applyWidgets();
      window.dispatchEvent(new Event('daymark:shensha-save'));
    } catch {setText('#shensha-status','Could not save Shensha selections. Try again.');}
  });
  // All values are manually chosen daily matching targets, not birth-chart anchors.
  function matches(pillar) {
    return items.filter(([id]) => {
      const rule = settings[id];
      return rule.enabled && rule.targets.some(value => [pillar[0],pillar[1],pillar].includes(value));
    });
  }
  function appendMatches(container,pillar,found,inactive,counts={}) {
    for (const [id,label,kind] of found) {
      const badge = document.createElement('span');
      badge.className = `shensha-badge ${inactive ? 'inactive' : kind}${kind === 'custom' ? ' important' : ''}`;
      const count=counts[id]||1;
      badge.dataset.shensha = id;badge.dataset.count=String(count);
      badge.classList.toggle('intense',count>3 && !inactive && kind!=='custom');
      const rule = settings[id];
      const value = rule.targets.filter(value => [pillar[0],pillar[1],pillar].includes(value)).join('、');
      const title=itemName(id,label);
      badge.textContent = `${kind === 'custom' ? value : title + (count>1 ? ' ' : '') + (count>1 ? (kind === 'shen' ? '+' : '-').repeat(count) : '')}${inactive ? ' · ' + t('Inactive') : ''}`;
      if(kind !== 'custom')badge.setAttribute('aria-label',`${title} · ${(kind==='shen'?'+':'-').repeat(count)} · ${t(names[kind])}${inactive ? ' · ' + t('Inactive') : ''}`);
      container.append(badge);
    }
  }
  let calendar = null, period = null;
  const minDate = new Date(1901,0,1,12), maxDate = new Date(2100,11,31,12);
  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split('-').map(Number), date = new Date(y,m-1,d,12);
    return dateKey(date) === value && date >= minDate && date <= maxDate ? date : null;
  }
  function bounds(base, direction, length) {
    const y=base.getFullYear(),m=base.getMonth(),d=base.getDate();
    if (length === 'month') return [new Date(y,m+direction,1,12),new Date(y,m+direction+1,0,12)];
    const days=Number(length);
    return direction < 0 ? [new Date(y,m,d-days,12),new Date(y,m,d-1,12)]
      : [new Date(y,m,d+1,12),new Date(y,m,d+days,12)];
  }
  const scopeNames={year:'Year pillar',month:'Month pillar',day:'Day pillar',hour:'Hour pillar'};
  // Hours amplify an item already encountered in at least two longer pillars.
  function hasVoid(found) {return found.some(([id])=>id==='kongwang');}
  function timeText(minutes) {return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
  function selectedMinute() {
    const value=$('#shensha-time').value;
    return /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0,2))*60+Number(value.slice(3)) : null;
  }
  function encounterData(date) {
    const context=calendar.contextForDate(date);
    const groups=Object.fromEntries(['year','month','day'].map(scope=>[scope,{...context[scope],found:matches(context[scope].pillar)}]));
    const counts=Object.fromEntries(items.map(([id])=>[id,['year','month','day'].filter(scope=>groups[scope].found.some(([foundId])=>foundId===id)).length]));
    for(const group of Object.values(groups))group.counts=counts;
    const repeated=new Set(items.filter(([id])=>counts[id]>=2).map(([id])=>id));
    const hours=context.hours.map(slot=>({...slot,found:matches(slot.pillar).filter(([id])=>repeated.has(id)),counts:Object.fromEntries(items.map(([id])=>[id,counts[id]+1]))}));
    const baseVoid=['year','month','day'].some(scope=>hasVoid(groups[scope].found));
    return {groups,hours,wholeDayVoid:baseVoid,state:baseVoid ? 'inactive' : 'active'};
  }
  function dateFormatter() {return new Intl.DateTimeFormat(window.DaymarkI18n.locale,{year:'numeric',month:'short',day:'numeric'});}
  function appendPillarGroup(root,scope,group,inactive,formatter,empty=true) {
    if(!empty && !group.found.length)return null;
    const section=document.createElement('section');section.className='shensha-pillar-group';
    section.dataset.pillarScope=scope;section.dataset.pillar=group.pillar;
    const title=document.createElement('h3');title.textContent=`${t(scopeNames[scope])} · ${group.pillar}`;section.append(title);
    if(scope==='year'||scope==='month') {
      const range=document.createElement('p');range.className='shensha-pillar-range';
      range.textContent=t('Pillar dates (approx.): {start} – {end}',{start:formatter.format(group.start),end:formatter.format(group.end)});
      section.dataset.start=dateKey(group.start);section.dataset.end=dateKey(group.end);section.append(range);
    }
    const badges=document.createElement('div');badges.className='shensha-matches';
    appendMatches(badges,group.pillar,group.found,inactive,group.counts);section.append(badges);
    if(!group.found.length){const none=document.createElement('span');none.textContent='—';none.setAttribute('aria-label',t('No matches in this pillar.'));section.append(none);}
    root.append(section);return section;
  }
  function appendHours(root,data) {
    const foundHours=data.hours.filter(slot=>slot.found.length);
    if(!foundHours.length)return;
    const details=document.createElement('details');details.className='shensha-hour-list';
    const summary=document.createElement('summary');summary.textContent=t('Hour encounters');details.append(summary);
    for(const slot of foundHours) {
      const row=document.createElement('div');row.className='shensha-hour-slot';
      row.dataset.start=timeText(slot.startMinute);row.dataset.end=timeText(slot.endMinute);row.dataset.pillar=slot.pillar;
      const heading=document.createElement('h4');heading.textContent=`${timeText(slot.startMinute)}–${timeText(slot.endMinute)} · ${slot.pillar}`;
      const badges=document.createElement('div');badges.className='shensha-matches';
      appendMatches(badges,slot.pillar,slot.found,data.wholeDayVoid || hasVoid(slot.found),slot.counts);row.append(heading,badges);details.append(row);
    }
    root.append(details);
  }
  let resultPage=0;
  const pageDays=31;
  function activeBounds(base) {
    return period.custom ? [parseDate(period.start),parseDate(period.end)] : bounds(base,period.direction,period.length);
  }
  function fillRange(start,end) {
    $('#shensha-start').value=dateKey(new Date(Math.max(start,minDate)));
    $('#shensha-end').value=dateKey(new Date(Math.min(end,maxDate)));
  }
  function renderPeriod() {
    if(!calendar)return;
    const root=$('#shensha-period-results');root.hidden=!period;root.replaceChildren();
    $('#shensha-close').hidden=!period;$('#shensha-result-pages').hidden=true;
    const base=parseDate($('#shensha-reference').value);
    document.querySelectorAll('[data-shensha-period]').forEach(button=>{
      const range=base ? bounds(base,Number(button.dataset.direction),button.dataset.shenshaPeriod) : [null,null];
      button.disabled=!base || range[1]<minDate || range[0]>maxDate;
      const active=Boolean(period && !period.custom && period.direction===Number(button.dataset.direction) && period.length===button.dataset.shenshaPeriod);
      button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-expanded',String(active));button.setAttribute('aria-controls','shensha-period-results');
    });
    if(!items.some(([id])=>settings[id].enabled)){setText('#shensha-period-status','Select Shensha targets in Settings first.');return;}
    if(!period){setText('#shensha-period-status','Choose a period to list matching dates.');return;}
    if(!period.custom && !base){setText('#shensha-period-status','Choose a reference date between 1901 and 2100.');return;}
    let [start,end]=activeBounds(base);
    if(!start || !end || start>end){setText('#shensha-period-status','Choose valid start and end dates, with the end on or after the start.');return;}
    start=new Date(Math.max(start,minDate));end=new Date(Math.min(end,maxDate));
    if(start>end){setText('#shensha-period-status','No dates in the supported range.');return;}
    const first=new Date(start);first.setDate(first.getDate()+resultPage*pageDays);
    if(first>end){resultPage=0;renderPeriod();return;}
    const last=new Date(first);last.setDate(last.getDate()+pageDays-1);if(last>end)last.setTime(end.getTime());
    const prev=$('#shensha-page-prev'),next=$('#shensha-page-next');prev.disabled=resultPage===0;next.disabled=last>=end;
    $('#shensha-result-pages').hidden=prev.disabled&&next.disabled;
    const formatter=dateFormatter(),rows=document.createElement('ol');rows.className='shensha-date-cards';
    let count=0;
    for(let date=new Date(first);date<=last;date.setDate(date.getDate()+1)) {
      const data=encounterData(date);
      const found=items.filter(([id])=>['year','month','day'].some(scope=>data.groups[scope].found.some(([matchId])=>matchId===id)));
      if(!found.length)continue;count++;
      const row=document.createElement('li');row.className='shensha-date-card';row.dataset.date=dateKey(date);
      const link=document.createElement('a');link.href=`#day=${dateKey(date)}`;link.className='shensha-result-date';
      const info=calendar.dateInfo(date);
      link.textContent=`${formatter.format(date)} · ${info.weekday}`;const target=new Date(date);
      link.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();calendar.openDay(target);window.scrollTo(0,0);});
      const lunar=document.createElement('div');lunar.className='lunar';lunar.textContent=info.lunar;
      const pillars=document.createElement('div');pillars.className='ganzhi';
      pillars.textContent=['year','month','day'].map(scope=>`${t(scopeNames[scope])} ${data.groups[scope].pillar}`).join(' · ');
      row.append(link,lunar,pillars);
      const badges=document.createElement('div');badges.className='shensha-matches';
      // One badge per item; a representative matching pillar supplies custom target text.
      for(const item of found) {
        const group=Object.values(data.groups).find(group=>group.found.some(([id])=>id===item[0]));
        appendMatches(badges,group.pillar,[item],data.wholeDayVoid,group.counts);
      }
      row.append(badges);
      if(data.wholeDayVoid){const notice=document.createElement('p');notice.textContent=t('Inactive');notice.className='shensha-card-inactive';row.append(notice);}
      appendHours(row,data);rows.append(row);
    }
    root.append(rows);
    setText('#shensha-period-status','Displayed dates: {start} – {end}; {count} matching dates.',{start:formatter.format(first),end:formatter.format(last),count});
  }
  $('#shensha-range-form').addEventListener('submit',event=>{
    event.preventDefault();period={custom:true,start:$('#shensha-start').value,end:$('#shensha-end').value};resultPage=0;renderPeriod();
  });
  $('#shensha-close').addEventListener('click',()=>{period=null;resultPage=0;renderPeriod();});
  $('#shensha-page-prev').addEventListener('click',()=>{resultPage=Math.max(0,resultPage-1);renderPeriod();});
  $('#shensha-page-next').addEventListener('click',()=>{resultPage++;renderPeriod();});
  $('#shensha-reference').addEventListener('change',()=>{
    resultPage=0;
    const base=parseDate($('#shensha-reference').value);
    if(period && !period.custom && base)fillRange(...bounds(base,period.direction,period.length));
    renderPeriod();
  });
  document.querySelectorAll('[data-shensha-period]').forEach(button=>button.addEventListener('click',()=>{
    const direction=Number(button.dataset.direction),length=button.dataset.shenshaPeriod;
    const base=parseDate($('#shensha-reference').value);if(!base)return;
    period=period && !period.custom && period.direction===direction && period.length===length ? null : {direction,length};
    resultPage=0;if(period)fillRange(...bounds(base,direction,length));renderPeriod();
  }));
  let selectedDate=null;
  function render() {
    if(!selectedDate || !calendar)return;
    const selected=items.some(([id])=>settings[id].enabled);$('#shensha-detail').hidden=!selected;
    const root=$('#shensha-matches');root.replaceChildren();
    const minute=selectedMinute();
    if(minute===null){setText('#shensha-empty','Choose a valid local time.');$('#shensha-empty').hidden=false;$('#shensha-inactive').hidden=true;return;}
    const data=encounterData(selectedDate),hour=data.hours.find(slot=>minute>=slot.startMinute&&minute<slot.endMinute);
    const inactive=data.wholeDayVoid||hasVoid(hour.found),formatter=dateFormatter();
    for(const scope of ['year','month','day'])appendPillarGroup(root,scope,data.groups[scope],inactive,formatter);
    const hourSection=appendPillarGroup(root,'hour',hour,inactive,formatter,false);
    if(hourSection) {
      const hours=document.createElement('p');hours.textContent=`${timeText(hour.startMinute)}–${timeText(hour.endMinute)}`;hourSection.insertBefore(hours,hourSection.children[1]);
    }
    const scheduled=document.createElement('div');scheduled.dataset.pillarScope='hour-schedule';appendHours(scheduled,data);root.append(scheduled);
    const any=['year','month','day'].some(scope=>data.groups[scope].found.length)||hour.found.length;
    setText('#shensha-empty','No matches at the selected time.');$('#shensha-empty').hidden=Boolean(any);
    setText('#shensha-inactive','Kongwang matched: all Shensha on this date are inactive.');
    $('#shensha-inactive').hidden=!inactive;
  }
  $('#shensha-time').addEventListener('change',()=>{render();renderPeriod();});
  const pickers = new Map();
  for (const kind of ['shen','sha','custom']) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    setText(legend,names[kind]); group.append(legend);
    for (const [id,label,itemKind] of items.filter(item => item[2] === kind)) {
      const row = document.createElement('div'); row.className = 'shensha-row';
      const checkLabel = document.createElement('label');
      const check = document.createElement('input'); check.type = 'checkbox'; check.id = `shensha-${id}`;
      const nameLabel=document.createElement('span');nameLabel.textContent=itemName(id,label);
      check.checked = settings[id].enabled; checkLabel.append(check,nameLabel);
      if (kind === 'custom') row.classList.toggle('important',check.checked);
      const picker = document.createElement('div'); picker.className = 'shensha-picker';
      const selected = new Set(settings[id].targets);
      const chips = document.createElement('div'); chips.className = 'shensha-chips';
      const details = document.createElement('details'); details.id = `shensha-picker-${id}`;
      const summary = document.createElement('summary'); setText(summary,'Choose targets');
      summary.setAttribute('aria-label',itemName(id,label) + ' · ' + t('Matching targets'));
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
          chip.addEventListener('click',()=>{selected.delete(value);optionChecks.get(value).checked=false;markDirty();updateChips();summary.focus();});
          chips.append(chip);
        }
      }
      for (const [title,values] of groupsFor(id)) {
        const section = document.createElement('fieldset');
        const heading = document.createElement('legend');setText(heading,title);section.append(heading);
        const options = document.createElement('div'); options.className = 'shensha-option-grid';
        for (const value of values) {
          const optionLabel = document.createElement('label');optionLabel.dataset.value = value;
          const option = document.createElement('input');option.type='checkbox';option.value=value;
          option.checked=selected.has(value);option.disabled=!check.checked;
          option.addEventListener('change',()=>{markDirty();if(option.checked)selected.add(value);else selected.delete(value);updateChips();});
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
      check.addEventListener('change',()=>{markDirty();updateEnabled();});
      pickers.set(id,{selected,summary,options:optionChecks,updateEnabled,nameLabel});
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
        setText('#shensha-status','Choose at least one target for {name}.',{name:itemName(id,label)});
        pickers.get(id).summary.focus(); return;
      }
      draft[id] = {enabled,targets:targets.filter(value => allowedFor(id).includes(value))};
    }
    settings = validate(draft);dirty=false;
    if(accountId)pending=true;
    try {
      saveCache();
      setText('#shensha-status',accountId ? 'Saved on this device. Waiting to sync Shensha selections.' : 'Matching settings saved. Open any date to calculate.');
    } catch {
      setText('#shensha-status',accountId ? 'Could not save Shensha selections. Try again.' : 'Matching settings apply for this session only; browser storage is unavailable.');
    }
    render(); renderPeriod();importVisibility();
    if(accountId)window.dispatchEvent(new Event('daymark:shensha-save'));
  });
  window.addEventListener('daymark:language',()=>{
    for(const [id,label] of items) {
      const picker=pickers.get(id);picker.nameLabel.textContent=itemName(id,label);
      picker.summary.setAttribute('aria-label',itemName(id,label) + ' · ' + t('Matching targets'));
      picker.updateEnabled();
    }
    render();renderPeriod();
  });
  window.DaymarkShensha = {
    setAccount, sync:syncSelections,
    get pending() {return Boolean(accountId && pending);},
    get dirty() {return dirty;},
    get busy() {return syncRunning;},
    show(date) { selectedDate=new Date(date);render(); },
    configure(api) { calendar=api; },
    context(date,hidden) {
      $('#shensha-period-panel').hidden=hidden;
      if(!period){$('#shensha-reference').value=dateKey(date);fillRange(date,date);}
      renderPeriod();
    }
  };
  if (adjusted) setText('#shensha-status','Unsupported saved targets were removed. Review and save your selections.');
  if (loadWarning) setText('#shensha-status','Saved matching settings could not be loaded. Please configure them again.');
})();
