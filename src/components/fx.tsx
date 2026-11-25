"use client";

import { useEffect } from "react";

// Site-wide pointer effects, delegated from the document so server-rendered buttons get them too.
// - Liquid buttons (.btn, [data-liquid]): the fill wells up from the point where the pointer enters or leaves.
// - Spotlight cards ([data-glow]): a light follows the pointer (--mx/--my).
// - Magnetic ([data-magnetic]): the main CTA leans a few pixels toward a fine pointer.
export function Fx() {
  useEffect(() => {
    const place = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest?.<HTMLElement>(".btn, [data-liquid]");
      if (!btn || (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget))) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--x", `${e.clientX - r.left}px`);
      btn.style.setProperty("--y", `${e.clientY - r.top}px`);
      btn.style.setProperty("--grow", String(Math.ceil(Math.hypot(r.width, r.height))));
    };
    document.addEventListener("pointerover", place, { passive: true });
    document.addEventListener("pointerout", place, { passive: true });

    const spot = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-glow]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", spot, { passive: true });

    const fine = matchMedia("(pointer: fine)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pulled: HTMLElement | null = null;
    const magnet = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest?.<HTMLElement>("[data-magnetic]") ?? null;
      if (pulled && pulled !== btn) { pulled.style.translate = ""; pulled = null; }
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      btn.style.translate = `${(dx * 8).toFixed(1)}px ${(dy * 6).toFixed(1)}px`;
      pulled = btn;
    };
    if (fine && !reduce) document.addEventListener("pointermove", magnet, { passive: true });

    return () => {
      document.removeEventListener("pointerover", place);
      document.removeEventListener("pointerout", place);
      document.removeEventListener("pointermove", magnet);
      document.removeEventListener("pointermove", spot);
    };
  }, []);
  return null;
}
