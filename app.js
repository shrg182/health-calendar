(() => {
  const $ = (s) => document.querySelector(s);
  const daysEl = $('#days');
  const monthTitle = $('#month-title');
  const summary = $('#date-summary');
  const todayDate = new Date();
  let shown = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const MIN_YEAR = 1901;
  const MAX_YEAR = 2100;
  const VIEW_KEY = 'daymark.calendarView';
  const validViews = ['gregorian', 'lunar', 'combined'];
  let view = 'combined';
  try {
    const savedView = localStorage.getItem(VIEW_KEY);
    if (validViews.includes(savedView)) view = savedView;
  } catch (error) {
    $('#preference-status').textContent = 'View preferences cannot be saved in this browser session.';
  }
  const monthNames = new Intl.DateTimeFormat(undefined, { month:'long' });
  for (let month = 0; month < 12; month++) {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = monthNames.format(new Date(2026, month, 1));
    $('#jump-month').append(option);
  }
  let focusAfterCalendar = false;
  let focusDateKey = null;
  let activeDateKey = null;
  let forceCalendar = false;
  let detailRouteAvailable = false;
  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese-nu-latn', { month: 'long', day: 'numeric' });
  const lunarMonthFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long' });
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
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
  const fmtDate = (d) => new Intl.DateTimeFormat(undefined, { year:'numeric', month:'long', day:'numeric' }).format(d);
  function lunarParts(date) {
    const parts = lunarFormatter.formatToParts(date);
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const dayNumber = Number(parts.find(p => p.type === 'day')?.value);
    return { month, day: lunarDayNames[dayNumber] ?? String(dayNumber) };
  }
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
  function timestampAtLocalNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  }
  function pillarsFor(date) {
    const noon = timestampAtLocalNoon(date);
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
  function renderDayDetails(date) {
    const lunar = lunarParts(date);
    const pillars = pillarsFor(date);
    const weekday = weekdayFormatter.format(date);
    const title = `${weekday}, ${fmtDate(date)}`;
    $('#detail-title').textContent = title;
    document.title = `Daymark Calendar — ${title}`;
    $('#detail-subtitle').textContent = 'Chinese lunar date and traditional calendar markers';
    $('#detail-gregorian').textContent = fmtDate(date);
    $('#detail-weekday').textContent = weekday;
    $('#detail-lunar').textContent = `农历${lunar.month}${lunar.day}`;
    $('#detail-year-pillar').textContent = pillars.year;
    $('#detail-month-pillar').textContent = pillars.month;
    $('#detail-day-pillar').textContent = sexagenaryDay(date);
    const nearbyTerms = [];
    for (let year=date.getFullYear()-1; year<=date.getFullYear()+1; year++) nearbyTerms.push(...termsForYear(year));
    const termOnDate = nearbyTerms.find(term => dateKey(new Date(term.instant)) === dateKey(date));
    const termInfo = $('#detail-solar-term');
    if (termOnDate) {
      const boundaryTime = new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit' }).format(new Date(termOnDate.instant));
      termInfo.textContent = `Solar-term boundary: ${termOnDate.name} (${termOnDate.english}), at approximately ${boundaryTime} local time. The time is an estimate.`;
    } else {
      const boundaryDate = new Date(pillars.term.instant);
      termInfo.textContent = `The current solar-term period began with ${pillars.term.name} (${pillars.term.english}) on ${fmtDate(boundaryDate)}. Solar-term times are estimates.`;
    }
    window.dispatchEvent(new CustomEvent('daymark:day', { detail:dateKey(date) }));
    $('#detail-title').focus();
  }
  function renderPage() {
    const match = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/);
    const detailDate = forceCalendar ? null : dateFromKey(activeDateKey || (match ? match[1] : ''));
    $('#calendar-page').hidden = Boolean(detailDate);
    $('#detail-page').hidden = !detailDate;
    if (detailDate) renderDayDetails(detailDate);
    else {
      document.title = 'Daymark — Gregorian & Chinese Calendar';
      render();
      if (focusAfterCalendar) {
        document.querySelector(`[data-date="${focusDateKey}"]`)?.focus();
        focusAfterCalendar = false;
      }
    }
  }
  function render() {
    monthTitle.textContent = monthFormatter.format(shown);
    $('#jump-month').value = String(shown.getMonth());
    $('#jump-year').value = shown.getFullYear();
    $('#prev').disabled = shown.getFullYear() === MIN_YEAR && shown.getMonth() === 0;
    $('#next').disabled = shown.getFullYear() === MAX_YEAR && shown.getMonth() === 11;
    const thisLunar = lunarParts(todayDate);
    const todayPillars = pillarsFor(todayDate);
    summary.textContent = `Today · ${fmtDate(todayDate)} · ${todayPillars.year} · 农历${lunarMonthFormatter.format(todayDate)}${thisLunar.day} · ${todayPillars.month} · ${sexagenaryDay(todayDate)}`;
    $('#calendar-card').className = `calendar-card ${view === 'gregorian' ? 'greg-only' : ''} ${view === 'lunar' ? 'lunar-only' : ''}`;
    document.querySelectorAll('.view-btn').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const frag = document.createDocumentFragment();
    for (let i=0; i<42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i, 12);
      const outside = date.getMonth() !== shown.getMonth();
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
        cell.setAttribute('aria-description', 'Has a saved note');
      }
      cell.title = 'Open day details';
      cell.setAttribute('aria-label', `${weekdayFormatter.format(date)}, ${fmtDate(date)}, Chinese lunar ${lunar.month}${lunar.day}; traditional calendar markers ${pillars.year}, ${pillars.month}, ${sexagenaryDay(date)}${isToday ? ', today' : ''}`);
      cell.addEventListener('click', () => openDay(date));
      const row = document.createElement('div'); row.className='greg-row';
      const num = document.createElement('span'); num.className='greg-number'; num.textContent=date.getDate(); row.append(num);
      const indicator=document.createElement('span'); indicator.className='open-indicator'; indicator.setAttribute('aria-hidden','true'); indicator.textContent='↗';
      if (isToday) { const label=document.createElement('span'); label.className='today-label'; label.textContent='Today'; row.append(label,indicator); }
      else row.append(indicator);
      const lunarEl=document.createElement('div'); lunarEl.className='lunar';
      if (lunar.day === '初一') {
        const m=document.createElement('span'); m.className='month'; m.textContent=lunar.month;
        const d=document.createElement('span'); d.className='dayname'; d.textContent='初一'; lunarEl.append(m, document.createTextNode(' '), d);
      } else {
        const d=document.createElement('span'); d.className='dayname'; d.textContent=lunar.day; lunarEl.append(d);
      }
      const ganzhiEl=document.createElement('div'); ganzhiEl.className='ganzhi';
      ganzhiEl.title=`年 ${pillars.year} · 月 ${pillars.month} · 日 ${sexagenaryDay(date)}`;
      const yearPillar=document.createElement('b'); yearPillar.textContent=pillars.year;
      const monthPillar=document.createElement('span'); monthPillar.textContent=` · ${pillars.month}`;
      const dayPillar=document.createElement('span'); dayPillar.textContent=` · ${sexagenaryDay(date)}`;
      ganzhiEl.append(yearPillar,monthPillar,dayPillar);
      cell.append(row,lunarEl,ganzhiEl); frag.append(cell);
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
  $('#date-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const date = dateFromKey($('#find-date').value);
    if (!date) return;
    shown = new Date(date.getFullYear(), date.getMonth(), 1);
    openDay(date);
  });
  $('#prev').addEventListener('click', () => { shown = new Date(shown.getFullYear(), shown.getMonth()-1, 1); render(); });
  $('#next').addEventListener('click', () => { shown = new Date(shown.getFullYear(), shown.getMonth()+1, 1); render(); });
  $('#today').addEventListener('click', () => { shown = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1); render(); });
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
      $('#preference-status').textContent = '';
    } catch (error) {
      $('#preference-status').textContent = 'View changed for this session; your browser could not save the preference.';
    }
    render(); }));
  window.addEventListener('popstate', () => { activeDateKey = null; forceCalendar = false; detailRouteAvailable = false; renderPage(); });
  if (!history.state?.view) {
    const directDay = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/);
    activeDateKey = directDay ? directDay[1] : null;
    try { history.replaceState({ view:directDay ? 'day' : 'calendar', fromCalendar:false }, '', location.href); } catch (error) {}
  }
  try { lunarFormatter.format(todayDate); renderPage(); }
  catch (err) { summary.textContent='Your browser does not support Chinese calendar formatting. Try a recent version of Safari, Chrome, Firefox, or Edge.'; daysEl.replaceChildren(); }
})();
