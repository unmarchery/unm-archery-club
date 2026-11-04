"use client";

import { useEffect, useRef, useState } from "react";

const Chev = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// The session days side by side: swipe on phones, or use the arrows.
export function DayCarousel({ count, children }: { count: number; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ first: 1, last: 1, start: true, end: count <= 1 });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const card = el.firstElementChild as HTMLElement | null;
      const step = card ? card.offsetWidth + 20 : 1;
      const first = Math.round(el.scrollLeft / step) + 1;
      const shown = Math.max(1, Math.round(el.clientWidth / step));
      setAt({ first, last: Math.min(count, first + shown - 1), start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    };
    const raf = requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [count]);

  const go = (dir: number) => {
    const el = track.current, card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label="Session days">
      <div className="car-head">
        <span className="muted small strong" aria-live="polite">{at.last > at.first ? `Days ${at.first}–${at.last} of ${count}` : `Day ${at.first} of ${count}`}</span>
        <div className="car-nav">
          <button type="button" className="icon-btn" aria-label="Previous day" disabled={at.start} onClick={() => go(-1)}><Chev d="m15 6-6 6 6 6" /></button>
          <button type="button" className="icon-btn" aria-label="Next day" disabled={at.end} onClick={() => go(1)}><Chev d="m9 6 6 6-6 6" /></button>
        </div>
      </div>
      <div className="car-track" ref={track} tabIndex={0} aria-label="Session days, scroll sideways">{children}</div>
    </section>
  );
}
