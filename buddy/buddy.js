/*  Анимированный человечек: следит за курсором, моргает, меняет эмоции и думает вслух.
    Подключение:
      <link rel="stylesheet" href="buddy/buddy.css">
      <div data-vbuddy></div>
      <script src="buddy/phrases.js"></script>
      <script src="buddy/buddy.js"></script>
*/
(function () {
  'use strict';

  const SCRIPT = document.currentScript;
  const BASE = SCRIPT ? SCRIPT.src.replace(/[^/]*$/, '') + 'assets/' : 'buddy/assets/';
  const TOP = 260; // место над головой под облачко

  // Геометрия слоёв (в пикселях исходника 500×1130)
  const G = {
    eyes: {
      L: { box: [155, 266, 245, 329], skin: '#ee9774', skinDark: '#c9705a' },
      R: { box: [309, 277, 393, 341], skin: '#f09c7b', skinDark: '#cb735c' },
    },
    iris: 55,
    brows: { L: [129, 230, 290, 279], R: [290, 233, 426, 286] },
    mouth: [202, 383, 337, 439],
    headPivot: [255, 472],
    face: [120, 200, 400, 470], // зона «личного пространства»
  };

  // Эмоции: брови (сдвиг по Y и поворот), рот, веки, размер зрачка
  const MOODS = {
    neutral:   { L: [0, 0],   R: [0, 0],   mouth: 'neutral', up: .06, low: 0,   iris: 1 },
    smile:     { L: [-2, 0],  R: [-2, 0],  mouth: 'smile',   up: .05, low: .16, iris: 1 },
    happy:     { L: [-6, -2], R: [-6, 2],  mouth: 'grin',    up: .03, low: .32, iris: 1 },
    surprised: { L: [-13, -3],R: [-13, 3], mouth: 'o',       up: 0,   low: 0,   iris: .84 },
    serious:   { L: [4, 8],   R: [4, -8],  mouth: 'flat',    up: .27, low: .06, iris: 1 },
    sad:       { L: [-3, -8], R: [-3, 8],  mouth: 'sad',     up: .3,  low: 0,   iris: 1.04 },
    bored:     { L: [3, 0],   R: [3, 0],   mouth: 'flat',    up: .5,  low: .04, iris: 1 },
    sleep:     { L: [5, 0],   R: [5, 0],   mouth: 'flat',    up: .84, low: .17, iris: 1 },
    thinking:  { L: [-11, -3],R: [1, 3],   mouth: 'flat',    up: .1,  low: 0,   iris: 1, look: [.55, -1] },
    smirk:     { L: [2, 4],   R: [-9, 3],  mouth: 'smile',   up: .14, low: .12, iris: 1 },
  };
  const MOUTHS = ['neutral', 'smile', 'grin', 'sad', 'flat', 'o'];
  // маски глаз встроены прямо в код, чтобы страница работала и при открытии файла с диска
  const EYE_MASK = {
    L: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAAA/CAYAAABgkd/rAAAE70lEQVR4Ae3BvVEbCxsG0PNGK/Ww2WZqQI5MGWpCCZkzxpkzEjVBGdzoqoHNlG0PaKPn04z0DRj/gQDb195zKonJ26skfoLy+4mfqJJ4A+VegxaN38eIAaN78YYqiVdUaNCicdTiEq3fx4BrDI5GDBgdxSurJF5BoUGLDpdoHTVo0fh9jBgwOhpwjQEjBoyIV1JJvEChQYsOl+jQonGv/H7i3ogBIwZcY4cBI+KFKokzFBq06HCJDi0alP+eOBoxYIdr7DBgdBRnqCSeaYYWHS7RoUWD8mcIRgzY4RoDRgzYe6ZK4hnmWOIDOrRoUP5MwYgBIwZ8whZ7xBNVEk80xxJXWGKG8neIoz22+IQdBuw9QSXxBHMscYUl5v5eewzY4RO2uPMDlcQPzLHEFZaYmwR7bPERW9z5jkriO+ZY4gpLzE0eusMWH7HFnW+oJL5hjiWusMTc5GvusMVHbHHnKyqJr5jhHa6wxNzke+6wxUf8i71HKolHCh02eI+5yVPc4R+ssUM8UEk8MsMFNuhQJk8R7LDGLfYeqCQeKHTY4AIzk+fY4xZr7BAnlcQDhQVusECZPEfQY4UecVJJPFBY4AYLlMlzBD1W6BEnlcQDM1xggw5l8hxBjxV6xEklcVLosMEFZibPFeywxi32TiqJk8ICN1igTM6xxy3W2CEOKomTwgI3WKBMzhH0WKFHHFQSJzNcYIMOZXKOoMcKPeKgkjgodNjgAjOTcwU9VugRB5XEQWGBGyxQJucKeqzQIw4qiYPCAjdYoEzOFfRYoUccVBIHhQVusECZnCvosUKPOKgkDgoL3GCBMjlX0GOFHnFQSRwUFrjBAmVyrmCHNW6xd1BJHBQWuMECZfISe9xijR1SSRwUOmxwgZnJSwQ9VuiRSuJkhgts0KFMzhX0WKFHKomTwgI3WKBMzhX0WKFHKomTwgI3WKBMzhX0WKFHKomTQocNLjAzOVfQY4UeqSQemOECG3Qok3MEPVbokUrigcICN1igTM4R9FihRyqJBwodNrjAzOQcQY8VeqSSeGSGC2zQoUyea49brLFDKolHCh02eI+5yXMEO6xxi72DSuIrZniHK7zDzOSp9rjFGjvEQSXxDXO8xwYdyuRHgh3WuMXeSSXxDYUOG7zH3ORH9rjFGjvESSXxHTO8wxWWmJt8S7DDGrfYe6CS+IE5lrjCEnOTr9njFmvsEA9UEk8wxxJXWGJu8lCwwxq32HukkniiOZa4whJzk/+7wz9YY4d4pJJ4hjmWuMISM5S/2x22+Ih/sfcVlcQzzbHEB3RoMfP3CfbY4iO2uPMNlcQZZmjR4QOWmKH8HfYYsMMnbHHnOyqJMxVmWOIDOrRoUP5MwR5bfMIOA/Z+oJJ4oRladLhEhxYNyp8hGDFgh0/YYo94gkriFRQatOhwiQ4tGpT/njgaMWCHa+wwYO8ZKolXVGjQosMlOrRoHJXfVxyNGDBiwDV2GDAinqmSeAOFBi06XKJFgxaNe+XXiXsjBowYcI0BIwaMiDNVEm+o0KBFgxaXaB01aNH4Unk98aURA0ZHA64xYMSA0VG8UCXxE5SjBi0aRy0u0fpcgxaNlxsxYPS5AdcYHI0YMDqKV1RJ/GTlXoMWjc+1uETr5QZcY/C5EQNG9+KNVBK/WPlSgxaNlxsxYPSl+Ekqid9UeT3xi1USk7f3PwWuIaEAEO/DAAAAAElFTkSuQmCC',
    R: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAABACAYAAACELFBMAAAE20lEQVR4Ae3BvXXbBhsG0PtWIHdAhw4LMFU0Bpdgoy6djrp0arQEx2CqcAF07LADier5mCN9x7JiS7Qt/8TGvZXE7O1UEl9R+b7iG6skvoJCgxaN72PCiMm/xVdSSbyhQoMWHa7R+j5G3GH0vgkjJg/iDVUSb6DQoEWHa3Ro0fg+JoyYvG/EHUZMGDF5EF+okvgChQYtOlyjQ4sG5fuKf5swYsKIO4yYMGJCfKZK4jMt0KLDNTq0aFB+bPFgwogJI+5wwIgJ8Ykqic+wxAp/oEOLBuW/Jx5MGHHAHQ4YMSEuVEl8oiVWuMEKC5SfQzBhxAF3OGDEyQUqiU+wxAo3WGHp5xRMGHHAn9jj6BWVxIWWWOEGKyz9/IIT9rjFHkcvqCQusMQKN1hh6ddyxB632OPoIyqJVyyxwg1WWPo1HbHHLfY4+oBK4gVLrHCDFZZ+bUfscYu/cfJMJfERS6xwgxWWZv844i9scEA8UUl8wAK/4QYrLM3+Lzhggx1Onqgknil0uMfvWJo9d8IOGxwQjyqJZxa4wj06lNlzwQEb7HDyqJJ4otDhHldYmH3MCTtscECcVRJPLHCFe3Qos48JBqwxIM4qiUeFDve4wsLsJcGANQbEWSXxqNBjix5l9pJgwBoD4qySeFTosUWPMntJcMAGO5ycVRKPCj226FFmrzlhhw0OSCXxaIEr3KNDmb0mGLDGgFQSZ4UO97jCwuwSwYA1BqSSOCv02KJHmV0iGLDGgFQSZ4UeW/Qos0sEA9YYkErirNBjix5ldolgwBoDUkmcFXps0aPMLhEMWGNAKomzQo8tepTZJYIBawxIJXFW6LFFjzK7RDBgjQGpJM4KPbboUWaXCAasMSCVxFmhxxY9yuwSwYA1BqSSOCv02KJHmV0iGLDGgFQSZ4UeW/Qos0sEA9YYkErirNBjix5ldokTdtjggFQSZ4UeW/Qos9cEB2yww8lZJXFW6HCPKyzMXhMMWGNAnFUSjxa4wj06lNlLggFrDIizSuJRoccWPcrsJSfssMEBcVZJPCp0uMcVFmYfExywwQ4njyqJJxa4wj06lNmHnLDDBgfEo0riiUKHe/yOpdlzwQEb7HDyRCXxzAK/4QYrLM2eOmGHDQ6IJyqJD1hihRussDT7R3DABjucPFNJfMQSK9xghaXZCTtscEA8U0m8YIkVbrDC0q8rOGCDHU4+oJJ4xRIr3GCFpV/TEX9hgwPiAyqJCyyxwg1WWKD8Oo7Y4xZ/4+QjKokLLbHCH+jQokH5uR2xxy32OHpBJfEJFmjR4RodWjQoP58j9rjFHkevqCQ+UaFBiw7X6NCiQfk5HLHHLfY4ukAl8ZkKDVp0uEaHFg3Kf9cRe9xij6MLVRJfqNCgRYdrdGjRoPy3HLHHLfY4+gSVxBspNGjR4RodWjQoP7bghD1uscfRJ6ok3lihQYsO1+jQokH5sQQTRhzwJ/Y4+gyVxFdSaNCiwzU6tGi8U769eDBhxAF3OGDEyWeqJL6yQoMWHa7RetCgReN95W3FOxNGTBhxhwNGTIgvUEl8I4UGLRoPWlyj9U6DFo23MWHE5MGIO4yYMGJCvIFK4hsr7zRo0XinxTVab2PEHUYPJoyYPIg3VEl8Z+V9DVo03saEEZN34iupJH5A5W3FN1JJzN7O/wCVkBmfvzl3lwAAAABJRU5ErkJggg==',
  };

  const P = window.BUDDY_PHRASES || { idle: [{ t: 'Привет!', mood: 'smile' }] };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function el(tag, cls, parent, style) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
  }
  function img(src, cls, parent, box) {
    const i = el('img', cls, parent);
    i.src = (window.BUDDY_INLINE && window.BUDDY_INLINE[src]) || BASE + src; i.alt = ''; i.draggable = false;
    if (box) Object.assign(i.style, {
      position: 'absolute', left: box[0] + 'px', top: box[1] + 'px',
      width: (box[2] - box[0]) + 'px', height: (box[3] - box[1]) + 'px',
    });
    return i;
  }

  function Buddy(root) {
    root.classList.add('vbuddy');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', root.getAttribute('aria-label') || 'Анимированный персонаж');

    const stage = el('div', 'vbuddy__stage', root);
    el('div', 'vbuddy__shadow', stage);
    const lean = el('div', 'vbuddy__lean', stage);
    img('body.webp', 'vbuddy__abs vbuddy__body', lean);
    const head = el('div', 'vbuddy__head', lean);
    img('head.webp', 'vbuddy__abs', head, [0, 0, 500, 1130]);

    // глаза
    const eyes = {};
    for (const s of ['L', 'R']) {
      const g = G.eyes[s], [x0, y0, x1, y1] = g.box, w = x1 - x0, h = y1 - y0;
      const eye = el('div', 'vbuddy__eye', head, {
        left: x0 + 'px', top: y0 + 'px', width: w + 'px', height: h + 'px',
        WebkitMaskImage: `url(${EYE_MASK[s]})`, maskImage: `url(${EYE_MASK[s]})`,
        '--skin': g.skin, '--skin-dark': g.skinDark,
      });
      eye.style.setProperty('--skin', g.skin);
      eye.style.setProperty('--skin-dark', g.skinDark);
      const iris = img('iris.webp', 'vbuddy__iris', eye);
      const up = el('div', 'vbuddy__lid vbuddy__lid--up', eye);
      const low = el('div', 'vbuddy__lid vbuddy__lid--low', eye);
      el('div', 'vbuddy__eyeshade', eye);
      eyes[s] = { eye, iris, up, low, w, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ox: 0, oy: 0 };
    }
    // брови и рот
    const brows = {};
    for (const s of ['L', 'R']) brows[s] = img(`brow${s}.webp`, 'vbuddy__brow', head, G.brows[s]);
    const mouths = {};
    for (const m of MOUTHS) mouths[m] = img(`mouth_${m}.webp`, 'vbuddy__mouth', head, G.mouth);

    const hit = el('div', 'vbuddy__hit', lean);
    hit.setAttribute('aria-hidden', 'true');

    // облачко
    const think = el('div', 'vbuddy__think', stage);
    const cloud = el('div', 'vbuddy__cloud', think);
    for (let i = 0; i < 6; i++) el('i', '', cloud);
    const text = el('div', 'vbuddy__text', cloud);
    text.setAttribute('aria-live', 'polite');
    for (let i = 1; i <= 3; i++) el('div', `vbuddy__dot vbuddy__dot--${i}`, stage);

    // масштаб
    let k = 0.6;
    const fit = () => { k = root.clientWidth / 500; root.style.setProperty('--k', k); };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(root);
    else addEventListener('resize', fit);

    // ---------- состояние
    const touch = matchMedia('(hover: none)').matches;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = {
      px: null, py: null, lastMove: performance.now(), speed: 0,
      mood: 'neutral', baseMood: 'neutral', cur: { ...MOODS.neutral, L: [0, 0], R: [0, 0] },
      blink: 0, nextBlink: performance.now() + rnd(1500, 4000),
      headR: 0, headY: 0, leanR: 0,
      wander: [0, 0], nextWander: 0,
      thinking: false, thinkPrio: 0, thinkUntil: 0, nextIdle: performance.now() + rnd(7000, 10000), nextDream: 0,
      cool: {}, clicks: [], asleep: false, bored: false, away: false,
    };

    let bag = [];
    function nextIdlePhrase() {
      if (!bag.length) bag = (P.idle || []).slice().sort(() => Math.random() - .5);
      return bag.pop();
    }

    function setMood(m) {
      if (!MOODS[m]) m = 'neutral';
      st.mood = m;
      const M = MOODS[m];
      brows.L.style.transform = `translateY(${M.L[0]}px) rotate(${M.L[1]}deg)`;
      brows.R.style.transform = `translateY(${M.R[0]}px) rotate(${M.R[1]}deg)`;
      for (const n of MOUTHS) mouths[n].classList.toggle('is-on', n === M.mouth);
    }
    setMood('neutral');

    // ---------- мысли
    let typeTimer = null, hideTimer = null;
    function say(ph, opts = {}) {
      if (!ph) return false;
      const now = performance.now(), prio = opts.prio || 1;
      if (st.thinking && now < st.thinkUntil && prio < st.thinkPrio) return false;
      clearInterval(typeTimer); clearTimeout(hideTimer);
      st.thinking = true; st.thinkPrio = prio;
      const dur = opts.dur || clamp(1800 + ph.t.length * 70, 2600, 6000);
      st.thinkUntil = now + dur;
      setMood(ph.mood || 'neutral');
      root.classList.add('is-thinking');
      text.textContent = '';
      const caret = el('span', 'vbuddy__caret');
      const chars = Array.from(ph.t); let i = 0;
      const out = document.createTextNode('');
      text.append(out, caret);
      if (reduce) { out.data = ph.t; caret.remove(); }
      else typeTimer = setInterval(() => {
        out.data += chars[i++] || '';
        if (i >= chars.length) { clearInterval(typeTimer); setTimeout(() => caret.remove(), 600); }
      }, 32);
      hideTimer = setTimeout(hide, dur);
      st.nextIdle = now + dur + rnd(5000, 10000);
      return true;
    }
    function hide() {
      clearInterval(typeTimer);
      root.classList.remove('is-thinking');
      st.thinking = false; st.thinkPrio = 0;
      setMood(st.asleep ? 'sleep' : st.bored ? 'bored' : st.baseMood);
    }
    function cooled(key, ms) {
      const now = performance.now();
      if (st.cool[key] && now - st.cool[key] < ms) return false;
      st.cool[key] = now; return true;
    }
    // доступ снаружи: buddy.say('текст', 'happy')
    root.vbuddy = {
      say: (t, mood) => say({ t, mood: mood || 'smile' }, { prio: 5 }),
      mood: (m) => { st.baseMood = m; if (!st.thinking) setMood(m); },
    };

    // ---------- события
    function wake() {
      if (st.asleep) { st.asleep = false; st.bored = false; say(pick(P.wake), { prio: 4 }); }
      else if (st.bored) { st.bored = false; if (!st.thinking) setMood(st.baseMood); }
    }
    let lastT = 0;
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const now = performance.now();
      if (st.px != null && lastT) {
        const dt = Math.max(8, now - lastT);
        const v = Math.hypot(e.clientX - st.px, e.clientY - st.py) / dt * 1000;
        st.speed = lerp(st.speed, v, .25);
      }
      lastT = now;
      st.px = e.clientX; st.py = e.clientY; st.lastMove = now;
      if (st.away) { st.away = false; if (cooled('back', 15000)) say(pick(P.back), { prio: 2 }); }
      wake();
      if (st.speed > 3200 && cooled('fast', 9000)) say(pick(P.fast), { prio: 3 });
      // близко к лицу
      const r = root.getBoundingClientRect();
      const fx = (st.px - r.left) / k, fy = (st.py - r.top) / k - TOP;
      const [a, b, c, d] = G.face;
      if (fx > a && fx < c && fy > b && fy < d && cooled('close', 12000)) say(pick(P.close), { prio: 3 });
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget && !touch) {
        st.away = true;
        if (cooled('leave', 12000)) say(pick(P.leave), { prio: 3 });
      }
    });

    // наведение на ссылки, кнопки и элементы с data-think
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('[data-think], a, button');
      if (!t || root.contains(t)) return;
      if (t.dataset.think) {
        if (cooled('h:' + t.dataset.think, 7000)) say({ t: t.dataset.think, mood: t.dataset.mood || 'smile' }, { prio: 2 });
      } else if (P.hover && cooled('hover', 9000)) say(pick(P.hover), { prio: 1 });
    });

    hit.addEventListener('click', () => {
      const now = performance.now();
      st.clicks = st.clicks.filter((t) => now - t < 2500); st.clicks.push(now);
      wake();
      if (st.clicks.length >= 5) { say(pick(P.spam), { prio: 4 }); st.clicks = []; }
      else say(pick(P.click), { prio: 3 });
      bump = 1;
    });

    let lastScroll = scrollY, lastScrollT = performance.now();
    addEventListener('scroll', () => {
      const now = performance.now(), dt = Math.max(16, now - lastScrollT);
      const v = Math.abs(scrollY - lastScroll) / dt * 1000;
      lastScroll = scrollY; lastScrollT = now;
      if (v > 2500 && cooled('scroll', 12000)) say(pick(P.scroll), { prio: 2 });
    }, { passive: true });

    document.addEventListener('copy', () => { if (P.copy && cooled('copy', 8000)) say(pick(P.copy), { prio: 3 }); });

    // приветствие
    setTimeout(() => {
      const h = new Date().getHours();
      const key = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';
      if (P.hello && P.hello[key]) say(P.hello[key], { prio: 2 });
    }, 900);

    // ---------- анимационный цикл
    let bump = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      const r = root.getBoundingClientRect();

      // тишина / скука / сон (только на десктопе)
      if (!touch) {
        const still = now - st.lastMove;
        if (!st.bored && still > 30000) { st.bored = true; say(pick(P.bored), { prio: 2 }); }
        if (!st.asleep && still > 90000) { st.asleep = true; st.nextDream = now + 15000; say(pick(P.sleep), { prio: 2, dur: 3500 }); }
        if (st.asleep && !st.thinking && P.dream && now > st.nextDream) { st.nextDream = now + rnd(18000, 28000); say(pick(P.dream), { prio: 1, dur: 3800 }); }
        if (st.asleep && !st.thinking) setMood('sleep');
      }
      // случайные мысли
      if (!st.thinking && !st.asleep && now > st.nextIdle) say(nextIdlePhrase(), { prio: 1 });
      st.speed *= .96;

      // куда смотрим: точка в координатах экрана
      let tx, ty;
      const M = MOODS[st.mood];
      if (M.look) {
        tx = r.left + (250 + M.look[0] * 300) * k; ty = r.top + (TOP + 300 + M.look[1] * 300) * k;
      } else if (touch || st.px == null) {
        if (now > st.nextWander) {
          st.wander = Math.random() < .35 ? [0, .2] : [rnd(-1, 1), rnd(-.6, .9)];
          st.nextWander = now + rnd(1400, 4200);
        }
        tx = r.left + (250 + st.wander[0] * 400) * k; ty = r.top + (TOP + 300 + st.wander[1] * 300) * k;
      } else { tx = st.px; ty = st.py; }

      // зрачки
      const ease = M.look || touch ? .12 : .3;
      let gazeY = 0;
      for (const s of ['L', 'R']) {
        const E = eyes[s];
        const ex = r.left + E.cx * k, ey = r.top + (TOP + E.cy) * k;
        const vx = tx - ex, vy = ty - ey, d = Math.hypot(vx, vy) || 1;
        const mag = clamp(d / (170 * Math.max(k, .4)), 0, 1);
        E.ox = lerp(E.ox, vx / d * mag * 20, ease);
        E.oy = lerp(E.oy, vy / d * mag * 9, ease);
        gazeY += E.oy / 9 / 2;
        const sc = st.cur.iris;
        E.iris.style.transform =
          `translate(${E.cx - G.eyes[s].box[0] - G.iris / 2 + E.ox}px, ${E.cy - G.eyes[s].box[1] - G.iris / 2 + E.oy}px) scale(${sc})`;
      }

      // моргание
      if (now > st.nextBlink) {
        st.blinkStart = now; st.nextBlink = now + rnd(2200, 5800);
        st.double = Math.random() < .18;
      }
      if (st.blinkStart) {
        const t = now - st.blinkStart;
        let b = t < 70 ? t / 70 : t < 110 ? 1 : t < 220 ? 1 - (t - 110) / 110 : 0;
        if (t >= 220) { st.blinkStart = st.double ? now + 80 : 0; st.double = false; b = 0; }
        st.blink = b;
      }

      // плавно ведём параметры эмоции
      const C = st.cur;
      C.up = lerp(C.up, M.up, .15); C.low = lerp(C.low, M.low, .15); C.iris = lerp(C.iris, M.iris, .15);
      const up = clamp(C.up + Math.max(0, gazeY) * .1 - Math.max(0, -gazeY) * .05, 0, 1);
      // при моргании верхнее веко опускается до ~84%, нижнее чуть поднимается навстречу
      const upF = clamp(up + st.blink * (.84 - up), 0, 1);
      const lowF = C.low + st.blink * Math.max(0, .18 - C.low);
      for (const s of ['L', 'R']) {
        eyes[s].up.style.transform = `translateY(${upF * 50}%)`;
        eyes[s].low.style.transform = `translateY(${-lowF * 50}%)`;
      }

      // голова и корпус
      const hcx = r.left + 255 * k, hcy = r.top + (TOP + 300) * k;
      const nx = clamp((tx - hcx) / (innerWidth * .45), -1, 1);
      const ny = clamp((ty - hcy) / (innerHeight * .5), -1, 1);
      const breathe = reduce ? 0 : Math.sin(now / 1000 * Math.PI * 2 / 3.8);
      bump *= .9;
      st.headR = lerp(st.headR, nx * 4.5 + (st.mood === 'thinking' ? 3 : 0) + (st.mood === 'sad' ? -2 : 0), .08);
      st.headY = lerp(st.headY, ny * 4, .08);
      st.leanR = lerp(st.leanR, nx * 1.2, .05);
      head.style.transform =
        `translate(${nx * 3}px, ${st.headY + breathe * 2 - bump * 10}px) rotate(${st.headR + Math.sin(now / 60) * bump * 3}deg)`;
      lean.style.transform = `rotate(${st.leanR}deg) scaleY(${1 + breathe * .004})`;
    }
    requestAnimationFrame(frame);
  }

  function init() {
    document.querySelectorAll('[data-vbuddy]').forEach((n) => { if (!n.vbuddy) Buddy(n); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
