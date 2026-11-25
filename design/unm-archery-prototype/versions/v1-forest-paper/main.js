// UNM Archery Club landing: hero reveal, nav state, liquid buttons, CRT ASCII bow dividers.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  /* ---------- Hero: reveal headline + CTA once, when the arrow enters slow motion ---------- */
  const hero = document.querySelector('[data-hero]');
  const video = document.querySelector('[data-hero-video]');
  const SLOWMO_AT = 2.6; // seconds into the loop: arrow lands in the frame and slows (measured from the clip)
  let revealed = false;
  const reveal = () => { if (!revealed) { revealed = true; hero.classList.add('is-revealed'); } };

  if (reduce) {
    video.removeAttribute('autoplay');
    video.pause();
    video.addEventListener('loadeddata', () => { video.currentTime = 4; }, { once: true });
    reveal();
  } else {
    video.addEventListener('timeupdate', () => { if (video.currentTime >= SLOWMO_AT) reveal(); });
    // Fallback if timeupdate is slow or autoplay is blocked
    const arm = () => setTimeout(reveal, Math.max(0, (SLOWMO_AT - video.currentTime) * 1000) + 250);
    video.addEventListener('playing', arm, { once: true });
    setTimeout(reveal, SLOWMO_AT * 1000 + 2500);
  }

  const pauseBtn = document.querySelector('[data-pause]');
  let userPaused = reduce;
  const syncPause = () => pauseBtn.setAttribute('aria-pressed', String(userPaused));
  syncPause();
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    userPaused ? video.pause() : video.play().catch(() => {});
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play background video' : 'Pause background video');
    syncPause();
  });

  /* ---------- Topbar: thin glass over the video, solid once the hero is gone ---------- */
  const topbar = document.querySelector('[data-topbar]');
  new IntersectionObserver(([e]) => {
    topbar.classList.toggle('is-solid', !e.isIntersecting);
    if (!userPaused) e.isIntersecting ? video.play().catch(() => {}) : video.pause(); // no loop offscreen
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);

  /* ---------- Liquid buttons: fill wells up from where the pointer enters ---------- */
  document.querySelectorAll('[data-liquid]').forEach((btn) => {
    const place = (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - r.left}px`);
      btn.style.setProperty('--y', `${e.clientY - r.top}px`);
      btn.style.setProperty('--grow', String(Math.ceil(Math.hypot(r.width, r.height))));
    };
    btn.addEventListener('pointerenter', place);
    btn.addEventListener('pointerleave', place);
  });

  // Magnetic pull, primary CTA only, fine pointers only
  if (fine && !reduce) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.transform = `translate(${dx * 8}px, ${dy * 6}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- Liquid background: pause drift while the hero covers it ---------- */
  const liquid = document.querySelector('.liquid');
  new IntersectionObserver(([e]) => {
    liquid.style.setProperty('--play', e.isIntersecting ? 'paused' : 'running');
    liquid.querySelectorAll('.blob').forEach((b) => { b.style.animationPlayState = e.isIntersecting ? 'paused' : 'running'; });
  }, { threshold: 0.6 }).observe(hero);

  /* ---------- CRT ASCII bow divider ---------- */
  // Glyphs are fixed by the bow's ink density; only the phosphor light (a plasma field) moves.
  const RAMP = ' .:-=+/%&$@';             // index = density digit 1..9 (10 = hottest)
  const BG_GLYPHS = '.:-=+/%&$#';
  const PH = [[18, 10, 6], [110, 29, 14], [210, 84, 31], [243, 165, 60], [255, 232, 182]];
  const phosphor = (v) => { // 0..1 along the P3-amber ramp
    const x = Math.min(0.999, Math.max(0, v)) * (PH.length - 1), i = x | 0, f = x - i;
    const a = PH[i], b = PH[i + 1];
    return `rgb(${a[0] + (b[0] - a[0]) * f | 0},${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0})`;
  };
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const BOW = window.BOW_ASCII || [];

  function makeCRT(canvas) {
    const flip = canvas.dataset.flip === 'true';
    const art = flip ? [...BOW].reverse() : BOW;
    const AR = art.length, AC = art[0]?.length || 0;
    const ctx = canvas.getContext('2d');
    let cols = 0, rows = 0, cw = 0, ch = 0, ox = 0, oy = 0, stringRow = -1, visible = false, raf = 0, last = 0;

    // The bow string row (the long horizontal run) extends across the screen as the "shooting line"
    let best = 0;
    art.forEach((row, j) => {
      const inBand = flip ? j < AR * 0.4 : j > AR * 0.6;
      const n = row.replace(/ /g, '').length;
      if (inBand && n > best) { best = n; stringRow = j; }
    });

    function size() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ch = Math.min(h / (AR + 2), (w / (AC + 6)) * 2); // fit the bow, 1:2 cells
      cw = ch / 2;
      cols = Math.ceil(w / cw); rows = Math.ceil(h / ch);
      ox = Math.floor((cols - AC) / 2); oy = Math.floor((rows - AR) / 2);
      ctx.font = `${ch * 1.08}px VT323, monospace`;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      draw(last || 4000);
    }

    function draw(t) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const T = t / 1000;
      const cx = cols / 2, cy = rows / 2;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          // plasma field, 0..1
          const p = (Math.sin(i * 0.09 + T * 0.9) + Math.sin(j * 0.21 - T * 1.2) +
                     Math.sin((i + j) * 0.05 + T * 0.6) + Math.sin(Math.hypot(i - cx, (j - cy) * 2) * 0.12 - T * 1.4) + 4) / 8;
          const ai = i - ox, aj = j - oy;
          const inArt = ai >= 0 && ai < AC && aj >= 0 && aj < AR;
          const d = inArt ? art[aj].charCodeAt(ai) - 48 : -16;
          let glyph, lum;
          if (d > 0) {
            glyph = RAMP[Math.min(10, d + (d > 7 ? 1 : 0))];
            lum = 0.45 + (d / 9) * 0.5 + (p - 0.5) * 0.6;
          } else if (aj === stringRow) {
            // shooting line beyond the bow tips
            glyph = (i + j) % 3 === 0 ? '=' : '-';
            const fade = 1 - Math.min(1, Math.abs(i - cx) / (cols / 2));
            lum = 0.3 + p * 0.45 * (0.4 + fade);
          } else {
            const v = p * p * (0.6 + hash(i, j) * 0.4);
            if (v < 0.3) continue; // negative space keeps the bow readable
            glyph = BG_GLYPHS[(hash(j, i) * BG_GLYPHS.length) | 0];
            lum = 0.1 + (v - 0.3) * 0.7;
          }
          ctx.fillStyle = phosphor(lum);
          ctx.fillText(glyph, (i + 0.5) * cw, (j + 0.5) * ch);
        }
      }
    }

    function loop(t) {
      if (!visible) return;
      if (t - last > 33) { last = t; draw(t); } // ~30fps is plenty for phosphor drift
      raf = requestAnimationFrame(loop);
    }

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduce) raf = requestAnimationFrame(loop);
    }).observe(canvas);
    new ResizeObserver(size).observe(canvas);
  }

  const startCRT = () => document.querySelectorAll('[data-crt]').forEach(makeCRT);
  (document.fonts?.load('16px VT323') || Promise.resolve()).then(startCRT, startCRT);
})();
