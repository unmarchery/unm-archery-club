// CRT ASCII title: <div class="crt-title" data-crt-title data-tag="01 · ON THE RANGE"><h2>Events</h2></div>
// The block box is a grid of terminal glyphs. Cells covered by the title glow along the phosphor ramp
// (edges dim, core white-hot) with a slow plasma shimmer; every other cell is dim but visible.
// Every 9–16s a vertical light line sweeps left→right switching the block off, then a second sweep
// switches it back on. The first view powers on with the "on" sweep.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BG_GLYPHS = '.:-=+/%&$#0@';
  const SWEEP_MS = 1100, HOLD_MS = 520, BAND = 3, TRAIL = 14, AFTERGLOW = 160;
  const FONTS = {
    fat: { family: '"Archivo", sans-serif', weight: 900, stretch: 'expanded' },
    brush: { family: '"Kaushan Script", cursive', weight: 400, stretch: 'normal' },
    slim: { family: '"Archivo", sans-serif', weight: 700, stretch: 'normal' },
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const hex = (c) => { c = c.trim(); if (c.startsWith('#') && c.length === 4) c = '#' + [...c.slice(1)].map((x) => x + x).join(''); return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); };

  function makeCRT(root) {
    const heading = root.querySelector('h1, h2, h3');
    const text = heading.textContent.trim().replace(/\s+/g, ' ');
    const tag = root.dataset.tag ? `[ ${root.dataset.tag} ]` : '';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    root.append(canvas);
    const ctx = canvas.getContext('2d');

    let cols = 0, rows = 0, cw = 0, chh = 0, ox = 0, oy = 0, W = 0, H = 0;
    let dens = new Float32Array(0), glyphs = [], tagRow = new Map();
    let LIT = [], OFF = [], SCAN = [];
    let linesKey = '', lines = 1;

    /* ---------- colours from the palette ---------- */
    function readColours() {
      const cs = getComputedStyle(root);
      const stops = ['--crt-off', '--crt-1', '--crt-2', '--crt-3', '--crt-4'].map((v) => hex(cs.getPropertyValue(v) || '#204030'));
      const glass = hex(cs.getPropertyValue('--crt-glass') || '#030906');
      const scan = hex(cs.getPropertyValue('--crt-scan') || '#b6fff4');
      const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
      const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
      // 48-step lit ramp from crt-1 (edge) to crt-4 (core)
      LIT = Array.from({ length: 48 }, (_, i) => {
        const x = (i / 47) * 3, k = Math.min(2, x | 0);
        return rgb(mix(stops[k + 1], stops[Math.min(4, k + 2)], x - k));
      });
      // 16-step dim ramp from glass to crt-off (unlit glyphs + phosphor afterglow)
      OFF = Array.from({ length: 16 }, (_, i) => rgb(mix(glass, stops[0], i / 15)));
      SCAN = Array.from({ length: 16 }, (_, i) => rgb(mix(stops[2], scan, i / 15)));
      SCAN.white = rgb(mix(scan, [255, 255, 255], .6));
      SCAN.beam = `rgba(${scan[0]},${scan[1]},${scan[2]},.28)`;
    }

    /* ---------- layout + rasterise the title into cell densities ---------- */
    function layout() {
      const probe = document.createElement('i');
      probe.style.cssText = 'position:absolute;width:var(--cell);height:0;visibility:hidden';
      root.append(probe);
      const cell = probe.getBoundingClientRect().width || 8;
      probe.remove();
      cw = cell; chh = cell * 1.18;
      const fontKey = root.dataset.font || 'fat';
      const fit = 'fit' in root.dataset;            // data-fit: the box hugs the title instead of filling the row
      const avail = fit ? root.parentElement.clientWidth : root.clientWidth;

      // Decide 1 or 2 lines (and the hugged width) from the available width only, so height changes can't loop
      const key = `${avail}|${fontKey}`;
      if (key !== linesKey) {
        linesKey = key;
        root.dataset.lines = '1'; root.style.width = '';
        const h1 = root.clientHeight;
        const words = text.split(' ');
        const m = document.createElement('canvas').getContext('2d');
        const fsH = (h1 * .74) / .92;
        setFont(m, fsH);
        const want = m.measureText(text).width / .86 + cell * 4;
        if (fit && want <= avail) {
          lines = 1;
          root.style.width = `${Math.ceil(want)}px`;
        } else {
          const f1 = fitSize([text], avail, h1), f2 = words.length > 1 ? fitSize(split2(words), avail, h1 * 1.55) : 0;
          lines = f2 > f1 * 1.25 ? 2 : 1;
        }
        root.dataset.lines = String(lines);
      }
      W = root.clientWidth; H = root.clientHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(W / cw); rows = Math.floor(H / chh);
      ox = (W - cols * cw) / 2; oy = (H - rows * chh) / 2;

      // Rasterise at real pixel size, then average alpha per cell
      const textLines = lines === 2 ? split2(text.split(' ')) : [text];
      const fs = fitSize(textLines, W, H);
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(cols * cw)); off.height = Math.max(1, Math.round(rows * chh));
      const o = off.getContext('2d', { willReadFrequently: true });
      setFont(o, fs);
      o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
      const lh = fs * .92, top = off.height / 2 - (textLines.length - 1) * lh / 2 + fs * .04;
      textLines.forEach((l, i) => o.fillText(l, off.width / 2, top + i * lh));
      const img = o.getImageData(0, 0, off.width, off.height).data;
      dens = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = Math.round(c * cw), x1 = Math.round((c + 1) * cw), y0 = Math.round(r * chh), y1 = Math.round((r + 1) * chh);
          let sum = 0, n = 0;
          for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { sum += img[(y * off.width + x) * 4 + 3]; n++; }
          dens[r * cols + c] = n ? sum / n / 255 : 0;
        }
      }
      // Fixed glyph per cell: density decides the family, the hash picks within it
      glyphs = new Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = dens[r * cols + c], h = hash(c, r);
          let g;
          if (d > .82) g = h < .8 ? '$' : '@';
          else if (d > .55) g = '&@%$0#'[(h * 6) | 0];
          else if (d > .28) g = '%#0=+&'[(h * 6) | 0];
          else if (d > .08) g = '+=/:-%'[(h * 6) | 0];
          else g = hash(r, c) < .72 ? BG_GLYPHS[(h * BG_GLYPHS.length) | 0] : ' ';
          // ASCII box edge
          if (r === 0 || r === rows - 1) g = (c === 0 || c === cols - 1) ? '+' : '-';
          else if (c === 0 || c === cols - 1) g = '|';
          glyphs[r * cols + c] = g;
        }
      }
      tagRow = new Map();
      if (tag && cols > tag.length + 8) [...tag, ' ', '█'].forEach((ch, i) => tagRow.set(3 + i, ch));
      ctx.font = `800 ${chh * .9}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      draw(performance.now());
    }

    function split2(words) {
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        const m = Math.max(a.length, b.length);
        if (!best || m < best.m) best = { m, l: [a, b] };
      }
      return best ? best.l : [words.join(' ')];
    }
    function setFont(c, fs) {
      const f = FONTS[root.dataset.font || 'fat'];
      c.font = `${f.weight} ${fs}px ${f.family}`;
      // narrow screens: a narrower cut keeps the letters tall enough to read in cells
      if ('fontStretch' in c) c.fontStretch = root.clientWidth < 640 && f.stretch === 'expanded' ? 'semi-condensed' : f.stretch;
    }
    function fitSize(textLines, w, h) {
      const m = document.createElement('canvas').getContext('2d');
      setFont(m, 100);
      const widest = Math.max(...textLines.map((l) => m.measureText(l).width));
      const byW = ((w * .86) / widest) * 100;
      const byH = (h * .74) / (textLines.length * .92);
      return Math.min(byW, byH);
    }

    /* ---------- render ---------- */
    // Light state: per column "on-ness" driven by the sweeps; colOff[] stores when each column went dark
    let mode = reduce ? 'on' : 'dark', waveX = -10, waveT0 = 0, colOffAt = null;
    function colLevel(c, now) {
      if (mode === 'on') return 1;
      if (mode === 'dark') return 0;
      if (mode === 'sweep-off') return c > waveX ? 1 : 0;
      return c < waveX ? 1 : 0;                       // sweep-on
    }

    function draw(now) {
      if (!cols) return;
      ctx.clearRect(0, 0, W, H);
      const T = now / 1000, cx = cols / 2, cy = rows / 2;
      const sweeping = mode === 'sweep-off' || mode === 'sweep-on';
      if (sweeping) {
        // the beam: a soft vertical light column trailing the scan line
        const bx = ox + (waveX + 1) * cw, trail = cw * TRAIL;
        const g = ctx.createLinearGradient(bx - trail, 0, bx, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, SCAN.beam);
        ctx.fillStyle = g; ctx.fillRect(bx - trail, 0, trail, H);
        ctx.fillStyle = SCAN.white; ctx.globalAlpha = .55; ctx.fillRect(bx - cw * .5, 0, cw * .5, H); ctx.globalAlpha = 1;
      }
      for (let r = 0; r < rows; r++) {
        const y = oy + (r + .5) * chh;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          let g = glyphs[i];
          if (r === 0 && tagRow.has(c)) g = tagRow.get(c);
          const d = dens[i], x = ox + (c + .5) * cw;
          const dist = sweeping ? waveX - c : 99;
          // the light line itself
          if (sweeping && dist >= 0 && dist < BAND) {
            if (g === ' ') g = '|';
            ctx.fillStyle = dist < 1 ? SCAN.white : SCAN[Math.max(0, 15 - Math.round(dist * 5))];
            ctx.fillText(g, x, y);
            continue;
          }
          if (g === ' ') continue;
          const lvl = colLevel(c, now);
          // phosphor afterglow: columns that just switched off fade out over ~350ms
          let glow = 0;
          if (!lvl && colOffAt && colOffAt[c]) glow = Math.max(0, .5 * (1 - (now - colOffAt[c]) / AFTERGLOW));
          const on = lvl || glow;
          if (!on) continue;
          const isTag = r === 0 && tagRow.has(c);
          if (d > .08 || isTag) {
            const p = (Math.sin(c * .11 + T * 1.1) + Math.sin(r * .35 - T * 1.4) + Math.sin((c + r) * .07 + T * .7) + 3) / 6;
            let L = isTag ? .55 : Math.min(1, Math.max(0, d * .92 + (p - .5) * .32 + .04));
            // brief overshoot right behind the "on" sweep
            if (mode === 'sweep-on' && dist >= BAND && dist < BAND + 6) L = Math.min(1, L + (1 - (dist - BAND) / 6) * .35);
            ctx.globalAlpha = on;
            ctx.fillStyle = LIT[Math.round(L * 47)];
          } else {
            const edge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
            const v = edge ? 15 : 6 + Math.round(hash(c * 3, r * 7) * 9);
            ctx.globalAlpha = on;
            ctx.fillStyle = OFF[v];
          }
          ctx.fillText(g, x, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- sweeps ---------- */
    let raf = 0, lastIdle = 0, visible = false, timer = 0, busy = false;
    function sweep(kind) {
      return new Promise((res) => {
        mode = kind; waveT0 = performance.now(); waveX = -BAND;
        if (kind === 'sweep-off') colOffAt = new Float64Array(cols + 1);
        // run until the beam's trail has left the box, then let the last afterglow decay before stopping
        const END = cols + TRAIL, dist = END + BAND;
        let endAt = 0;
        const step = (now) => {
          const prev = waveX;
          waveX = Math.min(END, -BAND + ((now - waveT0) / SWEEP_MS) * dist);
          if (kind === 'sweep-off') for (let c = Math.max(0, Math.floor(prev)); c <= Math.min(cols - 1, Math.floor(waveX)); c++) if (!colOffAt[c]) colOffAt[c] = now;
          draw(now);
          if (waveX >= END && !endAt) endAt = now;
          if (!endAt || now - endAt < AFTERGLOW) requestAnimationFrame(step);
          else { mode = kind === 'sweep-off' ? 'dark' : 'on'; colOffAt = null; draw(performance.now()); res(); }
        };
        requestAnimationFrame(step);
      });
    }
    async function cycle() {
      if (busy || reduce) return;
      busy = true;
      if (mode !== 'dark') {
        await sweep('sweep-off');
        await new Promise((r) => setTimeout(r, HOLD_MS));
      }
      await sweep('sweep-on');
      busy = false; schedule();
    }
    function powerOn() { if (busy || reduce) return; mode = 'dark'; draw(performance.now()); cycle(); }
    function schedule() {
      clearTimeout(timer);
      if (visible && !reduce) timer = setTimeout(cycle, rand(9000, 16000));
    }
    // idle shimmer at ~20fps while visible and not sweeping
    function idle(now) {
      if (!visible) { raf = 0; return; }
      if (!busy && now - lastIdle > 50) { lastIdle = now; draw(now); }
      raf = requestAnimationFrame(idle);
    }

    readColours();
    layout();
    let lastW = root.clientWidth, lastH = root.clientHeight;
    let lastP = root.parentElement.clientWidth;
    const ro = new ResizeObserver(() => {
      const p = root.parentElement.clientWidth;
      if (root.clientWidth !== lastW || root.clientHeight !== lastH || p !== lastP) {
        lastW = root.clientWidth; lastH = root.clientHeight; lastP = p; layout();
      }
    });
    ro.observe(root); ro.observe(root.parentElement);

    let powered = false;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce && !raf) raf = requestAnimationFrame(idle);
      if (visible && !powered) { powered = true; powerOn(); } else schedule();
    }, { threshold: .4 }).observe(root);

    root.crt = {
      cycle, powerOn, sweep,
      // test hook: freeze a sweep at a fraction of the width (0..1), or pass null to show it fully lit
      freeze(f = null) {
        busy = true; clearTimeout(timer);
        if (f === null) mode = 'on'; else { mode = 'sweep-on'; waveX = f * cols; }
        draw(performance.now());
      },
      refresh() { readColours(); draw(performance.now()); },
      relayout() { linesKey = ''; layout(); },
    };
  }

  const start = () => document.querySelectorAll('[data-crt-title]').forEach(makeCRT);
  Promise.all([
    document.fonts?.load('900 64px Archivo'),
    document.fonts?.load('800 16px "JetBrains Mono"'),
    document.fonts?.load('64px "Kaushan Script"'),
  ]).then(start, start);
})();
