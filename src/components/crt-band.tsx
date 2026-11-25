"use client";

import { useEffect, useRef } from "react";

// CRT ASCII band (handoff 5.6), ported from design/unm-archery-prototype/components/crt-title.js.
// The title is drawn in terminal glyphs coloured by density; the glyphs never move, only the light shimmers.
// Every 9–16 s a vertical light line sweeps left→right switching the block off, then a second sweep
// switches it back on. The first view powers on with the "on" sweep. A column switched off keeps a
// 160 ms phosphor afterglow, and a sweep only ends once its trail has left the box.
// Colours come from the palette (--crt-*) or an event class on the band (.crt--robin, .crt--cupid …).

const BG_GLYPHS = ".:-=+/%&$#0@";
const SWEEP_MS = 1100, HOLD_MS = 520, BAND = 3, TRAIL = 14, AFTERGLOW = 160;
type FontKey = "fat" | "slim";
const FONTS: Record<FontKey, { weight: number; stretch: CanvasFontStretch }> = {
  fat: { weight: 900, stretch: "expanded" },
  slim: { weight: 700, stretch: "normal" },
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const hex = (c: string) => {
  c = c.trim();
  if (c.startsWith("#") && c.length === 4) c = "#" + [...c.slice(1)].map((x) => x + x).join("");
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
};

export function CrtBand({ title, tag, as: Tag = "h2", id, font = "fat", className = "" }: {
  title: string; tag?: string; as?: "h1" | "h2" | "h3"; id?: string; font?: FontKey; className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text = title.trim().replace(/\s+/g, " ");

  useEffect(() => {
    const root = rootRef.current!, canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tagText = tag ? `[ ${tag} ]` : "";
    const cs0 = getComputedStyle(root);
    const display = cs0.getPropertyValue("--font-archivo").trim() || "sans-serif";
    const mono = cs0.getPropertyValue("--font-jetbrains").trim() || "ui-monospace, monospace";
    let dead = false;

    let cols = 0, rows = 0, cw = 0, chh = 0, ox = 0, oy = 0, W = 0, H = 0;
    let dens = new Float32Array(0), glyphs: string[] = [], tagRow = new Map<number, string>();
    let LIT: string[] = [], OFF: string[] = [];
    const SCAN = { ramp: [] as string[], white: "", beam: "" };
    let linesKey = "", lines = 1;

    /* ---------- colours from the palette ---------- */
    function readColours() {
      const cs = getComputedStyle(root);
      const stops = ["--crt-off", "--crt-1", "--crt-2", "--crt-3", "--crt-4"].map((v) => hex(cs.getPropertyValue(v) || "#204030"));
      const glass = hex(cs.getPropertyValue("--crt-glass") || "#030906");
      const scan = hex(cs.getPropertyValue("--crt-scan") || "#b6fff4");
      const mix = (a: number[], b: number[], f: number) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
      const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
      LIT = Array.from({ length: 48 }, (_, i) => {
        const x = (i / 47) * 3, k = Math.min(2, x | 0);
        return rgb(mix(stops[k + 1], stops[Math.min(4, k + 2)], x - k));
      });
      OFF = Array.from({ length: 16 }, (_, i) => rgb(mix(glass, stops[0], i / 15)));
      SCAN.ramp = Array.from({ length: 16 }, (_, i) => rgb(mix(stops[2], scan, i / 15)));
      SCAN.white = rgb(mix(scan, [255, 255, 255], .6));
      SCAN.beam = `rgba(${scan[0]},${scan[1]},${scan[2]},.28)`;
    }

    function setFont(c: CanvasRenderingContext2D, fs: number) {
      const f = FONTS[font];
      c.font = `${f.weight} ${fs}px ${display}`;
      // narrow screens: a narrower cut keeps the letters tall enough to read in cells
      if ("fontStretch" in c) c.fontStretch = root.clientWidth < 640 && f.stretch === "expanded" ? "semi-condensed" : f.stretch;
    }
    function fitSize(textLines: string[], w: number, h: number) {
      const m = document.createElement("canvas").getContext("2d")!;
      setFont(m, 100);
      const widest = Math.max(...textLines.map((l) => m.measureText(l).width));
      return Math.min(((w * .86) / widest) * 100, (h * .74) / (textLines.length * .92));
    }
    function split2(words: string[]) {
      let best: { m: number; l: string[] } | null = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
        const m = Math.max(a.length, b.length);
        if (!best || m < best.m) best = { m, l: [a, b] };
      }
      return best ? best.l : [words.join(" ")];
    }

    /* ---------- layout + rasterise the title into cell densities ---------- */
    function layout() {
      const probe = document.createElement("i");
      probe.style.cssText = "position:absolute;width:var(--cell);height:0;visibility:hidden";
      root.append(probe);
      const cell = probe.getBoundingClientRect().width || 8;
      probe.remove();
      cw = cell; chh = cell * 1.18;
      const avail = root.clientWidth;
      const key = `${avail}|${font}`;
      if (key !== linesKey) {
        linesKey = key;
        root.dataset.lines = "1";
        const h1 = root.clientHeight;
        const words = text.split(" ");
        const f1 = fitSize([text], avail, h1), f2 = words.length > 1 ? fitSize(split2(words), avail, h1 * 1.55) : 0;
        lines = f2 > f1 * 1.25 ? 2 : 1;
        root.dataset.lines = String(lines);
      }
      W = root.clientWidth; H = root.clientHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(W / cw); rows = Math.floor(H / chh);
      ox = (W - cols * cw) / 2; oy = (H - rows * chh) / 2;
      if (cols < 3 || rows < 3) { cols = 0; return; }

      const textLines = lines === 2 ? split2(text.split(" ")) : [text];
      const fs = fitSize(textLines, W, H);
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(cols * cw)); off.height = Math.max(1, Math.round(rows * chh));
      const o = off.getContext("2d", { willReadFrequently: true })!;
      setFont(o, fs);
      o.fillStyle = "#fff"; o.textAlign = "center"; o.textBaseline = "middle";
      const lh = fs * .92, top = off.height / 2 - (textLines.length - 1) * lh / 2 + fs * .04;
      textLines.forEach((l, i) => o.fillText(l, off.width / 2, top + i * lh));
      const img = o.getImageData(0, 0, off.width, off.height).data;
      dens = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = Math.round(c * cw), x1 = Math.round((c + 1) * cw), y0 = Math.round(r * chh), y1 = Math.round((r + 1) * chh);
          let sum = 0, n = 0;
          for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { sum += img[(y * off.width + x) * 4 + 3]; n++; }
          dens[r * cols + c] = n ? sum / n / 255 : 0;
        }
      }
      glyphs = new Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = dens[r * cols + c], h = hash(c, r);
          let g: string;
          if (d > .82) g = h < .8 ? "$" : "@";
          else if (d > .55) g = "&@%$0#"[(h * 6) | 0];
          else if (d > .28) g = "%#0=+&"[(h * 6) | 0];
          else if (d > .08) g = "+=/:-%"[(h * 6) | 0];
          else g = hash(r, c) < .72 ? BG_GLYPHS[(h * BG_GLYPHS.length) | 0] : " ";
          if (r === 0 || r === rows - 1) g = (c === 0 || c === cols - 1) ? "+" : "-";
          else if (c === 0 || c === cols - 1) g = "|";
          glyphs[r * cols + c] = g;
        }
      }
      tagRow = new Map();
      if (tagText && cols > tagText.length + 8) [...tagText, " ", "█"].forEach((ch, i) => tagRow.set(3 + i, ch));
      ctx.font = `800 ${chh * .9}px ${mono}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      draw(performance.now());
    }

    /* ---------- render ---------- */
    type Mode = "on" | "dark" | "sweep-off" | "sweep-on";
    let mode: Mode = reduce ? "on" : "dark", waveX = -10, waveT0 = 0;
    let colOffAt: Float64Array | null = null;
    const colLevel = (c: number) => (mode === "on" ? 1 : mode === "dark" ? 0 : mode === "sweep-off" ? (c > waveX ? 1 : 0) : (c < waveX ? 1 : 0));

    function draw(now: number) {
      if (!cols) return;
      ctx.clearRect(0, 0, W, H);
      const T = now / 1000;
      const sweeping = mode === "sweep-off" || mode === "sweep-on";
      if (sweeping) {
        const bx = ox + (waveX + 1) * cw, trail = cw * TRAIL;
        const g = ctx.createLinearGradient(bx - trail, 0, bx, 0);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, SCAN.beam);
        ctx.fillStyle = g; ctx.fillRect(bx - trail, 0, trail, H);
        ctx.fillStyle = SCAN.white; ctx.globalAlpha = .55; ctx.fillRect(bx - cw * .5, 0, cw * .5, H); ctx.globalAlpha = 1;
      }
      for (let r = 0; r < rows; r++) {
        const y = oy + (r + .5) * chh;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          let g = glyphs[i];
          if (r === 0 && tagRow.has(c)) g = tagRow.get(c)!;
          const d = dens[i], x = ox + (c + .5) * cw;
          const dist = sweeping ? waveX - c : 99;
          if (sweeping && dist >= 0 && dist < BAND) {
            if (g === " ") g = "|";
            ctx.fillStyle = dist < 1 ? SCAN.white : SCAN.ramp[Math.max(0, 15 - Math.round(dist * 5))];
            ctx.fillText(g, x, y);
            continue;
          }
          if (g === " ") continue;
          const lvl = colLevel(c);
          let glow = 0;
          if (!lvl && colOffAt && colOffAt[c]) glow = Math.max(0, .5 * (1 - (now - colOffAt[c]) / AFTERGLOW));
          const on = lvl || glow;
          if (!on) continue;
          const isTag = r === 0 && tagRow.has(c);
          if (d > .08 || isTag) {
            const p = (Math.sin(c * .11 + T * 1.1) + Math.sin(r * .35 - T * 1.4) + Math.sin((c + r) * .07 + T * .7) + 3) / 6;
            let L = isTag ? .55 : Math.min(1, Math.max(0, d * .92 + (p - .5) * .32 + .04));
            if (mode === "sweep-on" && dist >= BAND && dist < BAND + 6) L = Math.min(1, L + (1 - (dist - BAND) / 6) * .35);
            ctx.globalAlpha = on;
            ctx.fillStyle = LIT[Math.round(L * 47)];
          } else {
            const edge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
            ctx.globalAlpha = on;
            ctx.fillStyle = OFF[edge ? 15 : 6 + Math.round(hash(c * 3, r * 7) * 9)];
          }
          ctx.fillText(g, x, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- sweeps ---------- */
    let raf = 0, lastIdle = 0, visible = false, timer = 0, busy = false, holdTimer = 0;
    function sweep(kind: "sweep-off" | "sweep-on") {
      return new Promise<void>((res) => {
        mode = kind; waveT0 = performance.now(); waveX = -BAND;
        if (kind === "sweep-off") colOffAt = new Float64Array(cols + 1);
        const END = cols + TRAIL, dist = END + BAND;
        let endAt = 0;
        const step = (now: number) => {
          if (dead) return res();
          const prev = waveX;
          waveX = Math.min(END, -BAND + ((now - waveT0) / SWEEP_MS) * dist);
          if (kind === "sweep-off" && colOffAt) for (let c = Math.max(0, Math.floor(prev)); c <= Math.min(cols - 1, Math.floor(waveX)); c++) if (!colOffAt[c]) colOffAt[c] = now;
          draw(now);
          if (waveX >= END && !endAt) endAt = now;
          if (!endAt || now - endAt < AFTERGLOW) requestAnimationFrame(step);
          else { mode = kind === "sweep-off" ? "dark" : "on"; colOffAt = null; draw(performance.now()); res(); }
        };
        requestAnimationFrame(step);
      });
    }
    async function cycle() {
      if (busy || reduce || dead) return;
      busy = true;
      if (mode !== "dark") {
        await sweep("sweep-off");
        await new Promise<void>((r) => { holdTimer = window.setTimeout(r, HOLD_MS); });
      }
      await sweep("sweep-on");
      busy = false; schedule();
    }
    function powerOn() { if (busy || reduce) return; mode = "dark"; draw(performance.now()); cycle(); }
    function schedule() {
      window.clearTimeout(timer);
      if (visible && !reduce && !dead) timer = window.setTimeout(cycle, rand(9000, 16000));
    }
    // idle shimmer at ~20fps while visible and not sweeping
    function idle(now: number) {
      if (!visible || dead) { raf = 0; return; }
      if (!busy && now - lastIdle > 50) { lastIdle = now; draw(now); }
      raf = requestAnimationFrame(idle);
    }

    let ro: ResizeObserver | null = null, io: IntersectionObserver | null = null;
    const start = () => {
      if (dead) return;
      readColours();
      layout();
      let lastW = root.clientWidth, lastH = root.clientHeight;
      ro = new ResizeObserver(() => {
        if (root.clientWidth !== lastW || root.clientHeight !== lastH) { lastW = root.clientWidth; lastH = root.clientHeight; layout(); }
      });
      ro.observe(root);
      let powered = false;
      io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !reduce && !raf) raf = requestAnimationFrame(idle);
        if (visible && !powered) { powered = true; powerOn(); } else schedule();
      }, { threshold: .4 });
      io.observe(root);
    };
    Promise.all([
      document.fonts.load(`900 64px ${display}`),
      document.fonts.load(`800 16px ${mono}`),
    ]).then(start, start);

    return () => {
      dead = true;
      ro?.disconnect(); io?.disconnect();
      window.clearTimeout(timer); window.clearTimeout(holdTimer);
      cancelAnimationFrame(raf);
    };
  }, [text, tag, font]);

  return (
    <div ref={rootRef} className={`crt-title ${className}`.trim()} data-tag={tag}>
      <Tag id={id}>{text}</Tag>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
