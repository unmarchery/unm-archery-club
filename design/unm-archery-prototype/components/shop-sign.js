// Neon ASCII sign: <div class="sign" data-sign data-tag="01 · ON THE RANGE"><h2 class="sign__title">Events</h2></div>
// Builds an ASCII frame around the title, powers it on once when scrolled into view,
// then shorts out a letter or a stretch of frame every 6–14s with a small shower of sparks.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAD_X = 3, PAD_Y = 2;                 // frame padding in cells
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeSign(root) {
    const title = root.querySelector('.sign__title');
    const text = title.textContent.trim().replace(/\s+/g, ' ');
    const tag = root.dataset.tag ? `[ ${root.dataset.tag} ]` : '';
    title.setAttribute('aria-label', text);
    title.innerHTML = `<span aria-hidden="true">${text.split(' ').map((w) =>
      `<span class="sign__word" style="display:inline-block;white-space:nowrap">${[...w].map((c) => `<span class="sign__ch">${c}</span>`).join('')}</span>`
    ).join(' ')}</span>`;
    const letters = [...title.querySelectorAll('.sign__ch')];

    const frame = document.createElement('pre');
    frame.className = 'sign__frame'; frame.setAttribute('aria-hidden', 'true');
    root.prepend(frame);
    const sparks = document.createElement('canvas');
    sparks.className = 'sign__sparks'; sparks.setAttribute('aria-hidden', 'true');
    root.append(sparks);
    const sctx = sparks.getContext('2d');

    let chars = [], lit = false, visible = false, timer = 0;

    /* ---------- frame ---------- */
    // min: grow to a shared size so every sign on the page matches; returns this sign's natural size
    let natural = { cols: 0, rows: 0 };
    function build(min = { cols: 0, rows: 0 }) {
      frame.innerHTML = '<span>MMMMMMMMMM</span>';
      const pr = frame.firstChild.getBoundingClientRect();
      const cw = pr.width / 10 || 8, lh = pr.height || 16;
      root.style.width = root.style.height = '';
      const avail = root.parentElement.clientWidth;
      title.style.maxWidth = `${Math.max(120, avail - (PAD_X * 2 + 1) * cw)}px`;
      const tr = title.getBoundingClientRect();
      natural = { cols: Math.ceil(tr.width / cw) + PAD_X * 2, rows: Math.ceil(tr.height / lh) + PAD_Y * 2 };
      const cols = Math.min(Math.floor(avail / cw), Math.max(natural.cols, min.cols));
      const rows = Math.max(natural.rows, min.rows);
      root.style.width = `${cols * cw}px`; root.style.height = `${rows * lh}px`;

      const grid = [];
      for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
          const top = y === 0, bot = y === rows - 1, left = x === 0, right = x === cols - 1;
          let ch = ' ', cls = '';
          if ((top || bot) && (left || right)) { ch = '*'; cls = 'is-stud'; }
          else if (top || bot) { ch = x % 14 === 7 ? 'o' : '='; cls = ch === 'o' ? 'is-stud' : ''; }
          else if (left || right) ch = '|';
          else if ((y === 1 || y === rows - 2) && x > 1 && x < cols - 2) { ch = x % 2 ? '-' : ' '; cls = 'is-rail'; }
          else if ((x === 2 || x === cols - 3) && y > 1 && y < rows - 2) { ch = ':'; cls = 'is-rail'; }
          row.push([ch, cls]);
        }
        grid.push(row);
      }
      if (tag && cols > tag.length + 8) [...tag].forEach((c, i) => { grid[0][4 + i] = [c, 'is-tag']; });

      // Clockwise perimeter position 0..1 from the top-left corner, for the power-on sweep
      const W = cols - 1, H = rows - 1, per = 2 * (W + H);
      const along = (x, y) => {
        const dt = y, db = H - y, dl = x, dr = W - x, m = Math.min(dt, db, dl, dr);
        const p = m === dt ? x : m === dr ? W + y : m === db ? W + H + (W - x) : 2 * W + H + (H - y);
        return p / per;
      };
      frame.innerHTML = grid.map((row, y) => row.map(([c, cls], x) =>
        c === ' ' ? ' ' : `<b class="${cls}" data-p="${along(x, y).toFixed(3)}">${c === '<' ? '&lt;' : c}</b>`
      ).join('')).join('\n');
      chars = [...frame.querySelectorAll('b')];
      if (lit) chars.forEach((b) => b.classList.add('is-on'));

      const dpr = Math.min(2, devicePixelRatio || 1);
      sparks.width = (cols * cw + 120) * dpr; sparks.height = (rows * lh + 120) * dpr;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---------- power-on ---------- */
    let seq = 0;
    function powerOn() {
      const run = ++seq;
      clearTimeout(timer); lit = false;
      root.classList.remove('is-lit', 'is-humming');
      chars.forEach((b) => b.classList.remove('is-on', 'is-fault'));
      letters.forEach((l) => l.classList.remove('is-on', 'is-fault', 'ignite-a', 'ignite-b', 'ignite-c'));
      if (reduce) { finish(); return; }

      const SWEEP = 620, t0 = performance.now();
      const pending = chars.map((b) => ({ b, at: +b.dataset.p * SWEEP + (Math.random() < .08 ? rand(80, 260) : 0) }));
      (function sweep(now) {
        if (run !== seq) return;
        const t = now - t0;
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i].at <= t) { pending[i].b.classList.add('is-on'); pending.splice(i, 1); }
        }
        if (pending.length) requestAnimationFrame(sweep);
      })(t0);

      const order = letters.map((l, i) => i).sort(() => Math.random() - .5);
      order.forEach((idx, k) => {
        setTimeout(() => {
          if (run !== seq) return;
          const l = letters[idx];
          l.classList.add('is-on', `ignite-${'abc'[(Math.random() * 3) | 0]}`);
          l.addEventListener('animationend', () => l.classList.remove('ignite-a', 'ignite-b', 'ignite-c'), { once: true });
        }, 520 + k * (620 / letters.length) + rand(0, 140));
      });
      setTimeout(() => { if (run === seq) finish(); }, 1480);
    }

    function finish() {
      lit = true;
      chars.forEach((b) => b.classList.add('is-on'));
      letters.forEach((l) => l.classList.add('is-on'));
      root.classList.add('is-lit');
      if (!reduce) {
        root.classList.add('is-humming');
        setTimeout(() => root.classList.remove('is-humming'), 520);
        schedule();
      }
    }

    /* ---------- faults + sparks ---------- */
    function schedule() {
      clearTimeout(timer);
      if (visible && lit && !reduce) timer = setTimeout(() => { spark(); schedule(); }, rand(6000, 14000));
    }

    function spark() {
      if (!lit) return;
      let targets;
      if (Math.random() < .7) {
        const i = (Math.random() * letters.length) | 0;
        targets = [letters[i]];
        if (Math.random() < .2 && letters[i + 1]) targets.push(letters[i + 1]);
      } else {
        const edge = chars.filter((b) => !b.classList.contains('is-rail'));
        const i = (Math.random() * (edge.length - 6)) | 0;
        targets = edge.slice(i, i + 3 + ((Math.random() * 4) | 0));
      }
      targets.forEach((el) => {
        el.classList.remove('is-fault'); void el.offsetWidth;
        el.classList.add('is-fault');
        el.addEventListener('animationend', () => el.classList.remove('is-fault'), { once: true });
      });
      const a = targets[0].getBoundingClientRect(), b = targets[targets.length - 1].getBoundingClientRect();
      const c = sparks.getBoundingClientRect();
      const x = (a.left + b.right) / 2 - c.left, y = (a.top + a.bottom) / 2 - c.top;
      burst(x, y); setTimeout(() => burst(x, y, .5), 380);
    }

    let parts = [], raf = 0, last = 0;
    function burst(x, y, scale = 1) {
      const n = Math.round(rand(4, 8) * scale) || 2;
      for (let i = 0; i < n; i++) {
        parts.push({ x, y, vx: rand(-150, 150), vy: rand(-230, -50), life: rand(.45, .9), age: 0 });
      }
      parts.push({ flash: true, x, y, life: .14, age: 0 });
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function tick(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const tube = getComputedStyle(root).getPropertyValue('--tube').trim() || '#ff5a36';
      sctx.clearRect(0, 0, sparks.width, sparks.height);
      sctx.lineCap = 'round';
      parts = parts.filter((p) => (p.age += dt) < p.life);
      for (const p of parts) {
        const k = 1 - p.age / p.life;
        if (p.flash) {
          const g = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
          g.addColorStop(0, `rgba(255,246,216,${k})`); g.addColorStop(1, 'rgba(255,246,216,0)');
          sctx.fillStyle = g; sctx.fillRect(p.x - 26, p.y - 26, 52, 52);
          continue;
        }
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        sctx.globalAlpha = k;
        sctx.strokeStyle = k > .55 ? '#fff6d8' : tube;
        sctx.lineWidth = 1.8;
        sctx.shadowColor = tube; sctx.shadowBlur = 8;
        sctx.beginPath(); sctx.moveTo(p.x, p.y); sctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); sctx.stroke();
      }
      sctx.globalAlpha = 1; sctx.shadowBlur = 0;
      raf = parts.length ? requestAnimationFrame(tick) : 0;
      if (!raf) sctx.clearRect(0, 0, sparks.width, sparks.height);
    }

    /* ---------- lifecycle ---------- */

    build();
    let powered = false;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !powered) { powered = true; powerOn(); }
      else schedule();
    }, { threshold: .5 }).observe(root);

    root.sign = { powerOn, spark, rebuild: build, natural: () => natural };
  }

  // Every sign on the page shares one size: the largest title sets the frame for all of them
  const start = () => {
    const roots = [...document.querySelectorAll('[data-sign]')];
    roots.forEach(makeSign);
    const layoutAll = () => {
      roots.forEach((r) => r.sign.rebuild());
      const n = roots.map((r) => r.sign.natural());
      const min = { cols: Math.max(...n.map((x) => x.cols)), rows: Math.max(...n.map((x) => x.rows)) };
      roots.forEach((r) => r.sign.rebuild(min));
    };
    layoutAll();
    let w = innerWidth, t = 0;
    addEventListener('resize', () => { if (innerWidth === w) return; w = innerWidth; clearTimeout(t); t = setTimeout(layoutAll, 120); });
  };
  Promise.all([
    document.fonts?.load('20px VT323'),
    document.fonts?.load('900 64px Archivo'),
  ]).then(start, start);
})();
