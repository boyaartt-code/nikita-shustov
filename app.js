(function () {
  'use strict';
  const S = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const buddy = () => ($('[data-vbuddy]') || {}).vbuddy;
  const think = (p) => { const b = buddy(); if (b && p) b.say(p.t, p.mood); };

  // ---------- текст на буквы для волновой анимации
  function split(el) {
    const txt = el.textContent.trim();
    el.setAttribute('aria-label', txt);
    el.innerHTML = '';
    let i = 0;
    for (const ch of txt) {
      const s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      if (ch === ' ') s.className = 'sp';
      else { s.className = 'ch'; s.textContent = ch; s.style.setProperty('--i', i++); }
      el.appendChild(s);
    }
  }

  // ---------- имущество
  const prop = $('#property');
  (S.property || []).forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'prop';
    card.dataset.think = p.think || '';
    card.dataset.mood = p.mood || 'smile';
    card.innerHTML = `
      <h3 class="prop__title" data-split>${esc(p.title)}</h3>
      <div class="prop__fig" style="--d:${-idx * 1.6}s">
        <img class="prop__img" src="${esc(p.img)}" alt="${esc(p.title)}" style="--d:${-idx * 1.6}s">
      </div>`;
    const img = card.querySelector('img');
    img.addEventListener('error', () => {
      img.replaceWith(Object.assign(document.createElement('div'), {
        className: 'prop__ph', innerHTML: `3D-картинка<br>${esc(p.img)}`,
      }));
    });
    // лёгкий 3D-наклон картинки за курсором
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.setProperty('--ry', (x * 22).toFixed(1) + 'deg');
      card.style.setProperty('--rx', (-y * 14).toFixed(1) + 'deg');
      const i = card.querySelector('.prop__img');
      if (i) { i.style.setProperty('--ry', (x * 22).toFixed(1) + 'deg'); i.style.setProperty('--rx', (-y * 14).toFixed(1) + 'deg'); }
    });
    card.addEventListener('pointerleave', () => {
      const i = card.querySelector('.prop__img');
      if (i) { i.style.setProperty('--ry', '0deg'); i.style.setProperty('--rx', '0deg'); }
    });
    prop.appendChild(card);
  });

  document.querySelectorAll('[data-split]').forEach(split);

  // лёгкий параллакс фона за курсором
  const decor = $('.decor');
  if (decor && matchMedia('(hover: hover)').matches) {
    addEventListener('pointermove', (e) => {
      decor.style.setProperty('--mx', ((e.clientX / innerWidth) - .5).toFixed(3));
      decor.style.setProperty('--my', ((e.clientY / innerHeight) - .5).toFixed(3));
    }, { passive: true });
  }

  // «имущество» в меню: плавно показываем колонку и подсвечиваем её
  const propLink = $('[data-property]');
  if (propLink) propLink.addEventListener('click', (e) => {
    e.preventDefault();
    prop.scrollIntoView({ behavior: 'smooth', block: 'start' });
    prop.classList.remove('is-flash'); void prop.offsetWidth; prop.classList.add('is-flash');
    think({ t: 'Моё самое ценное — вот оно', mood: 'smile' });
  });


  // =====================================================================
  //  ДАННЫЕ: общий сервер (Google Apps Script) или, если он не подключён, этот браузер
  // =====================================================================
  const API = String(S.api || '').trim();
  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  };
  const shared = {
    ready: !API,
    error: null,
    events: API ? ls.get('ns_cache_events', []) : ls.get('ns_events_v1', []),
    notes: API ? ls.get('ns_cache_notes', []) : ls.get('ns_notes_v2', (S.notes || []).map((n, i) => ({ id: 'n' + i, ...n }))),
  };
  let pin = ls.get('ns_pin', '');
  const canEdit = () => !API || !!pin;

  async function apiGet(params) {
    const r = await fetch(API + '?' + new URLSearchParams(params), { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function apiPost(body) {
    const r = await fetch(API, { method: 'POST', body: JSON.stringify({ pin, ...body }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function applyShared(d) {
    shared.events = d.events || []; shared.notes = d.notes || []; shared.ready = true; shared.error = null;
    ls.set('ns_cache_events', shared.events); ls.set('ns_cache_notes', shared.notes);
  }
  async function loadShared() {
    if (!API) return;
    try { const d = await apiGet({ action: 'all' }); if (d.ok) applyShared(d); else throw new Error(d.error); }
    catch (err) { shared.error = String(err); }
    rerender();
  }
  // универсальная запись: на сервер или локально
  async function write(body) {
    if (!API) {
      if (body.action === 'addEvent') shared.events.push({ id: Date.now().toString(36), date: body.date, time: body.time, title: body.title });
      if (body.action === 'delEvent') shared.events = shared.events.filter((e) => e.id !== body.id);
      if (body.action === 'saveNote') {
        if (body.id) shared.notes = shared.notes.map((n) => (n.id === body.id ? { ...n, title: body.title, text: body.text } : n));
        else shared.notes.push({ id: Date.now().toString(36), title: body.title, text: body.text });
      }
      if (body.action === 'delNote') shared.notes = shared.notes.filter((n) => n.id !== body.id);
      ls.set('ns_events_v1', shared.events); ls.set('ns_notes_v2', shared.notes);
      rerender();
      return true;
    }
    if (!pin) { ui.needPin = true; rerender(); return false; }
    ui.busy = true; rerender();
    try {
      const d = await apiPost(body);
      if (!d.ok && d.error === 'pin') { pin = ''; ls.set('ns_pin', ''); ui.needPin = true; ui.pinError = 'PIN не подошёл'; return false; }
      if (!d.ok) throw new Error(d.error);
      applyShared(d); return true;
    } catch (err) { ui.toast = 'Не удалось сохранить. Проверьте интернет.'; return false; }
    finally { ui.busy = false; rerender(); }
  }

  // =====================================================================
  //  ФУТБОЛ
  // =====================================================================
  const OLDB = 'https://api.openligadb.de';
  const now0 = new Date();
  const SEASON = now0.getMonth() >= 6 ? now0.getFullYear() : now0.getFullYear() - 1;
  const isBayern = (n) => /bayern/i.test(n || '') && !/frauen|ii\b|amateure/i.test(n || '');
  const COMP = { BL: 'Бундеслига', CL: 'Лига чемпионов', DFB: 'Кубок Германии' };
  const COMP_SHORT = { BL: 'БЛ', CL: 'ЛЧ', DFB: 'Кубок' };
  let fb = { state: 'idle', data: null };

  const ruRound = (g) => String(g || '')
    .replace(/(\d+)\.\s*Spieltag/i, '$1-й тур').replace(/(\d+)\.\s*Runde/i, '$1-й раунд')
    .replace(/Achtelfinale/i, '1/8 финала').replace(/Viertelfinale/i, '1/4 финала')
    .replace(/Halbfinale/i, '1/2 финала').replace(/^Finale$/i, 'Финал').replace(/Ligaphase/i, 'Общий этап');
  // турниры в OpenLigaDB: для каждого несколько возможных ярлыков, берём тот, где есть настоящее расписание
  const SOURCES = [
    { comp: 'BL', shortcuts: ['bl1'] },
    { comp: 'DFB', shortcuts: ['dfb', `dfb${SEASON}`] },
    { comp: 'CL', shortcuts: ['ucl', `ucl${SEASON}`] },
  ];
  async function getJSON(url) {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 15000);
    try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(tm); }
  }
  function toMatches(list, comp) {
    return list.filter((x) => isBayern(x.team1 && x.team1.teamName) || isBayern(x.team2 && x.team2.teamName)).map((x) => {
      const home = isBayern(x.team1.teamName), opp = home ? x.team2 : x.team1;
      const res = (x.matchResults || []).find((r) => r.resultTypeID === 2) || (x.matchResults || []).slice(-1)[0];
      return {
        id: comp + x.matchID, comp, utc: x.matchDateTimeUTC || x.matchDateTime, home, opp: opp.shortName || opp.teamName,
        round: ruRound(x.group && x.group.groupName), done: !!x.matchIsFinished,
        our: res ? (home ? res.pointsTeam1 : res.pointsTeam2) : null, their: res ? (home ? res.pointsTeam2 : res.pointsTeam1) : null,
      };
    });
  }
  async function loadComp(src) {
    let best = null;
    for (const sc of src.shortcuts) {
      try {
        const ms = toMatches(await getJSON(`${OLDB}/getmatchdata/${sc}/${SEASON}`), src.comp);
        const score = new Set(ms.map((m) => m.utc)).size; // у «заготовок» все матчи на одну дату
        if (!best || score > best.score) best = { ms, score };
      } catch (e) { /* пробуем следующий ярлык */ }
    }
    return best && best.ms.length ? best.ms : null;
  }
  async function loadFootballDirect() {
    const [lists, table] = await Promise.all([
      Promise.all(SOURCES.map(loadComp)),
      getJSON(`${OLDB}/getbltable/bl1/${SEASON}`).catch(() => null),
    ]);
    const comps = {}; let matches = [];
    lists.forEach((ms, i) => { if (ms) { comps[SOURCES[i].comp] = true; matches = matches.concat(ms); } });
    if (!matches.length) throw new Error('нет данных');
    matches.sort((a, b) => new Date(a.utc) - new Date(b.utc));
    const i = table ? table.findIndex((t) => isBayern(t.teamName)) : -1;
    return { matches, row: i >= 0 ? { place: i + 1, ...table[i] } : null, comps };
  }
  async function loadFootball() {
    if (fb.state === 'loading') return;
    const c = ls.get('ns_fcb_v3', null);
    if (c && Date.now() - c.t < 15 * 60 * 1000) { fb = { state: 'ok', data: c.data }; afterFootball(); return; }
    fb = { state: 'loading' };
    try {
      const data = await loadFootballDirect();
      fb = { state: 'ok', data };
      ls.set('ns_fcb_v3', { t: Date.now(), data });
    } catch (err) {
      fb = c ? { state: 'ok', data: c.data, stale: true } : { state: 'error' };
    }
    afterFootball();
  }
  function afterFootball() { if (current === 'football' || current === 'calendar') rerender(); }

  // =====================================================================
  //  РАЗМЕТКА ОКОН
  // =====================================================================
  const modal = $('#modal'), mTitle = $('#modal-title'), mBody = $('#modal-body');
  let lastFocus = null, current = null;
  const ui = { needPin: false, pinError: '', busy: false, toast: '', editNote: null };
  const TITLES = { football: 'Бавария', calendar: 'Календарь', notes: 'Заметки' };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDate = (d) => d.toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  const fmtTime = (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const matchTitle = (x) => (x.home ? `Бавария — ${x.opp}` : `${x.opp} — Бавария`);
  const I = {
    left: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    del: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  };

  function syncLine() {
    if (!API) return '<p class="sync">Сохраняется только в этом браузере — общий сервер не подключён (см. README).</p>';
    if (shared.error) return '<p class="sync sync--warn">Нет связи с сервером — показаны последние сохранённые данные.</p>';
    return `<p class="sync">${shared.ready ? 'Общий доступ · видно на всех устройствах' : 'Загружаю…'}${pin ? '' : ` · <button class="sync__pin" data-askpin>${I.lock} войти для изменений</button>`}</p>`;
  }
  function pinPanel() {
    if (!ui.needPin) return '';
    return `<form class="pin" data-pinform autocomplete="off">
      <div class="pin__t">${I.lock} Изменения доступны только по PIN-коду</div>
      <div class="pin__row"><input class="cal__in" name="pin" type="password" inputmode="numeric" placeholder="PIN" aria-label="PIN-код" required>
      <button class="cal__add" type="submit">Войти</button></div>
      ${ui.pinError ? `<div class="pin__err">${esc(ui.pinError)}</div>` : ''}
    </form>`;
  }

  // ---------- календарь: собираем все события на день
  function eventsFor(ds) {
    const md = ds.slice(5);
    const out = [];
    (S.events || []).forEach((e) => {
      if (e.date === ds || (e.repeat === 'yearly' && e.date.slice(5) === md && e.date.slice(0, 4) <= ds.slice(0, 4))) {
        out.push({ ...e, kind: e.kind || 'special', fixed: true });
      }
    });
    shared.events.forEach((e) => { if (e.date === ds) out.push({ ...e, kind: 'user' }); });
    if (fb.data) fb.data.matches.forEach((x) => {
      const d = new Date(x.utc);
      if (ymd(d) === ds) {
        out.push({
          kind: 'match', fixed: true, time: fmtTime(d), comp: x.comp,
          title: matchTitle(x) + (x.done && x.our != null ? ` · ${x.home ? x.our + ':' + x.their : x.their + ':' + x.our}` : ''),
        });
      }
    });
    return out.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  let calDate = new Date(); calDate.setDate(1);
  let selDay = ymd(new Date());
  function renderCal() {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const shift = (first.getDay() + 6) % 7, todayS = ymd(new Date());
    const month = first.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
    let cells = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => `<div class="cal__wd">${d}</div>`).join('');
    for (let i = 0; i < shift; i++) cells += '<div class="cal__d is-empty"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`, list = eventsFor(ds);
      const kinds = new Set(list.map((e) => e.kind));
      const cls = ['cal__d', ds === todayS && 'is-today', ds === selDay && 'is-sel', kinds.has('special') && 'has-special'].filter(Boolean).join(' ');
      const dots = ['special', 'match', 'user'].filter((k) => kinds.has(k)).map((k) => `<i class="dot dot--${k}"></i>`).join('');
      cells += `<button class="${cls}" data-day="${ds}" aria-label="${d} ${month}${list.length ? ', событий: ' + list.length : ''}">${kinds.has('special') ? '<span class="cal__heart">♥</span>' : ''}${d}${dots ? `<span class="dots">${dots}</span>` : ''}</button>`;
    }
    const sel = new Date(selDay + 'T12:00:00');
    const dayEvs = eventsFor(selDay);
    const evList = dayEvs.length
      ? `<ul class="cal__events">${dayEvs.map((e) => `
          <li class="cal__ev is-${e.kind}">
            <b>${esc(e.time || (e.kind === 'special' ? '♥' : 'весь день'))}</b>
            <span>${e.kind === 'match' ? `<em class="comp comp--${e.comp}">${COMP_SHORT[e.comp] || ''}</em>` : ''}${esc(e.title)}</span>
            ${e.kind === 'user' && canEdit() ? `<button class="cal__del" data-del="${esc(e.id)}" aria-label="Удалить событие">${I.del}</button>` : ''}
          </li>`).join('')}</ul>`
      : '<p class="cal__none">Событий нет</p>';
    return `${pinPanel()}
      <div class="cal__top">
        <div class="cal__month">${month}</div>
        <div class="cal__nav">
          <button class="cal__btn" data-cal="-1" aria-label="Предыдущий месяц">${I.left}</button>
          <button class="cal__btn" data-cal="1" aria-label="Следующий месяц">${I.right}</button>
        </div>
      </div>
      <div class="cal__grid">${cells}</div>
      <div class="cal__legend"><span><i class="dot dot--special"></i>особые даты</span><span><i class="dot dot--match"></i>матчи «Баварии»</span><span><i class="dot dot--user"></i>события</span></div>
      <div class="cal__day">
        <h3 class="cal__dayt">${esc(sel.toLocaleString('ru-RU', { day: 'numeric', month: 'long' }))}</h3>
        ${evList}
        <form class="cal__form" data-addform autocomplete="off">
          <input class="cal__in" name="title" placeholder="Новое событие…" maxlength="120" required aria-label="Название события">
          <input class="cal__in cal__time" name="time" type="time" aria-label="Время">
          <button class="cal__add" type="submit" ${ui.busy ? 'disabled' : ''}>${I.plus}<span>Добавить</span></button>
        </form>
        ${syncLine()}
      </div>`;
  }

  // ---------- заметки
  function noteForm(n) {
    return `<form class="note note--form" data-noteform="${esc(n ? n.id : '')}" autocomplete="off">
      <input class="note__in" name="title" placeholder="Заголовок" maxlength="80" value="${esc(n ? n.title : '')}" required>
      <textarea class="note__ta" name="text" placeholder="Текст заметки" maxlength="2000" rows="4">${esc(n ? n.text : '')}</textarea>
      <div class="note__btns"><button class="cal__add" type="submit" ${ui.busy ? 'disabled' : ''}>Сохранить</button>
      <button class="note__cancel" type="button" data-notecancel>Отмена</button></div>
    </form>`;
  }
  function renderNotes() {
    const items = shared.notes.map((n) => (ui.editNote === n.id ? noteForm(n) : `
      <article class="note"><h3 class="note__t">${esc(n.title)}</h3><p class="note__x">${esc(n.text)}</p>
        ${canEdit() ? `<div class="note__tools"><button data-noteedit="${esc(n.id)}" aria-label="Редактировать">${I.edit}</button>
        <button data-notedel="${esc(n.id)}" aria-label="Удалить">${I.del}</button></div>` : ''}
      </article>`)).join('');
    const add = ui.editNote === 'new' ? noteForm(null) : `<button class="note note--add" data-noteadd>${I.plus}<span>Новая заметка</span></button>`;
    return `${pinPanel()}<div class="notes">${items}${add}</div>${syncLine()}`;
  }

  // ---------- бавария
  function countdown(d) {
    const ms = d - Date.now(); if (ms <= 0) return 'идёт сейчас';
    const days = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), mi = Math.floor(ms % 36e5 / 6e4);
    return days > 0 ? `через ${days} д ${h} ч` : `через ${h} ч ${mi} мин`;
  }
  function renderFootball() {
    if (fb.state === 'loading' || fb.state === 'idle') return '<div class="fb__load"><span class="fb__ball"></span>Загружаю свежие данные…</div>';
    if (fb.state === 'error') return `<div class="fb__err"><p>Не получилось загрузить данные о матчах. Проверьте интернет и попробуйте ещё раз.</p><p class="fb__src">Внутри предпросмотра Claude внешние данные не загружаются — откройте сайт в обычном браузере.</p><button class="fb__retry" data-fb-retry>Обновить</button></div>`;
    const { matches, row, comps = {} } = fb.data;
    const LIVE = 2.5 * 36e5;
    const up = matches.filter((x) => !x.done && new Date(x.utc) > Date.now() - LIVE).slice(0, 6);
    const past = matches.filter((x) => x.done).slice(-5).reverse();
    const next = up[0];
    const res = (x) => (x.our > x.their ? 'w' : x.our < x.their ? 'l' : 'd');
    const badge = (x) => `<em class="comp comp--${x.comp}">${COMP_SHORT[x.comp] || ''}</em>`;
    const stats = row ? `
      <div class="fb__stats">
        <div class="fb__stat fb__stat--big"><b>${row.place}</b><span>место в БЛ</span></div>
        <div class="fb__stat"><b>${row.points}</b><span>очков</span></div>
        <div class="fb__stat"><b>${row.matches}</b><span>игр</span></div>
        <div class="fb__stat"><b>${row.won}-${row.draw}-${row.lost}</b><span>в-н-п</span></div>
        <div class="fb__stat"><b>${row.goals}:${row.opponentGoals}</b><span>мячи</span></div>
      </div>` : '';
    const nextCard = next ? (() => {
      const d = new Date(next.utc);
      return `<div class="fb__next">
        <div class="fb__label">Следующий матч · ${esc(COMP[next.comp] || '')}${next.round ? ' · ' + esc(next.round) : ''}</div>
        <div class="fb__vs"><span>${next.home ? 'Бавария' : esc(next.opp)}</span><i>vs</i><span>${next.home ? esc(next.opp) : 'Бавария'}</span></div>
        <div class="fb__when">${fmtDate(d)}, ${fmtTime(d)} · <b>${countdown(d)}</b> · ${next.home ? 'дома' : 'в гостях'}</div>
        <div class="fb__auto">✓ уже в календаре</div>
      </div>`;
    })() : '<div class="fb__next"><div class="fb__label">Ближайших матчей пока нет</div></div>';
    const upList = up.slice(1).map((x) => { const d = new Date(x.utc); return `
      <li class="fb__row"><span class="fb__date">${fmtDate(d)}<small>${fmtTime(d)}</small></span>${badge(x)}
      <span class="fb__teams">${esc(matchTitle(x))}</span></li>`; }).join('');
    const pastList = past.map((x) => { const r = res(x), d = new Date(x.utc); return `
      <li class="fb__row"><span class="fb__date">${fmtDate(d)}</span>${badge(x)}<span class="fb__teams">${esc(matchTitle(x))}</span>
      <span class="fb__score fb__score--${r}">${x.home ? `${x.our}:${x.their}` : `${x.their}:${x.our}`}<em>${{ w: 'В', d: 'Н', l: 'П' }[r]}</em></span></li>`; }).join('');
    const compList = ['BL', 'CL', 'DFB'].map((k) => `<span class="${comps[k] ? '' : 'is-off'}">${COMP[k]}${comps[k] ? '' : ' — нет данных'}</span>`).join(' · ');
    return `${stats}${nextCard}
      ${upList ? `<h3 class="fb__h">Дальше</h3><ul class="fb__list">${upList}</ul>` : ''}
      ${pastList ? `<h3 class="fb__h">Последние результаты</h3><ul class="fb__list">${pastList}</ul>` : ''}
      <p class="fb__src">Сезон ${SEASON}/${String(SEASON + 1).slice(2)} · ${compList}${fb.stale ? ' · показаны сохранённые данные' : ''}<br>Все предстоящие матчи автоматически отмечены в календаре.</p>`;
  }

  const RENDER = { football: renderFootball, calendar: renderCal, notes: renderNotes };
  function rerender() {
    if (!current) return;
    const keep = document.activeElement && mBody.contains(document.activeElement) && document.activeElement.name;
    const scroll = mBody.scrollTop;
    mBody.innerHTML = RENDER[current]() + (ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : '');
    mBody.scrollTop = scroll;
    if (keep) { const el = mBody.querySelector(`[name="${keep}"]`); if (el) el.focus({ preventScroll: true }); }
    if (ui.toast) setTimeout(() => { ui.toast = ''; }, 3000);
  }

  function open(kind) {
    lastFocus = document.activeElement;
    current = kind; ui.needPin = false; ui.pinError = ''; ui.editNote = null;
    mTitle.textContent = TITLES[kind];
    modal.dataset.kind = kind;
    rerender();
    modal.hidden = false;
    document.body.classList.add('has-modal');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    $('.modal__close', modal).focus({ preventScroll: true });
    think((S.popupThoughts || {})[kind]);
    if ((kind === 'calendar' || kind === 'notes') && API) loadShared();
    if ((kind === 'football' || kind === 'calendar') && fb.state !== 'ok') loadFootball().then(() => {
      if (current !== 'football' || fb.state !== 'ok') return;
      const last = fb.data.matches.filter((x) => x.done).slice(-1)[0];
      if (last) setTimeout(() => think(last.our > last.their ? { t: 'Последний матч выиграли. Mia san mia!', mood: 'happy' }
        : last.our < last.their ? { t: 'Последний матч проиграли… Отыграемся', mood: 'sad' } : { t: 'Ничья. Ну такое', mood: 'serious' }), 1800);
    });
  }
  function close() {
    modal.classList.remove('is-open');
    current = null;
    setTimeout(() => { if (!current) { modal.hidden = true; document.body.classList.remove('has-modal'); } }, 380);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));

  modal.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) return close();
    const c = t.closest('[data-cal]');
    if (c) { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + +c.dataset.cal, 1); return rerender(); }
    const day = t.closest('[data-day]');
    if (day) { selDay = day.dataset.day; return rerender(); }
    if (t.closest('[data-askpin]')) { ui.needPin = true; rerender(); const i = $('[name=pin]', mBody); if (i) i.focus(); return; }
    const del = t.closest('[data-del]');
    if (del) return write({ action: 'delEvent', id: del.dataset.del });
    if (t.closest('[data-noteadd]')) { if (!canEdit()) { ui.needPin = true; return rerender(); } ui.editNote = 'new'; rerender(); const i = $('.note__in', mBody); if (i) i.focus(); return; }
    const ne = t.closest('[data-noteedit]');
    if (ne) { ui.editNote = ne.dataset.noteedit; return rerender(); }
    if (t.closest('[data-notecancel]')) { ui.editNote = null; return rerender(); }
    const nd = t.closest('[data-notedel]');
    if (nd && confirm('Удалить заметку?')) return write({ action: 'delNote', id: nd.dataset.notedel });
    if (t.closest('[data-fb-retry]')) { fb.state = 'idle'; ls.set('ns_fcb_v3', null); open('football'); }
  });
  modal.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.matches('[data-pinform]')) {
      const val = f.pin.value.trim(); if (!val) return;
      ui.busy = true; rerender();
      try {
        const d = await apiPost({ action: 'checkpin', pin: val });
        if (d.ok) { pin = val; ls.set('ns_pin', val); ui.needPin = false; ui.pinError = ''; think({ t: 'Доступ открыт. Пиши что хочешь', mood: 'smile' }); }
        else ui.pinError = 'PIN не подошёл';
      } catch (err) { ui.pinError = 'Нет связи с сервером'; }
      ui.busy = false; return rerender();
    }
    if (f.matches('[data-addform]')) {
      const title = f.title.value.trim(); if (!title) return;
      if (await write({ action: 'addEvent', date: selDay, time: f.time.value || '', title })) think({ t: 'Записал в календарь!', mood: 'smile' });
      return;
    }
    if (f.matches('[data-noteform]')) {
      const title = f.title.value.trim(); if (!title) return;
      const ok = await write({ action: 'saveNote', id: f.dataset.noteform || '', title, text: f.text.value });
      if (ok) { ui.editNote = null; rerender(); think({ t: 'Записал, чтобы не забыть', mood: 'smile' }); }
    }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  // заранее подгружаем матчи и общие данные, чтобы окна открывались мгновенно
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn) : setTimeout(fn, 1500));
  idle(() => { loadFootball(); loadShared(); });

  // особый день сегодня? человечек поздравляет
  const todays = (S.events || []).filter((e) => e.repeat === 'yearly' ? e.date.slice(5) === ymd(new Date()).slice(5) : e.date === ymd(new Date()));
  if (todays.length) setTimeout(() => think({ t: todays[0].title.replace(/^День рождения/, 'С днём рождения,').replace(/^Годовщина/, 'Сегодня годовщина'), mood: 'happy' }), 4200);
})();
