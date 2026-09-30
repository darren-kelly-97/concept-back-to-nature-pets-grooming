(() => {
  const root = document.documentElement;
  root.classList.add('js');

  const OPEN = { 5: [9, 20], 6: [9, 20], 0: [10, 17] };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const clock12 = h => h % 12 || 12;
  const ampm = h => clock12(h) + (h < 12 ? 'am' : 'pm');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const put = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

  function span(m) {
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const n = m % 60;
    const out = [];
    if (d) out.push(plural(d, 'day'));
    if (h) out.push(plural(h, 'hour'));
    if (!d && n) out.push(plural(n, 'minute'));
    return out.join(' ') || 'under a minute';
  }

  function nowInDelaware() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const get = type => (parts.find(p => p.type === type) || {}).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const hour = Number(get('hour')) % 24;
    const minute = Number(get('minute'));
    if (day < 0 || Number.isNaN(hour) || Number.isNaN(minute)) throw new Error('No local time');
    return { day, mins: day * 1440 + hour * 60 + minute };
  }

  function currentState() {
    const { day, mins } = nowInDelaware();
    const today = OPEN[day];
    const base = day * 1440;
    if (today && mins >= base + today[0] * 60 && mins < base + today[1] * 60) {
      return { open: true, day, today, left: base + today[1] * 60 - mins };
    }
    for (let i = 0; i < 8; i++) {
      const d = (day + i) % 7;
      const hrs = OPEN[d];
      if (!hrs) continue;
      const start = (day + i) * 1440 + hrs[0] * 60;
      if (start > mins) return { open: false, day, today, next: { d, i, hrs }, wait: start - mins };
    }
    throw new Error('No opening found');
  }

  const dayWord = (next, short) => {
    if (next.i === 0) return 'today';
    if (next.i === 1) return 'tomorrow';
    return short ? DAYS[next.d].slice(0, 3) : DAYS[next.d];
  };

  function buildWeek(list, today) {
    const items = [];
    for (let i = 0; i < 7; i++) {
      const d = (today + i) % 7;
      const hrs = OPEN[d];
      const li = document.createElement('li');
      li.className = 'day' + (hrs ? ' is-open' : '') + (i ? '' : ' is-today');
      if (!i) li.setAttribute('aria-current', 'date');
      const name = document.createElement('span');
      name.className = 'day-name';
      name.textContent = i ? DAYS[d].slice(0, 3) : 'Today';
      const time = document.createElement('span');
      time.textContent = hrs ? `${clock12(hrs[0])}-${clock12(hrs[1])}` : 'Closed';
      li.append(name, time);
      items.push(li);
    }
    list.replaceChildren(...items);
  }

  function update() {
    let s;
    try { s = currentState(); } catch (e) { return; }
    root.dataset.open = String(s.open);
    const compact = s.open
      ? `Open now, until ${ampm(s.today[1])}`
      : `Closed, opens ${dayWord(s.next, true)} ${ampm(s.next.hrs[0])}`;
    document.querySelectorAll('[data-status-text]').forEach(el => put(el, compact));
    document.querySelectorAll('[data-clock]').forEach(clock => {
      clock.setAttribute('data-ready', '');
      put(clock.querySelector('[data-clock-state]'), s.open ? 'Open now, come on down to Door #2' : 'Closed right now');
      put(clock.querySelector('[data-clock-detail]'), s.open
        ? `Today's hours: ${ampm(s.today[0])} to ${ampm(s.today[1])}. We close in ${span(s.left)}.`
        : `We open again ${dayWord(s.next)} at ${ampm(s.next.hrs[0])}, in ${span(s.wait)}.`);
      const week = clock.querySelector('[data-week]');
      if (week && week.dataset.from !== String(s.day)) {
        buildWeek(week, s.day);
        week.dataset.from = String(s.day);
      }
    });
    document.querySelectorAll('[data-dow]').forEach(el => {
      const isToday = Number(el.dataset.dow) === s.day;
      el.classList.toggle('is-today', isToday);
      if (isToday) el.setAttribute('aria-current', 'date');
      else el.removeAttribute('aria-current');
    });
  }

  update();
  setInterval(update, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });

  const header = document.querySelector('.site-header');
  const menu = document.querySelector('[data-menu]');
  if (header && menu) {
    const setMenu = open => {
      header.classList.toggle('menu-open', open);
      menu.setAttribute('aria-expanded', String(open));
    };
    menu.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && header.classList.contains('menu-open')) {
        setMenu(false);
        menu.focus();
      }
    });
  }

  /* The walk-in: as the hero scrolls away, the corridor pushes toward the
     lit window and its frame opens out to the page edges. No pinning, so the
     hero is always fully visible at load and no blank scroll space is added. */
  const hall = document.querySelector('[data-hall]');
  const PANE = { l: .63, t: .25, r: .85, b: .8 };
  const hdrH = () => (header ? header.offsetHeight : 0);

  function paneRect() {
    const w = hall.clientWidth;
    const h = hall.clientHeight;
    const k = Math.max(w / 1600, h / 1200);
    const iw = 1600 * k;
    const ih = 1200 * k;
    const ox = (w - iw) * .7;
    const oy = (h - ih) * .5;
    const l = ox + PANE.l * iw;
    const t = oy + PANE.t * ih;
    const r = ox + PANE.r * iw;
    const b = oy + PANE.b * ih;
    return { w, h, l, t, pw: r - l, ph: b - t, cx: (l + r) / 2, cy: (t + b) / 2 };
  }

  function walk(undo) {
    const img = hall.querySelector('.hall-photo img');
    const frame = hall.querySelector('.hall-frame');
    if (!img || !frame) return;
    hall.classList.add('is-walking');
    undo.push(() => hall.classList.remove('is-walking'));
    gsap.timeline({
      scrollTrigger: {
        trigger: hall,
        start: () => `top ${hdrH()}px`,
        end: () => `bottom ${hdrH()}px`,
        scrub: .5,
        invalidateOnRefresh: true
      }
    })
      .fromTo(img,
        { scale: 1, x: 0, y: 0, transformOrigin: () => { const g = paneRect(); return `${g.cx}px ${g.cy}px`; } },
        { scale: 2.4, x: () => { const g = paneRect(); return g.w / 2 - g.cx; }, y: () => { const g = paneRect(); return g.h / 2 - g.cy; }, ease: 'none' }, 0)
      .fromTo(frame,
        { left: () => paneRect().l, top: () => paneRect().t, width: () => paneRect().pw, height: () => paneRect().ph },
        { left: 0, top: 0, width: () => hall.clientWidth, height: () => hall.clientHeight, ease: 'power2.inOut' }, 0);
  }

  function nudge() {
    const img = hall.querySelector('.hall-photo img');
    if (!img) return;
    gsap.fromTo(img, { scale: 1.5, transformOrigin: '74% 52%' }, {
      scale: 1.8,
      ease: 'none',
      scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  if (hall && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add({
      wide: '(min-width: 700px) and (prefers-reduced-motion: no-preference)',
      narrow: '(max-width: 699px) and (prefers-reduced-motion: no-preference)'
    }, ctx => {
      const undo = [];
      if (ctx.conditions.wide) walk(undo);
      else nudge();
      return () => undo.forEach(fn => fn());
    });
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();