// UNM Archery Club landing: hero reveal, nav, liquid buttons, ambient fade, events carousel,
// arrow dividers, perk spotlight, weekly marquee and the footer ribbon. CRT titles: components/crt-title.js
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const onScreen = (el, cb, opts) => new IntersectionObserver(([e]) => cb(e.isIntersecting), opts).observe(el);

  /* ---------- Hero: reveal headline + CTA once, when the arrow enters slow motion ---------- */
  const hero = document.querySelector('[data-hero]');
  const video = document.querySelector('[data-hero-video]');
  if (hero) {
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
    let heroVisible = true;
    new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
      topbar.classList.toggle('is-solid', !e.isIntersecting);
      if (!userPaused) e.isIntersecting ? video.play().catch(() => {}) : video.pause();
    }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);
  }
  // pages without the video hero (shop) keep the bar solid
  if (!hero) document.querySelector('[data-topbar]')?.classList.add('is-solid');


  /* ---------- Placeholder links: never jump the page or touch the URL ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) e.preventDefault();
  });

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
  if (hero) {
    const blobs = document.querySelectorAll('.blob');
    onScreen(hero, (v) => blobs.forEach((b) => { b.style.animationPlayState = v ? 'paused' : 'running'; }), { threshold: 0.6 });

    /* ---------- Ambient fade: sample the video's visible bottom edge, 4x a second ---------- */
    const amb = document.querySelector('[data-ambient]');
    const stage = document.querySelector('[data-stage]');
    const sc = document.createElement('canvas'); sc.width = 24; sc.height = 2;
    const sx = sc.getContext('2d', { willReadFrequently: true });
    const canvasRGB = (() => {
      const m = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim().match(/[0-9a-f]{2}/gi);
      return m ? m.map((h) => parseInt(h, 16)) : [8, 19, 14];
    })();
    let ambTimer = 0, ambOK = true;
    function sampleAmbient() {
      if (!ambOK || video.readyState < 2 || !video.videoWidth) return;
      const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const vw = video.videoWidth, vh = video.videoHeight;
      const fx0 = Math.max(0, (hr.left - sr.left) / sr.width), fx1 = Math.min(1, (hr.right - sr.left) / sr.width);
      const fyB = Math.min(1, (hr.bottom - sr.top) / sr.height), band = 0.05;
      try {
        sx.drawImage(video, fx0 * vw, (fyB - band) * vh, (fx1 - fx0) * vw, band * vh, 0, 0, 24, 2);
        const d = sx.getImageData(0, 0, 24, 2).data;
        const avg = (c0, c1, dark) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = 0; y < 2; y++) for (let x = c0; x < c1; x++) { const i = (y * 24 + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          const c = [r / n, g / n, b / n].map((v, k) => Math.round(v + (canvasRGB[k] - v) * dark));
          return `rgb(${c})`;
        };
        amb.style.setProperty('--amb-l', avg(0, 8, .45));   // the hero scrim darkens the bottom-left corner
        amb.style.setProperty('--amb-m', avg(8, 16, .18));
        amb.style.setProperty('--amb-r', avg(16, 24, .15));
      } catch {
        ambOK = false; // opened as file:// (tainted canvas): keep the CSS fallback colours
      }
    }
    onScreen(hero, (v) => {
      clearInterval(ambTimer);
      if (v && !reduce) ambTimer = setInterval(sampleAmbient, 250);
      sampleAmbient();
    });
    video.addEventListener('loadeddata', sampleAmbient);
  }

  /* ---------- Events carousel ---------- */
  const car = document.querySelector('[data-carousel]');
  if (car) {
    // With few events, loop through copies so the wrapping card is never visible mid-jump
    const track = car.querySelector('.carousel__track');
    const real = [...car.querySelectorAll('[data-slide]')];
    while (track.children.length < 5) real.forEach((s) => { const c = s.cloneNode(true); c.dataset.clone = ''; track.append(c); });
    const slides = [...track.children];
    const N = slides.length, R = real.length, status = car.querySelector('[data-status]');
    let idx = 0;
    const render = () => {
      slides.forEach((s, i) => {
        let p = (((i - idx) % N) + N) % N;
        if (p > N / 2) p -= N;
        const old = Number(s.style.getPropertyValue('--pos') || 0);
        if (Math.abs(p - old) > 2) s.classList.add('no-anim');  // wrapping card jumps while invisible
        s.style.setProperty('--pos', p);
        s.style.setProperty('--scale', p === 0 ? 1 : 0.9);
        s.style.setProperty('--op', Math.abs(p) > 1 ? 0 : p === 0 ? 1 : 0.6);
        s.classList.toggle('is-center', p === 0);
        s.setAttribute('aria-hidden', String(p !== 0));
      });
      requestAnimationFrame(() => requestAnimationFrame(() => slides.forEach((s) => s.classList.remove('no-anim'))));
      status.textContent = `Event ${(idx % R) + 1} of ${R}: ${slides[idx].querySelector('h3').textContent}`;
      // under-glow follows the centre card and takes its event colour
      const glow = car.querySelector('[data-ev-glow]');
      if (glow) {
        const c = slides[idx], vp = car.querySelector('[data-viewport]');
        const w = c.offsetWidth, h = vp.offsetHeight;
        glow.style.width = `${w + 200}px`; glow.style.height = `${h + 120}px`;
        glow.style.top = `${vp.offsetTop - 60}px`;
        glow.style.setProperty('--ug', `rgb(${c.dataset.glowRgb || '95 227 214'})`);
      }
    };
    const go = (n) => { idx = (((idx + n) % N) + N) % N; render(); };
    car.querySelector('[data-prev]').addEventListener('click', () => go(-1));
    car.querySelector('[data-next]').addEventListener('click', () => go(1));
    car.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });
    // swipe, or tap a side card to bring it to the centre
    const vp = car.querySelector('[data-viewport]');
    let x0 = null;
    vp.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    vp.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); return; }
      const s = e.target.closest('[data-slide]');
      if (s && !s.classList.contains('is-center')) go(Number(s.style.getPropertyValue('--pos')));
    });
    render();
  }

  /* ---------- Join Club: bow showcase (rotation + scroll-linked slide in/out) ---------- */
  const bowsEl = document.querySelector('[data-bows]');
  if (bowsEl) {
    const bows = [...bowsEl.querySelectorAll('[data-bow]')];
    let bi = 0, bt = 0, bowsVisible = false;
    const show = (n) => {
      const prev = bows[bi];
      bi = (n + bows.length) % bows.length;
      if (prev !== bows[bi]) {
        prev.classList.remove('is-on'); prev.classList.add('is-leaving');
        setTimeout(() => prev.classList.remove('is-leaving'), 900);
      }
      bows[bi].classList.add('is-on');
    };
    const tick = () => { clearTimeout(bt); if (bowsVisible && !reduce) bt = setTimeout(() => { show(bi + 1); tick(); }, 3600); };
    onScreen(bowsEl, (v) => { bowsVisible = v; tick(); });

    // slide in from the right as the section arrives, out to the left as it ends
    const join = document.querySelector('[data-join]');
    const stage = bowsEl.querySelector('[data-bows-stage]');
    const wide = matchMedia('(min-width: 861px)');
    const ease = (t) => 1 - (1 - t) ** 3;
    let sraf = 0;
    const place = () => {
      sraf = 0;
      if (reduce || !wide.matches) { stage.style.setProperty('--bx', '0px'); stage.style.setProperty('--bo', '1'); return; }
      const r = join.getBoundingClientRect(), vh = innerHeight;
      const p = (vh - r.top) / (vh + r.height);           // 0: section below the screen ... 1: scrolled past
      const far = Math.min(innerWidth * 0.6, 720);
      let x = 0, o = 1;
      if (p < 0.4) { const t = ease(Math.max(0, (p - 0.05) / 0.35)); x = (1 - t) * far; o = t; }
      else if (p > 0.72) { const t = ease(Math.min(1, (p - 0.72) / 0.25)); x = -t * far; o = 1 - t; }
      stage.style.setProperty('--bx', `${x.toFixed(1)}px`);
      stage.style.setProperty('--bo', o.toFixed(3));
    };
    addEventListener('scroll', () => { if (!sraf) sraf = requestAnimationFrame(place); }, { passive: true });
    addEventListener('resize', place);
    place();
  }

  /* ---------- Arrow dividers: only fly while on screen ---------- */
  document.querySelectorAll('[data-arrows]').forEach((el) => onScreen(el, (v) => el.classList.toggle('is-paused', !v)));

  /* ---------- Perks: spotlight follows the pointer ---------- */
  document.querySelectorAll('[data-glow]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ---------- Weekly marquee: duplicate the set for a seamless loop ---------- */
  const mq = document.querySelector('[data-marquee]');
  if (mq) {
    const track = mq.querySelector('.marquee__track');
    const copy = (li) => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); };
    const items = [...track.children];
    // one "half" of the loop must be at least a screen wide, or a gap shows on wide displays
    while (track.scrollWidth < Math.max(innerWidth, 1920) * 1.05) items.forEach(copy);
    [...track.children].forEach(copy);
    onScreen(mq, (v) => mq.classList.toggle('is-paused', !v));
  }

  /* ---------- Footer ribbon: text slides along the wave forever ---------- */
  const tp = document.querySelector('[data-ribbon-path]');
  if (tp) {
    const REPEAT = 4;
    tp.textContent = tp.textContent.repeat(REPEAT);
    let seg = 0, off = 0, last = 0, raf = 0;
    const measure = () => { seg = tp.parentNode.getComputedTextLength() / REPEAT; };
    const loop = (t) => {
      const dt = last ? Math.min(50, t - last) : 16; last = t;
      if (!seg) measure();
      off -= dt * 0.07;
      if (seg && off <= -seg) off += seg;
      tp.setAttribute('startOffset', off.toFixed(1));
      raf = requestAnimationFrame(loop);
    };
    (document.fonts?.ready || Promise.resolve()).then(measure);
    if (!reduce) onScreen(tp.closest('.ribbon'), (v) => { cancelAnimationFrame(raf); last = 0; if (v) raf = requestAnimationFrame(loop); });
  }
  /* ---------- Shop: tilt cards (Volt-style), shine follows the pointer ---------- */
  if (fine && !reduce) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--rx', `${((0.5 - py) * 10).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((px - 0.5) * 12).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------- Shop: quantity steppers [- n +] on every item and in the pop-up ---------- */
  const qtyOf = (q) => Number(q.querySelector('[data-n]').textContent) || 1;
  const setQty = (q, n) => {
    n = Math.max(1, Math.min(20, n));
    q.querySelector('[data-n]').textContent = String(n);
    q.querySelector('[data-dec]').disabled = n <= 1;
  };
  document.querySelectorAll('[data-qty]').forEach((q) => {
    setQty(q, 1);
    q.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      setQty(q, qtyOf(q) + (b.hasAttribute('data-inc') ? 1 : -1));
      q.classList.remove('is-ticked'); void q.offsetWidth; q.classList.add('is-ticked');
    });
  });
  // header count follows the view: guests also see the two passes
  const countHead = document.querySelector('[data-count]');
  if (countHead) {
    const recount = () => {
      const n = [...document.querySelectorAll('[data-item]')].filter((i) => i.offsetParent !== null).length;
      countHead.textContent = `(${String(n).padStart(2, '0')})`;
      countHead.setAttribute('aria-label', `${n} products`);
    };
    document.addEventListener('club:change', () => requestAnimationFrame(recount));
    recount();
  }

  /* ---------- Shop: cart (look only) - order launches a dot that arcs into the cart ---------- */
  const cart = document.querySelector('[data-cart]');
  const glowOf = (el) => getComputedStyle(el).getPropertyValue('--glow').trim() || '95 227 214';
  let flyToCart = () => {};
  if (cart) {
    // in line with the SHOP sign on arrival; floats under the nav once the header has scrolled away
    const head = cart.closest('.shop-head');
    if (head) new IntersectionObserver(([e]) => cart.classList.toggle('is-floating', !e.isIntersecting),
      { rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 72}px 0px 0px 0px` }).observe(head);
    const countEl = cart.querySelector('[data-cart-count]');
    let count = Number(countEl.textContent) || 0;
    const bump = (n = 1) => {
      count += n; countEl.textContent = String(count);
      cart.setAttribute('aria-label', `Cart, ${count} item${count === 1 ? '' : 's'}`);
      cart.classList.remove('is-bumped'); void cart.offsetWidth; cart.classList.add('is-bumped');
    };
    flyToCart = (a, glow, n = 1) => {
      if (reduce) { bump(n); return; }
      const b = cart.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'cart-dot';
      if (n > 1) dot.dataset.n = `×${n}`;
      dot.style.cssText = `left:${a.left + a.width / 2}px;top:${a.top + a.height / 2}px;--c:${glow}`;
      document.body.append(dot);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      dot.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 140}px)) scale(1.3)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.35)`, opacity: 0.9 },
      ], { duration: 720, easing: 'cubic-bezier(.45, 0, .25, 1)' }).finished.then(() => { dot.remove(); bump(n); });
    };
    document.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      const q = btn.parentElement.querySelector('[data-qty]');
      flyToCart(btn.getBoundingClientRect(), glowOf(btn), q ? qtyOf(q) : 1);
      if (q) setQty(q, 1);
    }));
  }

  /* ---------- Shop: item pop-up (two panels). Phones get an item page in the real site (see handoff) ---------- */
  const pop = document.querySelector('[data-pop]');
  if (pop) {
    const $ = (sel) => pop.querySelector(sel);
    let current = null;
    const open = (item, from) => {
      current = item;
      const sec = item.closest('[data-event]');
      pop.className = `pop crt--${sec ? sec.dataset.event : 'club'}`;
      $('[data-pop-img]').src = item.dataset.img;
      // absolute URL: a url() inside a custom property resolves against the stylesheet that uses it
      $('.pop__media').style.setProperty('--img', `url("${new URL(item.dataset.img, location.href).href}")`);
      $('[data-pop-img]').alt = item.dataset.alt || '';
      $('[data-pop-tag]').textContent = item.dataset.label || '';
      $('[data-pop-name]').textContent = item.dataset.name;
      $('[data-pop-desc]').textContent = item.dataset.desc;
      $('[data-pop-price]').textContent = item.dataset.price;
      const cardQty = item.querySelector('[data-qty]');
      setQty($('[data-qty]'), cardQty ? qtyOf(cardQty) : 1);
      $('[data-pop-specs]').replaceChildren(...(item.dataset.specs || '').split('|').filter(Boolean).map((t) => {
        const li = document.createElement('li'); li.textContent = t; return li;
      }));
      // grow out of the tile that was clicked
      const r = from.getBoundingClientRect();
      const card = $('.pop__card');
      pop.showModal();
      const c = card.getBoundingClientRect();
      card.style.setProperty('--ox', `${r.left + r.width / 2 - c.left}px`);
      card.style.setProperty('--oy', `${r.top + r.height / 2 - c.top}px`);
    };
    const close = (then) => {
      if (!pop.open) return;
      if (reduce) { pop.close(); then?.(); return; }
      pop.classList.add('is-closing');
      setTimeout(() => { pop.classList.remove('is-closing'); pop.close(); then?.(); }, 210);
    };
    document.querySelectorAll('[data-open]').forEach((t) => t.addEventListener('click', () => open(t.closest('[data-item]'), t)));
    $('[data-pop-close]').addEventListener('click', () => close());
    pop.addEventListener('click', (e) => { if (e.target === pop) close(); });           // backdrop
    pop.addEventListener('cancel', (e) => { e.preventDefault(); close(); });             // Esc
    $('[data-pop-add]').addEventListener('click', (e) => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect(), glow = glowOf(pop);
      const n = qtyOf($('[data-qty]'));
      close(() => flyToCart(r, glow, n));   // the dot flies after the pop-up leaves the top layer
    });
  }
})();
