"use client";

import { useEffect, useRef } from "react";

const LINE = "AIM, HIT, AND NEVER QUIT ✦ JOIN THE CLUB ✦ WEEKLY SESSIONS · TUE & THU ✦ BE PART OF US ✦ ";
const REPEAT = 4;

// The footer ribbon (handoff 5.11): a wavy cyan band with the club line moving along the curve
// (SVG textPath, startOffset loop). Runs only while on screen; still under reduced motion.
export function Ribbon() {
  const wrap = useRef<HTMLDivElement>(null);
  const tp = useRef<SVGTextPathElement>(null);

  useEffect(() => {
    const path = tp.current!, box = wrap.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let seg = 0, off = 0, last = 0, raf = 0, dead = false;
    const measure = () => { seg = (path.parentNode as SVGTextElement).getComputedTextLength() / REPEAT; };
    const loop = (t: number) => {
      const dt = last ? Math.min(50, t - last) : 16; last = t;
      if (!seg) measure();
      off -= dt * 0.07;
      if (seg && off <= -seg) off += seg;
      path.setAttribute("startOffset", off.toFixed(1));
      raf = requestAnimationFrame(loop);
    };
    document.fonts.ready.then(() => { if (!dead) measure(); });
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf); last = 0;
      if (e.isIntersecting) raf = requestAnimationFrame(loop);
    });
    io.observe(box);
    return () => { dead = true; io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="ribbon" ref={wrap} aria-hidden="true">
      <svg viewBox="0 0 1440 240" preserveAspectRatio="xMidYMid slice">
        <path id="ribbon-wave" d="M-200 150C80 60 320 60 560 130S1040 210 1280 120 1560 60 1700 110" fill="none" />
        <use href="#ribbon-wave" className="ribbon__band" />
        <text className="ribbon__text" dy="13">
          <textPath ref={tp} href="#ribbon-wave" startOffset="0">{LINE.repeat(REPEAT)}</textPath>
        </text>
      </svg>
    </div>
  );
}
