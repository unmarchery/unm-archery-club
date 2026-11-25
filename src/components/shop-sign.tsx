"use client";

import { useEffect, useRef } from "react";

// Neon ASCII shop sign (handoff 5.5), ported from design/unm-archery-prototype/components/shop-sign.js.
// Builds an ASCII frame around the title, powers on once when scrolled into view, then shorts out a
// letter or a stretch of frame every 6–14 s with a small shower of sparks.
// Every sign on a page shares one size, set by the longest title.

type Size = { cols: number; rows: number };
type Instance = { rebuild: (min?: Size) => void; natural: () => Size };

const PAD_X = 3, PAD_Y = 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Page-wide registry, so all signs on the page can be laid out to the largest one.
const signs = new Set<Instance>();
let layoutTimer = 0;
function layoutAll() {
  window.clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(() => {
    const list = [...signs];
    list.forEach((s) => s.rebuild());
    const n = list.map((s) => s.natural());
    const min = { cols: Math.max(0, ...n.map((x) => x.cols)), rows: Math.max(0, ...n.map((x) => x.rows)) };
    list.forEach((s) => s.rebuild(min));
  }, 30);
}

export function ShopSign({ title, tag, as: Tag = "h2", id, className = "" }: { title: string; tag?: string; as?: "h1" | "h2"; id?: string; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLPreElement>(null);
  const sparksRef = useRef<HTMLCanvasElement>(null);
  const text = title.trim().replace(/\s+/g, " ");

  useEffect(() => {
    const root = rootRef.current!, frame = frameRef.current!, sparks = sparksRef.current!;
    const sctx = sparks.getContext("2d")!;
    const title = root.querySelector<HTMLElement>(".sign__title")!;
    const letters = [...root.querySelectorAll<HTMLElement>(".sign__ch")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tagText = tag ? `[ ${tag} ]` : "";
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    let chars: HTMLElement[] = [], lit = false, visible = false, timer = 0, dead = false;
    let natural: Size = { cols: 0, rows: 0 };

    /* ---------- frame ---------- */
    function build(min: Size = { cols: 0, rows: 0 }) {
      frame.innerHTML = "<span>MMMMMMMMMM</span>";
      const pr = (frame.firstChild as HTMLElement).getBoundingClientRect();
      const cw = pr.width / 10 || 8, lh = pr.height || 16;
      root.style.width = root.style.height = "";
      const avail = root.parentElement!.clientWidth;
      title.style.maxWidth = `${Math.max(120, avail - (PAD_X * 2 + 1) * cw)}px`;
      const tr = title.getBoundingClientRect();
      natural = { cols: Math.ceil(tr.width / cw) + PAD_X * 2, rows: Math.ceil(tr.height / lh) + PAD_Y * 2 };
      const cols = Math.min(Math.floor(avail / cw), Math.max(natural.cols, min.cols));
      const rows = Math.max(natural.rows, min.rows);
      root.style.width = `${cols * cw}px`; root.style.height = `${rows * lh}px`;

      const grid: [string, string][][] = [];
      for (let y = 0; y < rows; y++) {
        const row: [string, string][] = [];
        for (let x = 0; x < cols; x++) {
          const top = y === 0, bot = y === rows - 1, left = x === 0, right = x === cols - 1;
          let ch = " ", cls = "";
          if ((top || bot) && (left || right)) { ch = "*"; cls = "is-stud"; }
          else if (top || bot) { ch = x % 14 === 7 ? "o" : "="; cls = ch === "o" ? "is-stud" : ""; }
          else if (left || right) ch = "|";
          else if ((y === 1 || y === rows - 2) && x > 1 && x < cols - 2) { ch = x % 2 ? "-" : " "; cls = "is-rail"; }
          else if ((x === 2 || x === cols - 3) && y > 1 && y < rows - 2) { ch = ":"; cls = "is-rail"; }
          row.push([ch, cls]);
        }
        grid.push(row);
      }
      if (tagText && cols > tagText.length + 8) [...tagText].forEach((c, i) => { grid[0][4 + i] = [c, "is-tag"]; });

      // Clockwise perimeter position 0..1 from the top-left corner, for the power-on sweep
      const W = cols - 1, H = rows - 1, per = 2 * (W + H);
      const along = (x: number, y: number) => {
        const dt = y, db = H - y, dl = x, dr = W - x, m = Math.min(dt, db, dl, dr);
        const p = m === dt ? x : m === dr ? W + y : m === db ? W + H + (W - x) : 2 * W + H + (H - y);
        return p / per;
      };
      const esc = (c: string) => (c === "<" ? "&lt;" : c === "&" ? "&amp;" : c === ">" ? "&gt;" : c);
      frame.innerHTML = grid.map((row, y) => row.map(([c, cls], x) =>
        c === " " ? " " : `<b class="${cls}" data-p="${along(x, y).toFixed(3)}">${esc(c)}</b>`,
      ).join("")).join("\n");
      chars = [...frame.querySelectorAll<HTMLElement>("b")];
      if (lit) chars.forEach((b) => b.classList.add("is-on"));

      const dpr = Math.min(2, devicePixelRatio || 1);
      sparks.width = (cols * cw + 120) * dpr; sparks.height = (rows * lh + 120) * dpr;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---------- power-on ---------- */
    let seq = 0;
    function powerOn() {
      const run = ++seq;
      window.clearTimeout(timer); lit = false;
      root.classList.remove("is-lit", "is-humming");
      chars.forEach((b) => b.classList.remove("is-on", "is-fault"));
      letters.forEach((l) => l.classList.remove("is-on", "is-fault", "ignite-a", "ignite-b", "ignite-c"));
      if (reduce) { finish(); return; }

      const SWEEP = 620, t0 = performance.now();
      const pending = chars.map((b) => ({ b, at: +(b.dataset.p ?? 0) * SWEEP + (Math.random() < .08 ? rand(80, 260) : 0) }));
      const sweep = (now: number) => {
        if (run !== seq || dead) return;
        const t = now - t0;
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i].at <= t) { pending[i].b.classList.add("is-on"); pending.splice(i, 1); }
        }
        if (pending.length) requestAnimationFrame(sweep);
      };
      requestAnimationFrame(sweep);

      const order = letters.map((_, i) => i).sort(() => Math.random() - .5);
      order.forEach((idx, k) => {
        later(() => {
          if (run !== seq) return;
          const l = letters[idx];
          l.classList.add("is-on", `ignite-${"abc"[(Math.random() * 3) | 0]}`);
          l.addEventListener("animationend", () => l.classList.remove("ignite-a", "ignite-b", "ignite-c"), { once: true });
        }, 520 + k * (620 / letters.length) + rand(0, 140));
      });
      later(() => { if (run === seq) finish(); }, 1480);
    }

    function finish() {
      lit = true;
      chars.forEach((b) => b.classList.add("is-on"));
      letters.forEach((l) => l.classList.add("is-on"));
      root.classList.add("is-lit");
      if (!reduce) {
        root.classList.add("is-humming");
        later(() => root.classList.remove("is-humming"), 520);
        schedule();
      }
    }

    /* ---------- faults + sparks ---------- */
    function schedule() {
      window.clearTimeout(timer);
      if (visible && lit && !reduce && !dead) timer = window.setTimeout(() => { spark(); schedule(); }, rand(6000, 14000));
    }

    function spark() {
      if (!lit || !letters.length) return;
      let targets: HTMLElement[];
      if (Math.random() < .7) {
        const i = (Math.random() * letters.length) | 0;
        targets = [letters[i]];
        if (Math.random() < .2 && letters[i + 1]) targets.push(letters[i + 1]);
      } else {
        const edge = chars.filter((b) => !b.classList.contains("is-rail"));
        const i = (Math.random() * Math.max(1, edge.length - 6)) | 0;
        targets = edge.slice(i, i + 3 + ((Math.random() * 4) | 0));
      }
      if (!targets.length) return;
      targets.forEach((el) => {
        el.classList.remove("is-fault"); void el.offsetWidth;
        el.classList.add("is-fault");
        el.addEventListener("animationend", () => el.classList.remove("is-fault"), { once: true });
      });
      const a = targets[0].getBoundingClientRect(), b = targets[targets.length - 1].getBoundingClientRect();
      const c = sparks.getBoundingClientRect();
      const x = (a.left + b.right) / 2 - c.left, y = (a.top + a.bottom) / 2 - c.top;
      burst(x, y); later(() => burst(x, y, .5), 380);
    }

    type Part = { x: number; y: number; vx: number; vy: number; life: number; age: number; flash?: boolean };
    let parts: Part[] = [], raf = 0, last = 0;
    function burst(x: number, y: number, scale = 1) {
      if (dead) return;
      const n = Math.round(rand(4, 8) * scale) || 2;
      for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-150, 150), vy: rand(-230, -50), life: rand(.45, .9), age: 0 });
      parts.push({ flash: true, x, y, vx: 0, vy: 0, life: .14, age: 0 });
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function tick(now: number) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const tube = getComputedStyle(root).getPropertyValue("--tube").trim() || "#5fe3d6";
      sctx.clearRect(0, 0, sparks.width, sparks.height);
      sctx.lineCap = "round";
      parts = parts.filter((p) => (p.age += dt) < p.life);
      for (const p of parts) {
        const k = 1 - p.age / p.life;
        if (p.flash) {
          const g = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
          g.addColorStop(0, `rgba(255,246,216,${k})`); g.addColorStop(1, "rgba(255,246,216,0)");
          sctx.fillStyle = g; sctx.fillRect(p.x - 26, p.y - 26, 52, 52);
          continue;
        }
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        sctx.globalAlpha = k;
        sctx.strokeStyle = k > .55 ? "#fff6d8" : tube;
        sctx.lineWidth = 1.8;
        sctx.shadowColor = tube; sctx.shadowBlur = 8;
        sctx.beginPath(); sctx.moveTo(p.x, p.y); sctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); sctx.stroke();
      }
      sctx.globalAlpha = 1; sctx.shadowBlur = 0;
      raf = parts.length && !dead ? requestAnimationFrame(tick) : 0;
      if (!raf) sctx.clearRect(0, 0, sparks.width, sparks.height);
    }

    /* ---------- lifecycle ---------- */
    const inst: Instance = { rebuild: build, natural: () => natural };
    build();
    signs.add(inst);
    let powered = false;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !powered) { powered = true; powerOn(); }
      else schedule();
    }, { threshold: .5 });
    // Wait for the web fonts so the frame is measured against the real letters.
    document.fonts.ready.then(() => { if (dead) return; layoutAll(); io.observe(root); });

    let w = innerWidth;
    const onResize = () => { if (innerWidth === w) return; w = innerWidth; layoutAll(); };
    addEventListener("resize", onResize);

    return () => {
      dead = true;
      signs.delete(inst);
      io.disconnect();
      removeEventListener("resize", onResize);
      window.clearTimeout(timer);
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
      layoutAll();
    };
  }, [text, tag]);

  return (
    <div ref={rootRef} className={`sign ${className}`.trim()} data-tag={tag}>
      <pre ref={frameRef} className="sign__frame" aria-hidden="true" />
      <Tag className="sign__title" id={id} aria-label={text}>
        <span aria-hidden="true">
          {text.split(" ").map((word, wi) => (
            <span key={wi}>
              {wi > 0 && " "}
              <span className="sign__word" style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                {[...word].map((c, ci) => <span key={ci} className="sign__ch">{c}</span>)}
              </span>
            </span>
          ))}
        </span>
      </Tag>
      <canvas ref={sparksRef} className="sign__sparks" aria-hidden="true" />
    </div>
  );
}
