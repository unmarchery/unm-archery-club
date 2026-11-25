// Book a session (prototype, look only). Mirrors the live booking system: Tue/Thu 4-7pm in hour slots,
// members free, guests use Hour/Day passes, the live options (Club/Own bow, hand, draw weight),
// the no-show warning, Edit / cancel per slot, cancel a whole day, and My bookings on the card.
// Mock state lives in components/view-mode.js (window.club); the real site reads it from the account.
(() => {
  const club = window.club;
  if (!club) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const CAP = 20;
  const DAYS = [
    { key: 'tue-24', label: 'Tue 24 Nov', slots: [['4–5pm', 3], ['5–6pm', 8], ['6–7pm', 1]] },   // [time, taken by others]
    { key: 'thu-26', label: 'Thu 26 Nov', slots: [['4–5pm', 0], ['5–6pm', 12], ['6–7pm', 17]] },
  ];
  const SLOT_NO = { '4–5pm': 1, '5–6pm': 2, '6–7pm': 3 };
  const isGuest = () => club.state.view === 'guest';
  const mineAt = (day, time) => club.state.bookings.find((b) => b.day === day && b.time === time);
  const left = (day, time, others) => Math.max(0, CAP - others - (mineAt(day, time) ? 1 : 0));
  const kit = (b) => `${b.equip === 'own' ? 'Own bow' : 'Club bow'} · ${b.hand || 'Right'}${b.equip === 'own' ? '' : ' · ' + (b.lbs || 'Not sure')}`;
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  };

  /* ---------- the membership / guest card (same face small and enlarged) ---------- */
  // Both cards share one row layout: top / handle / tier / meter / note / bookings
  const cardFace = () => {
    const s = club.state, n = s.bookings.length, g = isGuest(), p = s.passes;
    const meter = g
      ? `<span class="mcard__passes">
           <span>Hour pass <b>${p.hour}</b><a class="mcard__plus" href="shop.html?view=guest#passes" aria-label="Get hour passes">+</a></span>
           <span>Day pass <b>${p.day}</b><a class="mcard__plus" href="shop.html?view=guest#passes" aria-label="Get day passes">+</a></span>
         </span>`
      : '<span class="mcard__unl"><span class="mcard__bar" aria-hidden="true"><i></i></span><span class="mcard__inf" aria-label="unlimited">∞</span></span>';
    return `<span class="mcard__shine"></span>
      <span class="mcard__top"><img src="assets/logo.png" alt=""><span class="mcard__club">UNM ARCHERY CLUB</span><span class="mcard__chip" aria-hidden="true"></span></span>
      <span class="mcard__handle">@${s.user.handle}</span>
      <span class="mcard__tier">${g ? 'GUEST · 2026/27' : 'MEMBER · 2026/27'}</span>
      ${meter}
      <span class="mcard__note">${g ? 'Pay less, shoot more' : 'Unlimited sessions, free all year'}</span>
      <span class="mcard__bk">My bookings: <b data-bk-count>${n}</b></span>`;
  };
  const card = $('[data-card]');
  const bigCard = $('[data-big-card]');
  const chipMeta = $('[data-chip-meta]');
  const renderCards = () => {
    const cls = `mcard mcard--${isGuest() ? 'guest' : 'member'}`;
    card.className = cls; card.innerHTML = cardFace();
    bigCard.className = cls + ' mcard--big'; bigCard.innerHTML = cardFace();
    if (chipMeta) chipMeta.textContent = isGuest() ? `${club.state.passes.hour + club.state.passes.day} passes` : '∞';
  };

  /* ---------- day cards ---------- */
  const daysEl = $('[data-days]');
  const dayFull = (d) => d.slots.every(([t]) => mineAt(d.key, t));
  const renderDays = () => {
    daysEl.innerHTML = DAYS.map((d) => `
      <article class="day" aria-labelledby="d-${d.key}">
        <header class="day__head"><h2 id="d-${d.key}">${d.label}</h2><span class="day__pill">4–7pm</span></header>
        <ul class="day__slots" role="list">
          ${d.slots.map(([t, others]) => {
            const l = left(d.key, t, others), m = mineAt(d.key, t);
            return `<li class="slot${m ? ' is-mine' : ''}">
              <span class="slot__time">${t}</span>
              <span class="slot__cap">${m ? `<span class="slot__left slot__booked">${ICON.check}<span>Booked · ${kit(m)}</span></span>` : `<span class="slot__left"><b>${l}</b> slots remaining</span>`}
                <span class="slot__bar"><i style="--fill:${((CAP - l) / CAP) * 100}%"></i></span></span>
              ${m
                ? `<button class="btn btn--glass btn--sm slot__btn" type="button" data-edit="${m.id}" data-liquid><span class="btn__label">Edit</span></button>`
                : `<button class="btn btn--primary btn--sm slot__btn" type="button" data-book="${d.key}|${t}" data-liquid ${l ? '' : 'disabled'}><span class="btn__label">Book</span></button>`}
            </li>`;
          }).join('')}
        </ul>
        <footer class="day__foot">
          <span>${isGuest() ? 'RM5 an hour, or one Day pass for all three.' : ''}</span>
          ${dayFull(d)
            ? `<button class="btn btn--danger btn--sm" type="button" data-cancel-day="${d.key}" data-liquid><span class="btn__label">Cancel whole day booking</span></button>`
            : `<button class="btn btn--glass btn--sm" type="button" data-book="${d.key}|whole day" data-liquid><span class="btn__label">Book the whole day${isGuest() ? ' · 1 Day pass' : ''}</span></button>`}
        </footer>
      </article>`).join('');
    daysEl.querySelectorAll('[data-liquid]').forEach(liquid);
  };
  function liquid(btn) {   // same liquid fill as main.js for buttons rendered later
    const place = (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - r.left}px`); btn.style.setProperty('--y', `${e.clientY - r.top}px`);
      btn.style.setProperty('--grow', String(Math.ceil(Math.hypot(r.width, r.height))));
    };
    btn.addEventListener('pointerenter', place); btn.addEventListener('pointerleave', place);
  }

  /* ---------- booking / edit pop-up: a page-level <dialog>, so nothing can clip it ---------- */
  const bk = $('[data-bk]');
  const pick = { mode: 'book', id: '', day: '', time: '', equip: 'club', hand: 'Right', lbs: '18 lbs' };
  const passKind = () => (pick.time === 'whole day' ? 'day' : 'hour');
  const syncBk = () => {
    bk.querySelectorAll('[data-opt]').forEach((b) => {
      const [k, v] = b.dataset.opt.split(':');
      b.setAttribute('aria-pressed', String(pick[k] === v));
    });
    $('[data-weights]', bk).hidden = pick.equip !== 'club';
    $('[data-bk-summary]', bk).textContent = kit(pick);
    const go = $('[data-bk-go]', bk), price = $('[data-bk-price]', bk), drop = $('[data-bk-drop]', bk);
    drop.hidden = pick.mode !== 'edit';
    if (pick.mode === 'edit') {
      price.textContent = 'Your booking'; price.className = 'bk__price';
      go.querySelector('.btn__label').textContent = 'Save changes'; go.dataset.mode = 'save';
    } else if (!isGuest()) {
      price.textContent = 'Free for members'; price.className = 'bk__price';
      go.querySelector('.btn__label').textContent = 'Confirm booking'; go.dataset.mode = 'book';
    } else {
      const have = club.state.passes[passKind()];
      price.textContent = `Uses 1 ${passKind() === 'day' ? 'Day' : 'Hour'} pass · you have ${have}`;
      price.className = 'bk__price is-guest' + (have ? '' : ' is-empty');
      go.querySelector('.btn__label').textContent = have ? 'Confirm booking' : 'Get passes';
      go.dataset.mode = have ? 'book' : 'shop';
    }
  };
  const grow = (from) => {
    if (reduce || !from) return;
    const r = from.getBoundingClientRect(), c = $('.bk__card', bk).getBoundingClientRect();
    $('.bk__card', bk).animate([
      { transform: `translate(${r.left + r.width / 2 - (c.left + c.width / 2)}px, ${r.top + r.height / 2 - (c.top + c.height / 2)}px) scale(.3)`, opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' });
  };
  const openBk = (day, time, from) => {
    const d = DAYS.find((x) => x.key === day);
    Object.assign(pick, { mode: 'book', id: '', day, time });
    $('[data-bk-title]', bk).textContent = `${d.label} · ${time === 'whole day' ? '4–7pm, whole day' : time}`;
    $('[data-bk-go]', bk).classList.remove('is-done');
    syncBk(); bk.showModal(); grow(from);
  };
  const openEdit = (id, from) => {
    const b = club.state.bookings.find((x) => x.id === id);
    if (!b) return;
    Object.assign(pick, { mode: 'edit', id, day: b.day, time: b.time, equip: b.equip || 'club', hand: b.hand || 'Right', lbs: b.lbs || '18 lbs' });
    $('[data-bk-title]', bk).textContent = `Edit · ${b.date} · ${b.time}`;
    $('[data-bk-go]', bk).classList.remove('is-done');
    syncBk(); bk.showModal(); grow(from);
  };
  bk.addEventListener('click', (e) => {
    const o = e.target.closest('[data-opt]');
    if (o) { const [k, v] = o.dataset.opt.split(':'); pick[k] = v; syncBk(); return; }
    if (e.target.closest('[data-bk-drop]')) { const id = pick.id; closeDialog(bk, () => askCancel([id])); return; }
    if (e.target === bk || e.target.closest('[data-bk-close]')) closeDialog(bk);
  });
  bk.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(bk); });
  $('[data-bk-go]', bk).addEventListener('click', (e) => {
    const go = e.currentTarget;
    if (go.dataset.mode === 'shop') { location.href = 'shop.html?view=guest#passes'; return; }
    if (go.dataset.mode === 'save') {
      club.set({ bookings: club.state.bookings.map((b) => (b.id === pick.id ? { ...b, equip: pick.equip, hand: pick.hand, lbs: pick.lbs, bow: kit(pick) } : b)) });
      done(go, 'Saved');
      return;
    }
    if (isGuest() && !club.usePass(passKind())) { syncBk(); return; }
    const d = DAYS.find((x) => x.key === pick.day);
    const times = pick.time === 'whole day' ? d.slots.map((s) => s[0]).filter((t) => !mineAt(d.key, t)) : [pick.time];
    times.forEach((t) => club.addBooking({ day: pick.day, date: d.label, time: t, equip: pick.equip, hand: pick.hand, lbs: pick.lbs, bow: kit(pick) }));
    done(go, 'Booked');
  });
  const done = (go, label) => {
    go.classList.add('is-done');
    go.querySelector('.btn__label').textContent = label;
    setTimeout(() => { closeDialog(bk); bumpCard(); }, reduce ? 0 : 750);
  };

  const closeDialog = (dlg, then) => {
    if (!dlg.open) return;
    if (reduce) { dlg.close(); then?.(); return; }
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.classList.remove('is-closing'); dlg.close(); then?.(); }, 200);
  };
  const bumpCard = () => { card.classList.remove('is-bumped'); void card.offsetWidth; card.classList.add('is-bumped'); };

  /* ---------- wallet: the card grows to the centre with my bookings ---------- */
  const wallet = $('[data-wallet]');
  const listEl = $('[data-bk-list]', wallet);
  const renderList = () => {
    const b = club.state.bookings;
    listEl.innerHTML = b.length ? b.map((x) => `
      <li class="mine"><span class="mine__date">${x.date}</span><span class="mine__time">${x.time}</span>
        <span class="mine__slot">Slot ${SLOT_NO[x.time] || ''}</span>
        <span class="mine__bow">${x.equip ? kit(x) : x.bow}</span>
        <button class="mine__cancel" type="button" data-cancel="${x.id}">Cancel</button></li>`).join('')
      : '<li class="mine mine--empty">No bookings yet. Pick a slot below and it will show up here.</li>';
  };
  const openWallet = () => {
    renderList();
    const from = card.getBoundingClientRect();
    wallet.showModal();
    if (!reduce) {
      const to = bigCard.getBoundingClientRect();
      bigCard.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`, transformOrigin: '0 0' },
        { transform: 'none', transformOrigin: '0 0' },
      ], { duration: 560, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      $('.wallet__list', wallet).animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 200, fill: 'backwards', easing: 'cubic-bezier(.16, 1, .3, 1)' });
    }
    card.style.visibility = 'hidden';
  };
  const closeWallet = () => closeDialog(wallet);
  wallet.addEventListener('close', () => { card.style.visibility = ''; });   // however it closes
  card.addEventListener('click', (e) => { if (!e.target.closest('a')) openWallet(); });
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWallet(); } });
  $('[data-user-chip]')?.addEventListener('click', openWallet);
  wallet.addEventListener('click', (e) => {
    if (e.target === wallet || e.target.closest('[data-wallet-close]')) { closeWallet(); return; }
    const c = e.target.closest('[data-cancel]');
    if (c) askCancel([c.dataset.cancel]);
  });
  wallet.addEventListener('cancel', (e) => { e.preventDefault(); closeWallet(); });

  /* ---------- cancel (one slot, or a whole day): always ask first ---------- */
  const confirmDlg = $('[data-confirm]');
  let pending = [];
  const askCancel = (ids, whole) => {
    const list = club.state.bookings.filter((x) => ids.includes(x.id));
    if (!list.length) return;
    pending = list;
    $('[data-confirm-title]', confirmDlg).textContent = whole ? 'Cancel the whole day?' : 'Cancel this booking?';
    $('[data-confirm-text]', confirmDlg).textContent = whole ? `Cancel all three hours on ${list[0].date}, 4–7pm?` : `Cancel ${list[0].date}, ${list[0].time}?`;
    $('[data-do-cancel] .btn__label', confirmDlg).textContent = whole ? 'Cancel whole day' : 'Cancel booking';
    confirmDlg.showModal();
  };
  confirmDlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-keep]') || e.target === confirmDlg) { closeDialog(confirmDlg); return; }
    if (e.target.closest('[data-do-cancel]') && pending.length) {
      if (isGuest()) {   // assumed refund: one Day pass for a whole day, otherwise Hour passes
        const p = club.state.passes;
        club.set({ passes: pending.length === 3 ? { ...p, day: p.day + 1 } : { ...p, hour: p.hour + pending.length } });
      }
      pending.forEach((b) => club.cancelBooking(b.id)); pending = [];
      closeDialog(confirmDlg);
    }
  });

  /* ---------- card motion: faces the pointer; now and then it taps the reader ---------- */
  const tapEl = $('[data-tap]'), reader = $('.reader');
  document.addEventListener('visibilitychange', () => { if (document.hidden) { tapEl?.getAnimations().forEach((a) => a.cancel()); reader?.classList.remove('is-approved'); } });
  if (fine && !reduce) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(px * 18).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-py * 14).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }
  let tapTimer = 0, hovering = false, headVisible = true;
  const stopTap = () => tapEl?.getAnimations().forEach((a) => a.cancel());
  card.addEventListener('pointerenter', () => { hovering = true; stopTap(); });
  card.addEventListener('pointerdown', stopTap);
  card.addEventListener('pointerleave', () => { hovering = false; });
  const tap = () => {
    if (!tapEl || !reader || reduce) return;
    const busy = hovering || !headVisible || document.hidden || bk.open || wallet.open || confirmDlg.open || card.style.visibility === 'hidden';
    if (!busy) {
      stopTap();   // never stack taps (background tabs can queue timers)
      const c = tapEl.getBoundingClientRect(), r = reader.getBoundingClientRect();
      const padX = r.left + r.width * 0.3, padY = r.top + r.height * 0.72;
      const dx = Math.min(padX - c.right + 70, innerWidth - c.right - 8), dy = padY - (c.top + c.height / 2);
      tapEl.animate([
        { transform: 'none' },
        { transform: `translate(${dx}px, ${dy}px) rotate(-7deg) scale(.9)`, offset: 0.34 },
        { transform: `translate(${dx}px, ${dy}px) rotate(-7deg) scale(.9)`, offset: 0.58 },
        { transform: 'none' },
      ], { duration: 2600, easing: 'cubic-bezier(.45, 0, .25, 1)' });
      setTimeout(() => {
        reader.classList.add('is-approved');
        setTimeout(() => reader.classList.remove('is-approved'), 1500);
      }, 2600 * 0.36);
    }
    tapTimer = setTimeout(tap, 9000 + Math.random() * 5000);
  };
  if (tapEl) {
    new IntersectionObserver(([e]) => { headVisible = e.isIntersecting; }, { threshold: 0.5 }).observe(tapEl);
    tapTimer = setTimeout(tap, 3500);
  }

  /* ---------- wiring ---------- */
  daysEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-book]');
    if (b && !b.disabled) { const [d, t] = b.dataset.book.split('|'); openBk(d, t, b); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { openEdit(ed.dataset.edit, ed); return; }
    const cd = e.target.closest('[data-cancel-day]');
    if (cd) { const d = DAYS.find((x) => x.key === cd.dataset.cancelDay); askCancel(d.slots.map(([t]) => mineAt(d.key, t)?.id).filter(Boolean), true); }
  });
  const renderAll = () => { renderCards(); renderDays(); if (wallet.open) renderList(); if (bk.open) syncBk(); };
  document.addEventListener('club:change', renderAll);
  renderAll();
})();
