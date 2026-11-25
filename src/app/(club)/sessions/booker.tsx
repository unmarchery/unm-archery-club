"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { LockIcon } from "@/components/icons";
import { cancelBooking } from "./actions";
import { BookingDialog, ConfirmCancel, gearLine, type BookingTarget, type CancelTarget } from "./booking";
import { BookTitle } from "./title";
import type { Account, DayCard, MyBooking, SlotRow } from "./types";
import { WaitlistButton } from "./waitlist";

const passName = (k: MyBooking["passKind"]) => (k === "member" ? "Member" : k === "single" ? "Hour pass" : "Day pass");

// The face both cards share (handoff 5.13, round 7): logo + club + chip, @handle, tier line, the meter
// (members: a fully charged bar with ∞; guests: their passes, each with + to the shop), a note, and
// how many bookings they have.
function CardFace({ account, count }: { account: Account; count: number }) {
  const guest = !account.member;
  return (
    <>
      <span className="mcard__shine" aria-hidden="true" />
      <span className="mcard__top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" /><span className="mcard__club">UNM ARCHERY CLUB</span><span className="mcard__chip" aria-hidden="true" />
      </span>
      <span className="mcard__handle">{account.handle}</span>
      <span className="mcard__tier">{guest ? "GUEST" : "MEMBER"} · {account.year}</span>
      {guest ? (
        <span className="mcard__passes">
          <span>Hour pass <b>{account.singles}</b><Link className="mcard__plus" href="/shop" aria-label="Get hour passes">+</Link></span>
          <span>Day pass <b>{account.fulls}</b><Link className="mcard__plus" href="/shop" aria-label="Get day passes">+</Link></span>
        </span>
      ) : (
        <span className="mcard__unl"><span className="mcard__bar" aria-hidden="true"><i /></span><span className="mcard__inf" aria-label="Unlimited sessions">∞</span></span>
      )}
      <span className="mcard__note">{guest ? "Pay less, shoot more" : "Unlimited sessions, free all year"}</span>
      <span className="mcard__bk">My bookings: <b>{count}</b></span>
    </>
  );
}

// The card reader, drawn in SVG and anchored to the window's right edge (only its left half shows).
function Reader({ approved }: { approved: boolean }) {
  return (
    <svg className={`reader${approved ? " is-approved" : ""}`} viewBox="0 0 200 300" aria-hidden="true">
      <defs>
        <filter id="lcd-glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <linearGradient id="rd-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1c2326" /><stop offset="1" stopColor="#0c1012" /></linearGradient>
      </defs>
      <rect x="8" y="8" width="184" height="284" rx="30" fill="url(#rd-body)" stroke="#2f383b" strokeWidth="2" />
      <rect x="22" y="24" width="156" height="98" rx="12" fill="#04100c" stroke="#1d3a33" strokeWidth="2" />
      <g className="reader__lcd-text" filter="url(#lcd-glow)" fill="#5fe3d6" style={{ fontFamily: "var(--f-mono)" }}>
        <text x="34" y="64" fontSize="30">TAP ▸</text><text x="34" y="96" fontSize="17" fill="#2e8f86">READY</text>
      </g>
      <g className="reader__ok" fill="none" stroke="#5ff2a0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#lcd-glow)"><path d="M38 72l14 14 26-30" /></g>
      <circle className="reader__led" cx="40" cy="142" r="5" fill="#5fe3d6" />
      <circle className="reader__ring" cx="108" cy="215" r="34" fill="none" stroke="#5ff2a0" strokeWidth="3" />
      <rect x="30" y="162" width="140" height="112" rx="18" fill="#0b0f11" stroke="#2f383b" strokeWidth="2" />
      <g fill="none" stroke="#5fe3d6" strokeWidth="5" strokeLinecap="round" opacity=".9">
        <path d="M84 196c10 10 10 28 0 38" /><path d="M96 186c16 16 16 42 0 58" /><path d="M108 176c22 22 22 56 0 78" />
      </g>
    </svg>
  );
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
const Chev = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

export function Booker({ days, mine, account, banned }: { days: DayCard[]; mine: MyBooking[]; account: Account; banned: string | null }) {
  const [booking, setBooking] = useState<BookingTarget | null>(null);
  const [cancel, setCancel] = useState<CancelTarget | null>(null);
  const [wallet, setWallet] = useState<DOMRect | null>(null);
  const [approved, setApproved] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const tapRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  // The card never taps the reader while a pop-up is open (read by the motion effect below).
  useEffect(() => { busy.current = Boolean(booking || cancel || wallet); }, [booking, cancel, wallet]);

  const bump = () => { const c = cardRef.current; if (!c) return; c.classList.remove("is-bumped"); void c.offsetWidth; c.classList.add("is-bumped"); };
  const askCancel = (b: MyBooking) => setCancel({
    title: b.passKind === "full" ? "Cancel this day-pass hour?" : "Cancel this booking?",
    note: `${b.day}, ${b.time}. ${b.cancelNote}`,
    dayPass: b.passKind === "full",
    run: (whole) => cancelBooking(b.id, whole),
  });

  // Card motion: it faces the pointer (3D tilt + a light under the pointer), drifts a little at rest, and
  // every 9–14 s goes to tap the reader, which approves. Never while hovered, while a dialog is open, when
  // the header is off screen or the tab is hidden. Off under reduced motion.
  useEffect(() => {
    const card = cardRef.current, tapEl = tapRef.current;
    if (!card || !tapEl) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    let hovering = false, headVisible = true, tapTimer = 0;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    const stopTap = () => tapEl.getAnimations().forEach((a) => a.cancel());

    const onMove = (e: PointerEvent) => {
      if (!fine || reduce) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", `${(px * 18).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(-py * 14).toFixed(2)}deg`);
      card.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
    };
    const onEnter = () => { hovering = true; stopTap(); };
    const onLeave = () => { hovering = false; card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); };
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerenter", onEnter);
    card.addEventListener("pointerleave", onLeave);
    card.addEventListener("pointerdown", stopTap);

    const reader = document.querySelector<SVGSVGElement>(".book-head .reader");
    const tap = () => {
      if (!reader || reduce) return;
      if (!hovering && headVisible && !document.hidden && !busy.current) {
        stopTap();
        const c = tapEl.getBoundingClientRect(), r = reader.getBoundingClientRect();
        const padX = r.left + r.width * 0.3, padY = r.top + r.height * 0.72;
        const dx = Math.min(padX - c.right + 70, innerWidth - c.right - 8), dy = padY - (c.top + c.height / 2);
        tapEl.animate([
          { transform: "none" },
          { transform: `translate(${dx}px, ${dy}px) rotate(-7deg) scale(.9)`, offset: 0.34 },
          { transform: `translate(${dx}px, ${dy}px) rotate(-7deg) scale(.9)`, offset: 0.58 },
          { transform: "none" },
        ], { duration: 2600, easing: "cubic-bezier(.45, 0, .25, 1)" });
        later(() => { setApproved(true); later(() => setApproved(false), 1500); }, 2600 * 0.36);
      }
      tapTimer = window.setTimeout(tap, 9000 + Math.random() * 5000);
    };
    const io = new IntersectionObserver(([e]) => { headVisible = e.isIntersecting; }, { threshold: 0.5 });
    io.observe(tapEl);
    tapTimer = window.setTimeout(tap, 3500);
    const onVis = () => { if (document.hidden) { stopTap(); setApproved(false); } };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerenter", onEnter);
      card.removeEventListener("pointerleave", onLeave);
      card.removeEventListener("pointerdown", stopTap);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect(); window.clearTimeout(tapTimer); timers.forEach((t) => window.clearTimeout(t)); stopTap();
    };
  }, []);

  return (
    <>
      <div className="book-head wrap-v2 gutter">
        <BookTitle />
        <div className="wallet-spot">
          <div className="card-tap" ref={tapRef}>
            <div className="card-float">
              <div ref={cardRef} className={`mcard mcard--${account.member ? "member" : "guest"}`} style={wallet ? { visibility: "hidden" } : undefined}>
                <button type="button" className="mcard__open" aria-haspopup="dialog" aria-label="Open my card and bookings"
                  onClick={() => { const c = cardRef.current; if (c) { c.getAnimations().forEach((a) => a.cancel()); setWallet(c.getBoundingClientRect()); } }} />
                <CardFace account={account} count={mine.length} />
              </div>
            </div>
          </div>
        </div>
        <Reader approved={approved} />
      </div>

      {banned && (
        <div className="wrap-v2 gutter"><p className="book-ban" role="status">You&apos;re paused from booking until {banned} because of no-shows.</p></div>
      )}

      {days.length === 0
        ? <div className="wrap-v2 gutter"><p className="book-empty">No sessions in the next three weeks.</p></div>
        : <Days days={days} account={account} onBook={setBooking} onCancel={setCancel} />}

      {booking && (
        <BookingDialog target={booking} account={account} onClose={() => setBooking(null)} onDone={bump} onCancel={askCancel} />
      )}
      {cancel && <ConfirmCancel target={cancel} onClose={() => setCancel(null)} />}
      {wallet && (
        <Wallet from={wallet} account={account} mine={mine} onClose={() => setWallet(null)} onCancel={askCancel} />
      )}
    </>
  );
}

// The day cards, two at a time on wide screens (swipe on phones), with "Days 1–2 of N" and ‹ ›.
function Days({ days, account, onBook, onCancel }: {
  days: DayCard[]; account: Account; onBook: (t: BookingTarget) => void; onCancel: (t: CancelTarget) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ first: 1, last: 1, start: true, end: days.length <= 1 });
  useLayoutEffect(() => {
    const el = track.current!;
    const update = () => {
      const card = el.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 20;
      const step = card ? card.offsetWidth + gap : 1;
      const first = Math.round(el.scrollLeft / step) + 1;
      const shown = Math.max(1, Math.round((el.clientWidth + gap) / step));
      setAt({ first, last: Math.min(days.length, first + shown - 1), start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, [days.length]);
  const go = (dir: number) => {
    const el = track.current, card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 20;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section aria-label="Session days">
      <div className="pager wrap-v2 gutter">
        <span className="pager__label" aria-live="polite">{at.last > at.first ? `Days ${at.first}–${at.last} of ${days.length}` : `Day ${at.first} of ${days.length}`}</span>
        <div className="pager__btns">
          <button type="button" aria-label="Previous days" disabled={at.start} onClick={() => go(-1)}><Chev d="M15 5l-7 7 7 7" /></button>
          <button type="button" aria-label="Next days" disabled={at.end} onClick={() => go(1)}><Chev d="M9 5l7 7-7 7" /></button>
        </div>
      </div>
      <div className="wrap-v2 gutter">
        <div className="days" ref={track} tabIndex={0} aria-label="Session days, scroll sideways">
          {days.map((d) => <Day key={d.key} day={d} account={account} onBook={onBook} onCancel={onCancel} />)}
        </div>
      </div>
    </section>
  );
}

function Day({ day, account, onBook, onCancel }: {
  day: DayCard; account: Account; onBook: (t: BookingTarget) => void; onCancel: (t: CancelTarget) => void;
}) {
  if (day.locked) {
    return (
      <article className="day day--locked" aria-label={`${day.title}, not open yet`}>
        <header className="day__head"><h2>{day.short}</h2><span className="day__pill">{day.range}</span></header>
        <div className="day__lock">
          <LockIcon />
          <p>{day.locked.text}{day.locked.soon && <> · <strong>{day.locked.soon}</strong></>}</p>
          {day.locked.calendar && <a className="btn btn--glass btn--sm" href={day.locked.calendar} target="_blank" rel="noreferrer"><span className="btn__label">Add to calendar</span></a>}
        </div>
      </article>
    );
  }
  const mineHere = day.slots.map((s) => s.mine).filter((b): b is MyBooking => Boolean(b));
  const cancelDay = () => {
    const group = mineHere.find((b) => b.group)?.group;
    onCancel({
      title: "Cancel whole day booking?",
      note: `${day.short}, all ${mineHere.length} hours. ${mineHere[0]?.cancelNote ?? ""}`,
      run: async () => {
        if (group) return cancelBooking(mineHere[0].id, true);
        for (const b of mineHere) { const r = await cancelBooking(b.id, false); if (!r.ok) return r; }
        return { ok: true };
      },
    });
  };

  return (
    <article className="day" aria-labelledby={`day-${day.key}`}>
      <header className="day__head"><h2 id={`day-${day.key}`}>{day.short}</h2><span className="day__pill">{day.range}</span></header>
      <ul className="day__slots" role="list">
        {day.slots.map((s) => <Slot key={s.id} slot={s} account={account} onBook={() => onBook({ mode: "slot", day, slot: s })} onEdit={(b) => onBook({ mode: "edit", booking: b })} />)}
      </ul>
      <footer className="day__foot">
        {day.allMine ? (
          <><span>All three hours are yours.</span><button type="button" className="btn btn--danger btn--sm" onClick={cancelDay}><span className="btn__label">Cancel whole day booking</span></button></>
        ) : day.anyMine ? (
          <span>You&apos;ve booked {mineHere.length === 1 ? "an hour" : `${mineHere.length} hours`} on this day.</span>
        ) : (
          <>
            {!account.member && <span>RM{account.prices.single} an hour, or one Day pass (RM{account.prices.full}) for all three</span>}
            {day.canDay
              ? <button type="button" className="btn btn--glass btn--sm" onClick={() => onBook({ mode: "day", day })}><span className="btn__label">Book the whole day</span></button>
              : account.member && <span>Whole-day booking needs a free spot in every hour.</span>}
          </>
        )}
      </footer>
    </article>
  );
}

function Slot({ slot, account, onBook, onEdit }: { slot: SlotRow; account: Account; onBook: () => void; onEdit: (b: MyBooking) => void }) {
  const almost = !slot.mine && !slot.cancelled && slot.left > 0 && slot.left <= 3;
  return (
    <li className={`slot${slot.mine ? " is-mine" : ""}${slot.cancelled ? " is-cancelled" : ""}`}>
      <span className="slot__time">{slot.time}</span>
      <span className="slot__cap">
        {slot.mine ? (
          <span className="slot__left slot__booked"><Check /><span>Booked · {gearLine(slot.mine.gear)}</span></span>
        ) : slot.cancelled ? (
          <span className="slot__left">Cancelled{slot.cancelledReason ? `: ${slot.cancelledReason}` : ""}</span>
        ) : slot.left > 0 ? (
          <span className="slot__left"><b>{slot.left}</b> {slot.left === 1 ? "slot" : "slots"} remaining{almost && <span className="slot__almost">ALMOST FULL</span>}</span>
        ) : (
          <span className="slot__left">Full</span>
        )}
        <span className="slot__bar" aria-hidden="true"><i style={{ "--fill": `${slot.fill}%` } as React.CSSProperties} /></span>
      </span>
      <span className="slot__act">
        {slot.cancelled || slot.started ? (
          <span className="slot__state">{slot.cancelled ? "Cancelled" : "Started"}</span>
        ) : slot.mine ? (
          <button type="button" className="btn btn--glass btn--sm slot__btn" onClick={() => onEdit(slot.mine!)}><span className="btn__label">Edit</span></button>
        ) : slot.left > 0 ? (
          <button type="button" className="btn btn--primary btn--sm slot__btn" onClick={onBook}><span className="btn__label">Book</span></button>
        ) : slot.waitlist ? (
          <WaitlistButton slotId={slot.id} position={slot.waitlist.position} waiting={slot.waitlist.waiting} member={account.member} gear={account.gear} />
        ) : (
          <span className="slot__state">Full</span>
        )}
      </span>
    </li>
  );
}

// The card, enlarged to the centre (it grows from where it was), with My bookings: date, time, pass,
// equipment and Cancel (which asks first). Closing always brings the small card back.
function Wallet({ from, account, mine, onClose, onCancel }: { from: DOMRect; account: Account; mine: MyBooking[]; onClose: () => void; onCancel: (b: MyBooking) => void }) {
  const big = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = big.current!, to = el.getBoundingClientRect();
    el.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`, transformOrigin: "0 0" },
      { transform: "none", transformOrigin: "0 0" },
    ], { duration: 560, easing: "cubic-bezier(.16, 1, .3, 1)" });
    list.current?.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 200, fill: "backwards", easing: "cubic-bezier(.16, 1, .3, 1)" });
  }, [from]);

  return (
    <Dialog onClose={onClose} label="My card and bookings" className="wallet" bare>
      <div className="wallet__body">
        <div ref={big} className={`mcard mcard--big mcard--${account.member ? "member" : "guest"}`}><CardFace account={account} count={mine.length} /></div>
        <section ref={list} className="wallet__list" aria-labelledby="wallet-title">
          <h3 id="wallet-title">MY BOOKINGS</h3>
          <ul role="list">
            {mine.length === 0 && <li className="mine mine--empty">No bookings yet. Pick a slot below and it will show up here.</li>}
            {mine.map((b) => (
              <li key={b.id} className="mine">
                <span className="mine__date">{b.day}<a className="mine__cal" href={b.calendar} target="_blank" rel="noreferrer">Add to calendar</a></span>
                <span className="mine__time">{b.time}</span>
                <span className="mine__slot">{passName(b.passKind)}</span>
                <span className="mine__bow">{gearLine(b.gear)}</span>
                <button type="button" className="mine__cancel" onClick={() => onCancel(b)}>Cancel</button>
              </li>
            ))}
          </ul>
          <Link className="mine__all link" href="/bookings">All my bookings and pass history</Link>
        </section>
      </div>
    </Dialog>
  );
}
