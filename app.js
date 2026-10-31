(() => {
  const $ = (s) => document.querySelector(s);
  const i18n = window.DaymarkI18n;
  const {t, setText} = i18n;
  const daysEl = $('#days');
  const monthTitle = $('#month-title');
  const summary = $('#date-summary');
  let todayDate = new Date();
  let period = 'month';
  try { const saved = localStorage.getItem('daymark.calendarPeriod'); if (['year','month','week'].includes(saved)) period = saved; } catch {}
  let selectedCalendarDate = new Date(todayDate);
  let shown = new Date(todayDate);
  const MIN_YEAR = 1901;
  const MAX_YEAR = 2100;
  const VIEW_KEY = 'daymark.calendarView';
  const validViews = ['gregorian', 'lunar', 'combined'];
  let view = 'combined';
  try {
    const savedView = localStorage.getItem(VIEW_KEY);
    if (validViews.includes(savedView)) view = savedView;
  } catch (error) {
    setText('#preference-status', 'View preferences cannot be saved in this browser session.');
  }
  function updateMonthNames() {
    const names = new Intl.DateTimeFormat(i18n.locale, {month:'long'});
    const selected = $('#jump-month').value;
    $('#jump-month').replaceChildren();
    for (let month = 0; month < 12; month++) {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = names.format(new Date(2026, month, 1));
      $('#jump-month').append(option);
    }
    $('#jump-month').value = selected;
  }
  updateMonthNames();
  let focusAfterCalendar = false;
  let focusDateKey = null;
  let activeDateKey = null;
  let forceCalendar = false;
  let detailRouteAvailable = false;
  let monthFormatter = new Intl.DateTimeFormat(i18n.locale, { month: 'long', year: 'numeric' });
  const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese-nu-latn', { month: 'long', day: 'numeric' });
  const lunarNumericFormatter = new Intl.DateTimeFormat('en-u-ca-chinese-nu-latn', {month:'numeric', day:'numeric'});
  let weekdayFormatter = new Intl.DateTimeFormat(i18n.locale, { weekday: 'long' });
  const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const branches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const lunarDayNames = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  const jieTerms = [
    { longitude:285, month:0, day:6, offset:11, name:'小寒', english:'Xiaohan' }, { longitude:315, month:1, day:4, offset:0, name:'立春', english:'Lichun' },
    { longitude:345, month:2, day:6, offset:1, name:'惊蛰', english:'Jingzhe' }, { longitude:15, month:3, day:5, offset:2, name:'清明', english:'Qingming' },
    { longitude:45, month:4, day:6, offset:3, name:'立夏', english:'Lixia' }, { longitude:75, month:5, day:6, offset:4, name:'芒种', english:'Mangzhong' },
    { longitude:105, month:6, day:7, offset:5, name:'小暑', english:'Xiaoshu' }, { longitude:135, month:7, day:8, offset:6, name:'立秋', english:'Liqiu' },
    { longitude:165, month:8, day:8, offset:7, name:'白露', english:'Bailu' }, { longitude:195, month:9, day:8, offset:8, name:'寒露', english:'Hanlu' },
    { longitude:225, month:10, day:7, offset:9, name:'立冬', english:'Lidong' }, { longitude:255, month:11, day:7, offset:10, name:'大雪', english:'Daxue' }
  ];
  const termCache = new Map();
  const fmtDate = (d) => new Intl.DateTimeFormat(i18n.locale, { year:'numeric', month:'long', day:'numeric' }).format(d);
  function lunarParts(date) {
    const parts = lunarFormatter.formatToParts(date);
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const dayNumber = Number(parts.find(p => p.type === 'day')?.value);
    const numeric = lunarNumericFormatter.formatToParts(date).find(p => p.type === 'month').value;
    const monthNumber = Number.parseInt(numeric, 10);
    const leap = numeric.includes('bis');
    const full = i18n.language === 'zh' ? `农历${month}${lunarDayNames[dayNumber]}`
      : t(leap ? 'Leap lunar month {month}, day {day}' : 'Lunar month {month}, day {day}', {month:monthNumber, day:dayNumber});
    return {month:i18n.language === 'zh' ? month : t(leap ? 'Leap {month}' : 'M{month}', {month:monthNumber}),
      day:i18n.language === 'zh' ? lunarDayNames[dayNumber] : String(dayNumber), dayNumber, full};
  }
  const pinyinStems = ['Jiǎ','Yǐ','Bǐng','Dīng','Wù','Jǐ','Gēng','Xīn','Rén','Guǐ'];
  const pinyinBranches = ['Zǐ','Chǒu','Yín','Mǎo','Chén','Sì','Wǔ','Wèi','Shēn','Yǒu','Xū','Hài'];
  const russianStems = ['Цзя','И','Бин','Дин','У','Цзи','Гэн','Синь','Жэнь','Гуй'];
  const russianBranches = ['цзы','чоу','инь','мао','чэнь','сы','у','вэй','шэнь','ю','сюй','хай'];
  const japaneseStems = ['きのえ','きのと','ひのえ','ひのと','つちのえ','つちのと','かのえ','かのと','みずのえ','みずのと'];
  const japaneseBranches = ['ね','うし','とら','う','たつ','み','うま','ひつじ','さる','とり','いぬ','い'];
  function marker(value) {
    if (i18n.language === 'zh') return value;
    const stem = stems.indexOf(value[0]), branch = branches.indexOf(value[1]);
    const names = i18n.language === 'ja' ? [japaneseStems, japaneseBranches] : i18n.language === 'ru' ? [russianStems, russianBranches] : [pinyinStems, pinyinBranches];
    return `${value} · ${names[0][stem]}-${names[1][branch]}`;
  }
  const termMeanings = ['Minor Cold','Beginning of Spring','Awakening of Insects','Pure Brightness','Beginning of Summer','Grain in Ear','Minor Heat','Beginning of Autumn','White Dew','Cold Dew','Beginning of Winter','Major Snow'];
  function termLabel(term) {
    if (i18n.language === 'zh') return term.name;
    const index = jieTerms.findIndex(item => item.name === term.name);
    return `${term.name} · ${t(termMeanings[index])} (${term.english})`;
  }
  function updateWeekdays() {
    const formatter = new Intl.DateTimeFormat(i18n.locale, {weekday:'short'});
    document.querySelectorAll('.weekday').forEach((element,index) => {
      element.textContent = formatter.format(new Date(2026,0,4+index));
    });
  }
  updateWeekdays();
  function sexagenaryDay(date) {
    const jdn = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) + 2440588;
    const cycle = ((jdn + 49) % 60 + 60) % 60;
    return stems[cycle % 10] + branches[cycle % 12];
  }
  function mod(n, m) { return ((n % m) + m) % m; }
  function apparentSolarLongitude(timestamp) {
    const jd = timestamp / 86400000 + 2440587.5;
    const d = jd - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * Math.PI / 180;
    const q = 280.459 + 0.98564736 * d;
    return mod(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g), 360);
  }
  function signedAngleDifference(longitude, target) {
    return mod(longitude - target + 180, 360) - 180;
  }
  function solarTermInstant(year, term) {
    const guess = Date.UTC(year, term.month, term.day, 12);
    let low = guess - 7 * 86400000;
    let high = guess + 7 * 86400000;
    const lowDelta = signedAngleDifference(apparentSolarLongitude(low), term.longitude);
    const highDelta = signedAngleDifference(apparentSolarLongitude(high), term.longitude);
    if (!(lowDelta <= 0 && highDelta >= 0)) return guess;
    for (let i = 0; i < 42; i++) {
      const mid = (low + high) / 2;
      if (signedAngleDifference(apparentSolarLongitude(mid), term.longitude) < 0) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }
  function termsForYear(year) {
    if (!termCache.has(year)) termCache.set(year, jieTerms.map(term => ({ ...term, year, instant: solarTermInstant(year, term) })));
    return termCache.get(year);
  }
  function timestampAtLocalNoon(date, zone) {
    if (zone) {
      const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
      const formatter = new Intl.DateTimeFormat('en-GB', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
      let instant = target;
      for (let i=0; i<4; i++) {
        const parts = Object.fromEntries(formatter.formatToParts(instant).map(part=>[part.type,part.value]));
        const wall = Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
        const delta = target-wall;
        instant += delta;
        if (!delta) break;
      }
      return instant;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  }
  function pillarsFor(date, zone) {
    const noon = timestampAtLocalNoon(date, zone);
    const terms = [];
    for (let year = date.getFullYear() - 1; year <= date.getFullYear() + 1; year++) terms.push(...termsForYear(year));
    const term = terms.filter(item => item.instant <= noon).sort((a,b) => b.instant - a.instant)[0];
    const lichun = termsForYear(term.year).find(item => item.offset === 0);
    const solarYear = noon < lichun.instant ? term.year - 1 : term.year;
    const yearCycle = mod(solarYear - 4, 60);
    const yearIndex = yearCycle % 10;
    const yearPillar = stems[yearIndex] + branches[yearCycle % 12];
    const firstMonthStem = mod((yearIndex % 5) * 2 + 2, 10);
    const monthPillar = stems[mod(firstMonthStem + term.offset, 10)] + branches[mod(2 + term.offset, 12)];
    return { year: yearPillar, month: monthPillar, term };
  }
  // Keep encounter ranges consistent with the date cards' local-noon convention.
  function effectiveTermDate(instant, zone) {
    let date=new Date(instant);
    if (zone) {
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(instant).map(part=>[part.type,part.value]));
      date=new Date(+parts.year,+parts.month-1,+parts.day,12);
    }
    const result=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
    if(timestampAtLocalNoon(result,zone)<instant)result.setDate(result.getDate()+1);
    return result;
  }
  function encounterPillars(date) {
    const zone=window.DaymarkShensha.timeZone;
    const noon=timestampAtLocalNoon(date,zone),markers=pillarsFor(date,zone);
    const terms=[];
    for(let y=date.getFullYear()-1;y<=date.getFullYear()+2;y++)terms.push(...termsForYear(y));
    terms.sort((a,b)=>a.instant-b.instant);
    const yearStarts=terms.filter(term=>term.offset===0);
    const yearStart=yearStarts.filter(term=>term.instant<=noon).at(-1);
    const yearEnd=yearStarts.find(term=>term.instant>noon);
    const monthEnd=terms.find(term=>term.instant>noon);
    function interval(pillar,start,end) {
      const last=effectiveTermDate(end.instant,zone);last.setDate(last.getDate()-1);
      return {pillar,start:effectiveTermDate(start.instant,zone),end:last};
    }
    const day=sexagenaryDay(date),dayStem=stems.indexOf(day[0]);
    const hourStarts=[0,1,3,5,7,9,11,13,15,17,19,21,23];
    const hours=hourStarts.map((hour,i)=>{
      const branch=Math.floor((hour+1)/2)%12;
      return {pillar:stems[mod((dayStem%5)*2+branch,10)]+branches[branch],
        startMinute:hour*60,endMinute:(hourStarts[i+1]??24)*60};
    });
    return {year:interval(markers.year,yearStart,yearEnd),
      month:interval(markers.month,markers.term,monthEnd),
      day:{pillar:day,start:new Date(date),end:new Date(date)},hours};
  }
  function dateKey(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function dateFromKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month-1, day, 12);
    return year >= MIN_YEAR && year <= MAX_YEAR && date.getFullYear() === year && date.getMonth() === month-1 && date.getDate() === day ? date : null;
  }
  function openDay(date) {
    const key = dateKey(date);
    focusDateKey = key;
    focusAfterCalendar = true;
    activeDateKey = key;
    forceCalendar = false;
    try {
      history.pushState({ view:'day', date:key, fromCalendar:true }, '', `#day=${key}`);
      detailRouteAvailable = true;
    } catch (error) {
      detailRouteAvailable = false;
    }
    renderPage();
  }
  function renderDayDetails(date, focus = true) {
    const lunar = lunarParts(date);
    const pillars = pillarsFor(date);
    const weekday = weekdayFormatter.format(date);
    const title = `${weekday}, ${fmtDate(date)}`;
    $('#detail-title').textContent = title;
    document.title = `${t('Daymark Calendar')} — ${title}`;
    $('#detail-subtitle').textContent = t('Chinese lunar date and traditional calendar markers');
    $('#detail-gregorian').textContent = fmtDate(date);
    $('#detail-weekday').textContent = weekday;
    $('#detail-lunar').textContent = lunar.full;
    $('#detail-year-pillar').textContent = marker(pillars.year);
    $('#detail-month-pillar').textContent = marker(pillars.month);
    $('#detail-day-pillar').textContent = marker(sexagenaryDay(date));
    window.DaymarkShensha.show(date);
    const nearbyTerms = [];
    for (let year=date.getFullYear()-1; year<=date.getFullYear()+1; year++) nearbyTerms.push(...termsForYear(year));
    const termOnDate = nearbyTerms.find(term => dateKey(new Date(term.instant)) === dateKey(date));
    const termInfo = $('#detail-solar-term');
    if (termOnDate) {
      const boundaryTime = new Intl.DateTimeFormat(i18n.locale, { hour:'numeric', minute:'2-digit' }).format(new Date(termOnDate.instant));
      termInfo.textContent = t('Solar-term boundary: {term}, at approximately {time} local time. The time is an estimate.', {term:termLabel(termOnDate),time:boundaryTime});
    } else {
      const boundaryDate = new Date(pillars.term.instant);
      termInfo.textContent = t('The current solar-term period began with {term} on {date}. Solar-term times are estimates.', {term:termLabel(pillars.term),date:fmtDate(boundaryDate)});
    }
    window.dispatchEvent(new CustomEvent('daymark:day', { detail:dateKey(date) }));
    if (focus) $('#detail-title').focus();
  }
  let logoIconKey = '';
  function renderLogoIcon(month, day, kind) {
    const key = JSON.stringify([month, day, kind]);
    if (key === logoIconKey) return;
    const accent = {none:'#39433e', shen:'#236043', sha:'#a12626', kongwang:'#606862'}[kind];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Keep the complete mark inside the safe area of home-screen icons.
    ctx.fillStyle = '#f5f6f3';
    ctx.fillRect(0, 0, 512, 512);
    ctx.beginPath();
    ctx.roundRect(64, 54, 384, 404, 64);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(64, 54, 384, 404);
    ctx.fillStyle = kind === 'none' ? '#fff' : accent;
    ctx.fillRect(64, 54, 384, 150);
    ctx.fillStyle = kind === 'none' ? accent : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 96px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(month, 256, 132, 340);
    ctx.fillStyle = accent;
    ctx.font = '700 224px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(day, 256, 334, 350);
    if (kind === 'none') {
      ctx.fillStyle = '#dce1dd';
      ctx.fillRect(64, 204, 384, 2);
    }
    ctx.restore();
    ctx.strokeStyle = kind === 'none' ? '#929b95' : accent;
    ctx.lineWidth = 8;
    ctx.stroke();
    $('#app-favicon').href = canvas.toDataURL('image/png');
    logoIconKey = key;
  }
  function renderLogo() {
    const date=new Date();
    $('#logo-month').textContent=new Intl.DateTimeFormat(i18n.locale,{month:'short'}).format(date);
    $('#logo-day').textContent=new Intl.NumberFormat(i18n.locale,{useGrouping:false}).format(date.getDate());
    const leading=window.DaymarkShensha.leading(date);
    const kind=leading?.kind || 'none';
    $('#calendar-home').dataset.shensha=kind;
    renderLogoIcon($('#logo-month').textContent, $('#logo-day').textContent, kind);
    let label=t('Calendar · Today: {date}',{date:new Intl.DateTimeFormat(i18n.locale,{dateStyle:'full'}).format(date)});
    if(leading)label+=' · '+t('Leading Shensha: {name}',{name:leading.name});
    $('#calendar-home').setAttribute('aria-label',label);
    $('#calendar-home').title=label;
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderLogo();});
  window.addEventListener('focus',renderLogo);
  setInterval(renderLogo,60000);
  function renderPage(focusDetails = true) {
    renderLogo();
    const settings = location.hash.match(/^#settings(?:-(account|sync|display|time|shensha|app))?$/);
    $('#settings-page').hidden = !settings;
    $('#open-settings').setAttribute('aria-expanded', String(Boolean(settings)));
    const match = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/);
    const detailDate = settings || forceCalendar ? null : dateFromKey(activeDateKey || (match ? match[1] : ''));
    $('#calendar-page').hidden = Boolean(detailDate || settings);
    $('#detail-page').hidden = !detailDate;
    if(detailDate)selectedCalendarDate=new Date(detailDate);
    $('#find-date').value=dateKey(selectedCalendarDate);
    window.DaymarkShensha.context(selectedCalendarDate,Boolean(settings));
    if (settings) {
      render();
      document.title = `${t('Settings')} · Daymark`;
      if (focusDetails) {
        const target = settings[1] ? $(`#settings-${settings[1]}`) : $('#settings-title');
        target.focus();
        if (settings[1]) target.scrollIntoView({block:'start'});
      }
    }
    else if (detailDate) renderDayDetails(detailDate, focusDetails);
    else {
      document.title = t('Daymark — Gregorian & Chinese Calendar');
      render();
      if (focusAfterCalendar) {
        document.querySelector(`[data-date="${focusDateKey}"]`)?.focus();
        focusAfterCalendar = false;
      }
    }
  }
  function adjacentPeriod(direction) {
    if (period === 'year') return new Date(shown.getFullYear()+direction, shown.getMonth(), 1, 12);
    if (period === 'month') return new Date(shown.getFullYear(), shown.getMonth()+direction, 1, 12);
    const date = new Date(shown.getFullYear(), shown.getMonth(), shown.getDate()-shown.getDay()+7*direction, 12);
    // The first supported week can start in December of the preceding year.
    if (date.getFullYear() < MIN_YEAR && new Date(date.getFullYear(),date.getMonth(),date.getDate()+6).getFullYear() === MIN_YEAR) return new Date(MIN_YEAR,0,1,12);
    return date;
  }
  function renderYear() {
    const months = document.createDocumentFragment();
    const weekday = new Intl.DateTimeFormat(i18n.locale,{weekday:'narrow'});
    for (let month=0; month<12; month++) {
      const section = document.createElement('section'); section.className='mini-month';
      const heading = document.createElement('h2');
      const button = document.createElement('button'); button.type='button'; button.className='mini-month-title';
      const first = new Date(shown.getFullYear(),month,1,12);
      button.textContent = new Intl.DateTimeFormat(i18n.locale,{month:'long'}).format(first);
      button.setAttribute('aria-label',monthFormatter.format(first));
      button.addEventListener('click',()=>{shown=first;setPeriod('month');});
      heading.append(button); section.append(heading);
      const grid = document.createElement('div'); grid.className='mini-days';
      for(let day=0;day<7;day++) { const label=document.createElement('span'); label.className='mini-weekday'; label.textContent=weekday.format(new Date(2026,0,4+day)); label.setAttribute('aria-hidden','true'); grid.append(label); }
      for(let gap=0;gap<first.getDay();gap++) {const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');grid.append(empty);}
      const count = new Date(shown.getFullYear(),month+1,0).getDate();
      for(let day=1;day<=count;day++) {
        const date=new Date(shown.getFullYear(),month,day,12),key=dateKey(date);
        const cell=document.createElement('button');cell.type='button';cell.className='mini-day';cell.dataset.date=key;
        cell.textContent=new Intl.NumberFormat(i18n.locale,{useGrouping:false}).format(day);
        cell.setAttribute('aria-label',new Intl.DateTimeFormat(i18n.locale,{dateStyle:'full'}).format(date));
        if(key===dateKey(todayDate)){cell.classList.add('today');cell.setAttribute('aria-current','date');}
        if(window.DaymarkNotes?.dates.has(key)){cell.classList.add('has-note');cell.setAttribute('aria-description',t('Has a saved note'));}
        cell.addEventListener('click',()=>{shown=date;window.DaymarkShensha.selectDay();openDay(date);});grid.append(cell);
      }
      section.append(grid);months.append(section);
    }
    $('#year-months').replaceChildren(months);
  }
  function setPeriod(value) {
    if (value === 'week' && period !== 'week') {
      const date = selectedCalendarDate;
      if (date.getFullYear() === shown.getFullYear() && date.getMonth() === shown.getMonth()) shown = new Date(date);
    }
    period=value;
    try {localStorage.setItem('daymark.calendarPeriod',period);} catch {}
    render();
  }
  document.querySelectorAll('.period-btn').forEach(button=>button.addEventListener('click',()=>setPeriod(button.dataset.period)));
  function render() {
    todayDate = new Date();
    if (!$('#calendar-page').hidden) $('#shensha-period-panel').hidden = period === 'week';
    const weekStart = new Date(shown.getFullYear(), shown.getMonth(), shown.getDate()-shown.getDay(), 12);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+6, 12);
    monthTitle.textContent = period === 'year' ? new Intl.DateTimeFormat(i18n.locale,{year:'numeric'}).format(shown)
      : period === 'week' ? `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}` : monthFormatter.format(shown);
    $('#jump-month').value = String(shown.getMonth());
    $('#jump-year').value = shown.getFullYear();
    const previous = adjacentPeriod(-1), next = adjacentPeriod(1);
    $('#prev').disabled = previous.getFullYear() < MIN_YEAR;
    $('#next').disabled = next.getFullYear() > MAX_YEAR;
    $('#prev').setAttribute('aria-label',t({year:'Previous year',month:'Previous month',week:'Previous week'}[period]));
    $('#next').setAttribute('aria-label',t({year:'Next year',month:'Next month',week:'Next week'}[period]));
    document.querySelectorAll('.period-btn').forEach(btn => btn.setAttribute('aria-pressed',String(btn.dataset.period === period)));
    daysEl.hidden = period === 'year';
    $('.weekdays').hidden = period === 'year';
    $('#year-months').hidden = period !== 'year';
    daysEl.setAttribute('aria-label',t(period === 'week' ? 'Weekly calendar' : 'Monthly calendar'));
    const thisLunar = lunarParts(todayDate);
    const todayPillars = pillarsFor(todayDate);
    summary.textContent = `${t('Today')} · ${fmtDate(todayDate)} · ${todayPillars.year} · ${thisLunar.full} · ${todayPillars.month} · ${sexagenaryDay(todayDate)}`;
    $('#calendar-card').className = `calendar-card ${view === 'gregorian' ? 'greg-only' : ''} ${view === 'lunar' ? 'lunar-only' : ''} ${period === 'week' ? 'week-view' : ''}`;
    document.querySelectorAll('.view-btn').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    if (period === 'year') { daysEl.replaceChildren(); renderYear(); return; }
    $('#year-months').replaceChildren();
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const start = period === 'week' ? weekStart : new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const frag = document.createDocumentFragment();
    for (let i=0; i<(period === 'week' ? 7 : 42); i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i, 12);
      const outside = period === 'month' && date.getMonth() !== shown.getMonth();
      const isToday = date.getFullYear() === todayDate.getFullYear() && date.getMonth() === todayDate.getMonth() && date.getDate() === todayDate.getDate();
      const lunar = lunarParts(date);
      const pillars = pillarsFor(date);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.disabled = date.getFullYear() < MIN_YEAR || date.getFullYear() > MAX_YEAR;
      cell.className = `day${outside ? ' outside' : ''}${isToday ? ' today' : ''}`;
      cell.dataset.date = dateKey(date);
      if (window.DaymarkNotes?.dates.has(cell.dataset.date)) {
        cell.classList.add('has-note');
        cell.setAttribute('aria-description', t('Has a saved note'));
      }
      cell.title = t('Open day details');
      cell.setAttribute('aria-label', t('{weekday}, {date}, {lunar}; traditional calendar markers {year}, {month}, {day}{today}', {weekday:weekdayFormatter.format(date),date:fmtDate(date),lunar:lunar.full,year:marker(pillars.year),month:marker(pillars.month),day:marker(sexagenaryDay(date)),today:isToday ? t(', today') : ''}));
      cell.addEventListener('click', () => { window.DaymarkShensha.selectDay();openDay(date); });
      const row = document.createElement('div'); row.className='greg-row';
      const num = document.createElement('span'); num.className='greg-number'; num.textContent=date.getDate(); row.append(num);
      const indicator=document.createElement('span'); indicator.className='open-indicator'; indicator.setAttribute('aria-hidden','true'); indicator.textContent='↗';
      if (isToday) { const label=document.createElement('span'); label.className='today-label'; label.textContent=t('Today'); row.append(label,indicator); }
      else row.append(indicator);
      const lunarEl=document.createElement('div'); lunarEl.className='lunar';
      if (lunar.dayNumber === 1) {
        const m=document.createElement('span'); m.className='month'; m.textContent=lunar.month;
        const d=document.createElement('span'); d.className='dayname'; d.textContent=lunar.day; lunarEl.append(m, document.createTextNode(' '), d);
      } else {
        const d=document.createElement('span'); d.className='dayname'; d.textContent=lunar.day; lunarEl.append(d);
      }
      const ganzhiEl=document.createElement('div'); ganzhiEl.className='ganzhi';
      ganzhiEl.title=`${t('Year')} ${marker(pillars.year)} · ${t('Month')} ${marker(pillars.month)} · ${t('Day')} ${marker(sexagenaryDay(date))}`;
      const yearPillar=document.createElement('b'); yearPillar.textContent=pillars.year;
      const monthPillar=document.createElement('span'); monthPillar.textContent=` · ${pillars.month}`;
      const dayPillar=document.createElement('span'); dayPillar.textContent=` · ${sexagenaryDay(date)}`;
      ganzhiEl.append(yearPillar,monthPillar,dayPillar);
      cell.append(row,lunarEl,ganzhiEl);
      if (period === 'week' && !cell.disabled) {
        window.DaymarkShensha.appendWeekCell(cell,date);
        const text = window.DaymarkNotes?.savedText(cell.dataset.date);
        if (text) {
          const preview = document.createElement('div');preview.className='week-note-preview';
          preview.textContent=text;
          // The day button opens the complete note; the preview never renders note HTML.
          cell.append(preview);
        }
      }
      frag.append(cell);
    }
    daysEl.replaceChildren(frag);
  }
  window.addEventListener('daymark:notes', () => { if (!$('#calendar-page').hidden) render(); });
  $('#month-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    shown = new Date(Number($('#jump-year').value), Number($('#jump-month').value), 1);
    render();
  });
  $('#find-date').addEventListener('change',()=>{
    const date=dateFromKey($('#find-date').value);
    if(!date)return;
    selectedCalendarDate=new Date(date);
    window.DaymarkShensha.context(selectedCalendarDate,false);
  });
  $('#date-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const date = dateFromKey($('#find-date').value);
    if (!date) return;
    shown = new Date(date);
    openDay(date);
  });
  $('#prev').addEventListener('click', () => { shown = adjacentPeriod(-1); render(); });
  $('#next').addEventListener('click', () => { shown = adjacentPeriod(1); render(); });
  $('#today').addEventListener('click', () => { todayDate=new Date();selectedCalendarDate=new Date(todayDate);$('#find-date').value=dateKey(selectedCalendarDate);window.DaymarkShensha.context(selectedCalendarDate,false);shown = new Date(todayDate); render(); });
  $('#back-to-calendar').addEventListener('click', () => {
    if (detailRouteAvailable && history.state?.fromCalendar) {
      activeDateKey = null;
      detailRouteAvailable = false;
      history.back();
    }
    else {
      activeDateKey = null;
      forceCalendar = true;
      try { history.replaceState({ view:'calendar' }, '', `${location.pathname}${location.search}#calendar`); }
      catch (error) { try { location.hash = '#calendar'; } catch (ignored) {} }
      renderPage();
    }
  });
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => { view=btn.dataset.view;
    try {
      localStorage.setItem(VIEW_KEY, view);
      setText('#preference-status', '');
    } catch (error) {
      setText('#preference-status', 'View changed for this session; your browser could not save the preference.');
    }
    render(); }));
  function navigateSettings(section) {
    activeDateKey = null; forceCalendar = false;
    const hash = section ? `#settings-${section}` : '#settings';
    try { history.pushState({view:'settings'}, '', hash); }
    catch { location.hash = hash; }
    renderPage();
    if (!section) window.scrollTo(0,0);
  }
  document.querySelectorAll('[data-open-settings]').forEach(button => button.addEventListener('click', () => {
    navigateSettings(button.dataset.openSettings);
  }));
  function returnToCalendar(event) {
    event?.preventDefault();
    activeDateKey = null; forceCalendar = true; detailRouteAvailable = false;
    try { history.pushState({view:'calendar'}, '', '#calendar'); }
    catch { location.hash = '#calendar'; }
    renderPage(false); $('#page-title').focus(); window.scrollTo(0,0);
  }
  $('#settings-back').addEventListener('click', returnToCalendar);
  $('#calendar-home').addEventListener('click', returnToCalendar);
  window.addEventListener('hashchange', () => {activeDateKey = null; forceCalendar = false; renderPage(false);});
  window.addEventListener('popstate', () => { activeDateKey = null; forceCalendar = false; detailRouteAvailable = false; renderPage(); });
  if (!history.state?.view) {
    const directDay = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/);
    activeDateKey = directDay ? directDay[1] : null;
    try { history.replaceState({ view:directDay ? 'day' : 'calendar', fromCalendar:false }, '', location.href); } catch (error) {}
  }
  window.addEventListener('daymark:language', () => {
    monthFormatter = new Intl.DateTimeFormat(i18n.locale, {month:'long',year:'numeric'});
    weekdayFormatter = new Intl.DateTimeFormat(i18n.locale, {weekday:'long'});
    updateMonthNames(); updateWeekdays();
    try { renderPage(false); } catch { setText(summary,'Your browser does not support Chinese calendar formatting. Try a recent version of Safari, Chrome, Firefox, or Edge.'); }
  });
  window.DaymarkShensha.configure({pillarForDate:sexagenaryDay,contextForDate:encounterPillars,dateInfo:date=>({lunar:lunarParts(date).full,weekday:weekdayFormatter.format(date)}),openDay,updateWeek:()=>{if(period==='week' && !$('#calendar-page').hidden)render();},updateLogo:renderLogo});
  try { lunarFormatter.format(todayDate); renderPage(); }
  catch (err) { setText(summary,'Your browser does not support Chinese calendar formatting. Try a recent version of Safari, Chrome, Firefox, or Edge.'); daysEl.replaceChildren(); }
})();
