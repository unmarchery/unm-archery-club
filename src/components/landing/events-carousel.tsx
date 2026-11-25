"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { EventArt, GLOW, type EventTone } from "./event-art";

export type LandingEvent = {
  id: string; title: string; now: boolean; dateLabel: string; rangeLabel: string;
  time: string | null; who: string; details: string | null; image: string | null; tone: EventTone;
};

// Events carousel (handoff 5.7). Borderless cards: the centre one full size, the side ones smaller and
// dimmer, fading out at the edges through a mask. ‹ previous · ⤢ open · › next; loops (with fewer than
// five events, copies are added so the wrap is never seen); swipe and ← → keys. A blurred light pool in
// the event's colour sits under the centre card and breathes.
export function EventsCarousel({ events }: { events: LandingEvent[] }) {
  const R = events.length;
  const copies = R ? Math.ceil(5 / R) : 0;
  const slides = useMemo(() => Array.from({ length: R * Math.max(1, copies) }, (_, i) => events[i % R]), [events, R, copies]);
  const N = slides.length;
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState<LandingEvent | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const vp = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLParagraphElement>(null);

  // Place every slide around the centre one. A card that wraps round jumps without animating.
  useEffect(() => {
    const els = [...(vp.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [])];
    els.forEach((s, i) => {
      let p = (((i - idx) % N) + N) % N;
      if (p > N / 2) p -= N;
      const old = Number(s.style.getPropertyValue("--pos") || 0);
      if (Math.abs(p - old) > 2) s.classList.add("no-anim");
      s.style.setProperty("--pos", String(p));
      s.style.setProperty("--scale", p === 0 ? "1" : "0.9");
      s.style.setProperty("--op", Math.abs(p) > 1 ? "0" : p === 0 ? "1" : "0.6");
      s.classList.toggle("is-center", p === 0);
      s.setAttribute("aria-hidden", String(p !== 0));
    });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((s) => s.classList.remove("no-anim"))));
    if (status.current && R) status.current.textContent = `Event ${(idx % R) + 1} of ${R}: ${slides[idx].title}`;
    const place = () => {
      const c = els[idx], v = vp.current, g = glow.current;
      if (!c || !v || !g) return;
      g.style.width = `${c.offsetWidth + 200}px`; g.style.height = `${v.offsetHeight + 120}px`;
      g.style.top = `${v.offsetTop - 60}px`;
      g.style.setProperty("--ug", `rgb(${GLOW[slides[idx].tone]})`);
    };
    place();
    addEventListener("resize", place);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", place); };
  }, [idx, N, R, slides]);

  const go = (n: number) => setIdx((i) => (((i + n) % N) + N) % N);
  const x0 = useRef<number | null>(null);

  if (!R) {
    return <p className="events__empty wrap-v2 gutter">Nothing on the calendar right now. Training runs every Tuesday and Thursday, 4–7pm.</p>;
  }

  return (
    <div
      ref={root}
      className="ev-carousel"
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Current events"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      }}
    >
      <span className="ev-carousel__glow" ref={glow} aria-hidden="true" />
      <div
        className="ev-carousel__viewport"
        ref={vp}
        onPointerDown={(e) => { x0.current = e.clientX; }}
        onPointerUp={(e) => {
          if (x0.current === null) return;
          const dx = e.clientX - x0.current; x0.current = null;
          if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); return; }
          const s = (e.target as Element).closest<HTMLElement>("[data-slide]");
          if (s && !s.classList.contains("is-center")) go(Number(s.style.getPropertyValue("--pos")));
        }}
      >
        <ul className="ev-carousel__track" role="list">
          {slides.map((ev, i) => (
            <li key={`${ev.id}-${i}`} className="ev" data-slide aria-roledescription="slide" aria-hidden={i !== 0}>
              <div className="ev__text">
                <div className="ev__top">
                  <span className={`ev__badge${ev.now ? " ev__badge--now" : ""}`}>{ev.now ? "Now on" : "Upcoming"}</span>
                  <span className="ev__date">{ev.dateLabel}</span>
                </div>
                <h3>{ev.title}</h3>
                {ev.details && <p className="ev__desc">{ev.details}</p>}
                <ul className="ev__info" role="list">
                  <li><span>Time</span>{ev.time ?? "See details"}</li>
                  <li><span>Dates</span>{ev.rangeLabel}</li>
                  <li><span>Who</span>{ev.who}</li>
                </ul>
              </div>
              <div className="ev__art" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {ev.image ? <img src={ev.image} alt="" loading="lazy" /> : <EventArt tone={ev.tone} />}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="ev-carousel__controls">
        <button className="ctrl" type="button" onClick={() => go(-1)} aria-label="Previous event">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button className="ctrl ctrl--open" data-liquid type="button" onClick={() => setOpen(slides[idx])} aria-label={`Open event details: ${slides[idx].title}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-8 8M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" /></svg>
        </button>
        <button className="ctrl" type="button" onClick={() => go(1)} aria-label="Next event">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite" ref={status} />

      {open && (
        <Dialog onClose={() => setOpen(null)} labelledBy="ev-dlg-title" className="ev-dlg">
          <div className="ev-dlg__art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {open.image ? <img src={open.image} alt="" /> : <EventArt tone={open.tone} />}
          </div>
          <div className="ev__top">
            <span className={`ev__badge${open.now ? " ev__badge--now" : ""}`}>{open.now ? "Now on" : "Upcoming"}</span>
            <span className="ev__date">{open.dateLabel}</span>
          </div>
          <h2 id="ev-dlg-title" className="ev-dlg__title">{open.title}</h2>
          {open.details && <p className="ev-dlg__desc">{open.details}</p>}
          <ul className="ev__info" role="list">
            <li><span>Time</span>{open.time ?? "See details"}</li>
            <li><span>Dates</span>{open.rangeLabel}</li>
            <li><span>Who</span>{open.who}</li>
          </ul>
        </Dialog>
      )}
    </div>
  );
}
