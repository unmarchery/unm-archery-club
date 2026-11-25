"use client";

import { useEffect, useRef } from "react";

// Pauses CSS animations inside `ref` while it is off screen (adds .is-paused).
function usePauseOffscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("is-paused", !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

type Fly = { lane: 0 | 1 | 2; d: number; delay: number; trail: string; w: number; img: string };
const LTR: Fly[] = [
  { lane: 0, d: 8.5, delay: -1.2, trail: "#5fe3d6", w: 1, img: "volt" },
  { lane: 1, d: 9.5, delay: -3.4, trail: "#5fe3d6", w: 1, img: "broadhead" },
  { lane: 1, d: 9.5, delay: -8.15, trail: "#f5c84a", w: .85, img: "vane" },
  { lane: 2, d: 7.5, delay: -4.6, trail: "#ff7a3d", w: .95, img: "ember" },
];
const RTL: Fly[] = [
  { lane: 0, d: 9, delay: -4.1, trail: "#ff7a3d", w: .95, img: "ember" },
  { lane: 1, d: 8, delay: -.8, trail: "#5fe3d6", w: 1, img: "broadhead" },
  { lane: 1, d: 8, delay: -4.8, trail: "#c9d3d4", w: .8, img: "carbon" },
  { lane: 2, d: 10, delay: -2.2, trail: "#5fe3d6", w: 1, img: "volt" },
];

// Arrow divider (handoff 5.8): three lanes, at most four real cut-out arrows in view, flying at a steady
// linear speed with a light trail and a slight flex. Pauses off screen.
export function ArrowDivider({ dir }: { dir: "ltr" | "rtl" }) {
  const ref = usePauseOffscreen<HTMLDivElement>();
  return (
    <div ref={ref} className={`arrows arrows--${dir}`} aria-hidden="true">
      {[0, 1, 2].map((l) => <span key={l} className="arrows__lane" style={{ "--lane": l } as React.CSSProperties} />)}
      {(dir === "ltr" ? LTR : RTL).map((f, i) => (
        <span key={i} className="fly" style={{ "--i": i, "--lane": f.lane, "--d": `${f.d}s`, "--delay": `${f.delay}s`, "--trail": f.trail, "--w": f.w } as React.CSSProperties}>
          <span className="fly__trail" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/arrows/${f.img}.png`} alt="" loading="lazy" />
        </span>
      ))}
    </div>
  );
}

const BOWS = [
  { kind: "barebow", alt: "Wooden barebow with two arrows" },
  { kind: "recurve", alt: "Recurve bow with a wooden riser and three arrows" },
  { kind: "compound", alt: "Blue compound bow with sight and stabiliser" },
];

// Bow showcase behind the Join Club perks (handoff 5.9): Barebow → Recurve → Compound, about 3.6 s each,
// crossfading and floating. Slides in from the right as the section arrives and out to the left as it
// ends, reversing on the way back up. Static under reduced motion.
export function Bows({ sectionId }: { sectionId: string }) {
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!, stage = stageRef.current!, join = document.getElementById(sectionId)!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bows = [...el.querySelectorAll<HTMLElement>("[data-bow]")];
    let bi = 0, bt = 0, visible = false;
    const timers = new Set<number>();
    const show = (n: number) => {
      const prev = bows[bi];
      bi = (n + bows.length) % bows.length;
      if (prev !== bows[bi]) {
        prev.classList.remove("is-on"); prev.classList.add("is-leaving");
        const t = window.setTimeout(() => { prev.classList.remove("is-leaving"); timers.delete(t); }, 900); timers.add(t);
      }
      bows[bi].classList.add("is-on");
    };
    const tick = () => { window.clearTimeout(bt); if (visible && !reduce) bt = window.setTimeout(() => { show(bi + 1); tick(); }, 3600); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; tick(); });
    io.observe(el);

    const wide = matchMedia("(min-width: 861px)");
    const ease = (t: number) => 1 - (1 - t) ** 3;
    let raf = 0;
    const place = () => {
      raf = 0;
      if (reduce || !wide.matches) { stage.style.setProperty("--bx", "0px"); stage.style.setProperty("--bo", "1"); return; }
      const r = join.getBoundingClientRect(), vh = innerHeight;
      const p = (vh - r.top) / (vh + r.height); // 0: section below the screen … 1: scrolled past
      const far = Math.min(innerWidth * 0.6, 720);
      let x = 0, o = 1;
      if (p < 0.4) { const t = ease(Math.max(0, (p - 0.05) / 0.35)); x = (1 - t) * far; o = t; }
      else if (p > 0.72) { const t = ease(Math.min(1, (p - 0.72) / 0.25)); x = -t * far; o = 1 - t; }
      stage.style.setProperty("--bx", `${x.toFixed(1)}px`);
      stage.style.setProperty("--bo", o.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(place); };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", place);
    place();
    return () => {
      io.disconnect(); window.clearTimeout(bt); timers.forEach((t) => window.clearTimeout(t)); cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll); removeEventListener("resize", place);
    };
  }, [sectionId]);

  return (
    <aside ref={ref} className="bows" aria-hidden="true">
      <div className="bows__stage" ref={stageRef}>
        <span className="bows__glow" />
        {BOWS.map((b, i) => (
          <figure key={b.kind} className={`bow${i === 0 ? " is-on" : ""}`} data-bow>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/bows/${b.kind}.webp`} alt={b.alt} loading="lazy" />
          </figure>
        ))}
      </div>
    </aside>
  );
}

export type InfoCard = { k: string; v: string; s: string };

// Weekly Sessions marquee (handoff 5.10): info cards slide right to left without stopping, even on hover.
// Enough copies are rendered that a gap never shows on wide screens; copies are hidden from screen readers.
export function Marquee({ items }: { items: InfoCard[] }) {
  const ref = usePauseOffscreen<HTMLDivElement>();
  // One half of the loop must be wider than the widest screen (5 cards × ~318px ≈ 1590px; 2 sets per half).
  const half = [...items, ...items];
  return (
    <div ref={ref} className="marquee">
      <ul className="marquee__track" role="list">
        {[...half, ...half].map((c, i) => (
          <li key={i} className="info" aria-hidden={i >= items.length || undefined}>
            <span className="info__k">{c.k}</span><span className="info__v">{c.v}</span><span className="info__s">{c.s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
