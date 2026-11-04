"use client";

import { useEffect, useRef, useState } from "react";

// Side-on range: a compound bow is drawn, anchored and released; the arrow hits target 4 and the score pops.
// Geometry is in SVG units; everything moving is set per frame from one timeline.
const G = { y: 262, brace: 384, full: 172, top: { x: 408, y: 96 }, bot: { x: 408, y: 428 }, flex: { x: 8, y: 14 }, pTop: { x: 484, y: 122 }, pBot: { x: 484, y: 402 }, camR: 24, len: 310 };
const LAYOUT = { wide: { tx: 1080, vb: "120 40 1080 460" }, compact: { tx: 880, vb: "150 52 830 448" } };
const T = { draw0: 0.55, draw1: 1.95, rel: 3.1, stroke: 0.075, flight: 0.3, fade0: 5.0, fade1: 5.6, loop: 6.3 };
const SEP = T.rel + T.stroke, HIT = SEP + T.flight;
const PHASES = ["Nock", "Draw", "Anchor", "Release", "Hit"];

const easeIO = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeBack = (k: number) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
const f = (n: number) => n.toFixed(2);
type Pt = { x: number; y: number };
function limb(a: Pt, b: Pt, w0: number, w1: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  return `M${f(a.x + nx * w0)} ${f(a.y + ny * w0)} L${f(b.x + nx * w1)} ${f(b.y + ny * w1)} L${f(b.x - nx * w1)} ${f(b.y - ny * w1)} L${f(a.x - nx * w0)} ${f(a.y - ny * w0)} Z`;
}

export function BowScene() {
  const svg = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState(2);
  const [score, setScore] = useState("10");
  const [playing, setPlaying] = useState(true);
  const playRef = useRef(true);

  useEffect(() => {
    const el = svg.current!;
    const q = <T extends SVGElement>(id: string) => el.querySelector<T>(`#${id}`)!;
    const E = { bow: q("bs-bow"), limbTop: q("bs-lt"), limbBot: q("bs-lb"), camTop: q("bs-ct"), camBot: q("bs-cb"), str: q("bs-str"), peep: q("bs-peep"), loop: q("bs-loop"), c1: q("bs-c1"), c2: q("bs-c2"), arrow: q("bs-arrow"), trail: q("bs-trail"), target: q("bs-target"), score: q("bs-score") };
    let tx = 1080, elapsed = T.draw1 + 0.45, last: number | null = null, raf = 0, dy = 3, loopN = -1, onScreen = true, lastPhase = -1, label = "10";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { playRef.current = false; requestAnimationFrame(() => setPlaying(false)); }

    const setLayout = () => {
      const L = el.getBoundingClientRect().width < 640 ? LAYOUT.compact : LAYOUT.wide;
      tx = L.tx; el.setAttribute("viewBox", L.vb); el.classList.toggle("compact", L === LAYOUT.compact);
    };
    const newShot = () => { dy = (Math.random() * 2 - 1) * 14; const r = Math.abs(dy) / 122; label = r < 0.05 ? "X" : String(10 - Math.floor(r * 10)); setScore(label); };
    const set = (n: SVGElement, a: string, v: string) => n.setAttribute(a, v);

    const draw = (t: number) => {
      let dS = 0, ph = 0;
      if (t < T.draw0) ph = 0;
      else if (t < T.draw1) { dS = easeIO((t - T.draw0) / (T.draw1 - T.draw0)); ph = 1; }
      else if (t < T.rel) { dS = 1 + 0.004 * Math.sin(t * 11); ph = 2; }
      else if (t < SEP) { const k = (t - T.rel) / T.stroke; dS = 1 - k * k; ph = 3; }
      else { const u = t - SEP; dS = -0.12 * Math.exp(-u / 0.1) * Math.sin((2 * Math.PI * u) / 0.09); ph = t < HIT ? 3 : 4; }
      if (ph !== lastPhase) { lastPhase = ph; setPhase(ph); }
      const dl = Math.max(0, Math.min(1, dS));
      const bx = t >= T.rel ? 6 * Math.exp(-(t - T.rel) / 0.15) * Math.sin((2 * Math.PI * (t - T.rel)) / 0.26) : 0;
      const by = ph === 2 ? 0.9 * Math.sin((t - T.draw1) * 4.6) : 0;
      set(E.bow, "transform", `translate(${f(bx)} ${f(by)})`);
      const top = { x: G.top.x + G.flex.x * dl, y: G.top.y + G.flex.y * dl }, bot = { x: G.bot.x + G.flex.x * dl, y: G.bot.y - G.flex.y * dl };
      set(E.limbTop, "d", limb(G.pTop, top, 8, 4.5)); set(E.limbBot, "d", limb(G.pBot, bot, 8, 4.5));
      set(E.camTop, "transform", `translate(${f(top.x)} ${f(top.y)}) rotate(${(-150 * dS).toFixed(1)})`);
      set(E.camBot, "transform", `translate(${f(bot.x)} ${f(bot.y)}) rotate(${(150 * dS).toFixed(1)})`);
      [[E.c1, 6, 18], [E.c2, 13, 14]].forEach(([c, ox, oy]) => { const n = c as SVGElement; set(n, "x1", f(top.x + (ox as number))); set(n, "y1", f(top.y + (oy as number))); set(n, "x2", f(bot.x + (ox as number))); set(n, "y2", f(bot.y - (oy as number))); });
      const s1 = { x: top.x - G.camR, y: top.y }, s2 = { x: bot.x - G.camR, y: bot.y }, n = { x: G.brace - (G.brace - G.full) * dS, y: G.y };
      set(E.str, "points", `${f(s1.x)},${f(s1.y)} ${f(n.x)},${n.y} ${f(s2.x)},${f(s2.y)}`);
      const ux = s1.x - n.x, uy = s1.y - n.y, ul = Math.hypot(ux, uy), lx = s2.x - n.x, ly = s2.y - n.y, ll = Math.hypot(lx, ly);
      set(E.peep, "cx", f(n.x + (ux / ul) * 48)); set(E.peep, "cy", f(n.y + (uy / ul) * 48));
      set(E.loop, "d", `M${f(n.x + (ux / ul) * 8)} ${f(n.y + (uy / ul) * 8)} C${f(n.x - 13)} ${n.y - 8} ${f(n.x - 13)} ${n.y + 8} ${f(n.x + (lx / ll) * 8)} ${f(n.y + (ly / ll) * 8)}`);
      const finalX = tx - G.len, flightAng = (Math.atan2(dy, finalX - G.brace) * 180) / Math.PI;
      let ax: number, ay = G.y, ang = 0, op = 1, trail = 0;
      if (t < SEP) { ax = n.x; if (t < 0.45) { const e = easeOut(t / 0.45); ax = n.x + 26 * (1 - e); op = e; } }
      else if (t < HIT) { const fe = 1 - Math.pow(1 - (t - SEP) / T.flight, 1.2); ax = G.brace + (finalX - G.brace) * fe; ay = G.y + dy * fe; ang = flightAng; trail = 1; }
      else { const v = t - HIT; ax = finalX; ay = G.y + dy; ang = flightAng + 2.6 * Math.exp(-v / 0.16) * Math.sin((2 * Math.PI * v) / 0.11); trail = Math.max(0, 1 - v / 0.12); if (t > T.fade0) op = Math.max(0, 1 - (t - T.fade0) / (T.fade1 - T.fade0)); }
      let sh = 0; if (t >= HIT) { const v = t - HIT; sh = 3.2 * Math.exp(-v / 0.1) * Math.sin((2 * Math.PI * v) / 0.08); ax += sh; }
      set(E.target, "transform", `translate(${f(tx + sh)} ${G.y})`);
      set(E.arrow, "transform", `translate(${f(ax)} ${f(ay)}) rotate(${f(ang)} ${G.len} 0)`); set(E.arrow, "opacity", f(op));
      set(E.trail, "x", f(ax - 170)); set(E.trail, "y", f(ay - 1.2)); set(E.trail, "opacity", f(trail * 0.9));
      let so = 0, ss = 0.6; if (t >= HIT + 0.05) { const k = Math.min(1, (t - HIT - 0.05) / 0.28); ss = 0.6 + 0.4 * easeBack(k); so = Math.min(1, k * 1.6) * op; }
      set(E.score, "opacity", f(so)); set(E.score, "transform", `translate(${tx - 96} ${G.y - 118}) scale(${f(ss)})`);
    };
    const frame = (now: number) => {
      raf = 0; if (last == null) last = now;
      elapsed += Math.min(0.05, (now - last) / 1000); last = now;
      const nl = Math.floor(elapsed / T.loop); if (nl !== loopN) { loopN = nl; if (nl > 0) newShot(); }
      draw(elapsed % T.loop); schedule();
    };
    const schedule = () => { if (playRef.current && onScreen && !document.hidden && !raf) raf = requestAnimationFrame(frame); };
    const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = null; };
    const io = new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; if (onScreen) schedule(); else halt(); });
    const ro = new ResizeObserver(() => { setLayout(); draw(elapsed % T.loop); });
    const onVis = () => (document.hidden ? halt() : schedule());
    io.observe(el); ro.observe(el); document.addEventListener("visibilitychange", onVis);
    setLayout(); draw(elapsed % T.loop); schedule();
    (el as SVGSVGElement & { _toggle?: (p: boolean) => void })._toggle = (p) => { playRef.current = p; if (p) schedule(); else halt(); };
    return () => { halt(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const toggle = () => {
    const next = !playing; setPlaying(next);
    (svg.current as SVGSVGElement & { _toggle?: (p: boolean) => void })?._toggle?.(next);
  };

  return (
    <figure className="range">
      <svg ref={svg} viewBox={LAYOUT.wide.vb} role="img" aria-label="A compound bow is drawn, released, and the arrow hits the centre of the target. The animation loops.">
        <defs><linearGradient id="bs-tg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#6B766D" stopOpacity="0" /><stop offset="1" stopColor="#6B766D" stopOpacity=".55" /></linearGradient></defs>
        <rect x="0" y="470" width="1400" height="60" fill="#E6EBDD" fillOpacity=".7" />
        <line x1="0" y1="470" x2="1400" y2="470" stroke="#C6CDBF" strokeWidth="2" />
        <g stroke="#C6CDBF" strokeWidth="2">{Array.from({ length: 23 }, (_, i) => 150 + i * 50).map((x) => <line key={x} x1={x} y1="470" x2={x} y2={x % 250 === 0 ? 482 : 477} />)}</g>
        <path d="M470 470 l-9 14 h18 z" fill="#183F32" />
        <text className="scene-label" x="470" y="497" textAnchor="middle">SHOOTING LINE</text>
        <g id="bs-target" transform="translate(1080 262)">
          <line x1="-20" y1="-40" x2="-58" y2="208" stroke="#6B766D" strokeWidth="7" strokeLinecap="round" />
          <line x1="30" y1="-40" x2="74" y2="208" stroke="#C6CDBF" strokeWidth="7" strokeLinecap="round" />
          <line x1="22" y1="-40" x2="40" y2="208" stroke="#6B766D" strokeWidth="7" strokeLinecap="round" />
          <rect x="0" y="-122" width="16" height="244" fill="#C6CDBF" />
          <ellipse cx="16" rx="52" ry="122" fill="#C6CDBF" />
          <ellipse rx="52" ry="122" fill="#FFFFFF" stroke="#C6CDBF" strokeWidth="2" />
          <ellipse rx="41.6" ry="97.6" fill="#E6EBDD" /><ellipse rx="31.2" ry="73.2" fill="#6B766D" /><ellipse rx="20.8" ry="48.8" fill="#183F32" /><ellipse rx="10.4" ry="24.4" fill="#D8A928" />
          <ellipse rx="5.2" ry="12.2" fill="none" stroke="#183F32" strokeOpacity=".45" strokeWidth="1.2" />
          <line x1="0" y1="-122" x2="0" y2="-142" stroke="#6B766D" strokeWidth="3" />
          <rect x="-22" y="-172" width="44" height="32" rx="7" fill="#183F32" />
          <text x="0" y="-149" textAnchor="middle" fill="#FFFFFF" style={{ font: "800 20px var(--font-display)" }}>4</text>
        </g>
        <g id="bs-bow">
          <path id="bs-lt" fill="#183F32" /><path id="bs-lb" fill="#183F32" />
          <line id="bs-c1" stroke="#6B766D" strokeWidth="2" /><line id="bs-c2" stroke="#6B766D" strokeWidth="2" />
          <path fill="#183F32" d="M470 116 L499 116 C517 150 521 196 507 232 L495 250 C489 258 487 268 489 280 C493 300 501 318 515 336 C525 356 519 384 499 408 L470 408 C476 386 474 360 462 344 C450 330 446 306 450 286 C454 270 462 258 466 246 C474 226 478 196 474 168 C472 150 468 132 470 116 Z" />
          <path fill="#22533F" d="M451 286 C453 271 460 262 469 258 L487 264 C486 278 488 298 494 313 L471 333 C459 321 449 304 451 286 Z" />
          <g fill="#F7F7F0"><circle cx="491" cy="158" r="4.5" /><circle cx="496" cy="180" r="4.5" /><circle cx="495" cy="202" r="4.5" /><circle cx="499" cy="362" r="4.5" /><circle cx="503" cy="382" r="4.5" /></g>
          <rect x="503" y="222" width="62" height="7" rx="3" fill="#183F32" />
          <circle cx="578" cy="225" r="13" fill="none" stroke="#183F32" strokeWidth="4" /><circle cx="578" cy="225" r="2.6" fill="#D8A928" />
          <line x1="508" y1="326" x2="640" y2="326" stroke="#183F32" strokeWidth="7" strokeLinecap="round" />
          <rect x="636" y="316" width="26" height="20" rx="4" fill="#183F32" />
          <g id="bs-ct"><path d="M-22 -6 C-22 -22 4 -28 18 -18 C30 -8 28 14 12 22 C-2 30 -24 16 -22 -6 Z" fill="#FFFFFF" stroke="#183F32" strokeWidth="3.5" /><circle cx="7" cy="-8" r="5" fill="#E6EBDD" stroke="#183F32" strokeWidth="2" /><circle r="3.6" fill="#183F32" /></g>
          <g id="bs-cb"><path d="M-22 6 C-22 22 4 28 18 18 C30 8 28 -14 12 -22 C-2 -30 -24 -16 -22 6 Z" fill="#FFFFFF" stroke="#183F32" strokeWidth="3.5" /><circle cx="7" cy="8" r="5" fill="#E6EBDD" stroke="#183F32" strokeWidth="2" /><circle r="3.6" fill="#183F32" /></g>
          <polyline id="bs-str" fill="none" stroke="#183F32" strokeWidth="2.4" strokeLinejoin="round" />
          <circle id="bs-peep" r="5" fill="#F7F7F0" stroke="#183F32" strokeWidth="2.5" />
          <path id="bs-loop" fill="none" stroke="#7A5A00" strokeWidth="2.4" />
        </g>
        <rect id="bs-trail" height="2.4" width="176" fill="url(#bs-tg)" opacity="0" />
        <g id="bs-arrow">
          <rect x="0" y="-2.6" width="11" height="5.2" rx="1.5" fill="#22533F" />
          <path d="M14 -2 L44 -2 L38 -12 L22 -12 Z" fill="#D8A928" /><path d="M14 2 L44 2 L38 12 L22 12 Z" fill="#6B766D" />
          <line x1="10" y1="0" x2="298" y2="0" stroke="#183F32" strokeWidth="4" strokeLinecap="round" />
          <path d="M296 -3.6 L310 0 L296 3.6 Z" fill="#183F32" />
        </g>
        <g id="bs-score" opacity="0">
          <rect x="-34" y="-22" width="68" height="44" rx="12" fill="#F6EBC8" stroke="#D8A928" strokeWidth="2" />
          <text x="0" y="9" textAnchor="middle" fill="#7A5A00" style={{ font: "900 26px var(--font-display)" }}>{score}</text>
        </g>
      </svg>
      <figcaption className="range-bar">
        <ol className="phases" aria-hidden="true">
          {PHASES.map((p, i) => <li key={p} className={i === phase ? (i === 4 ? "on hit" : "on") : undefined}>{i === 4 && phase === 4 ? `Hit · ${score}` : p}</li>)}
        </ol>
        <button type="button" className="anim-toggle" aria-pressed={!playing} onClick={toggle}>{playing ? "Pause animation" : "Play animation"}</button>
      </figcaption>
    </figure>
  );
}
