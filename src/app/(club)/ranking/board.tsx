"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Standing = { place: number; username: string | null; name: string | null; score: number; me: boolean };
const ord = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const initials = (s: string) => s.split(/[\s._]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

// A name that links to the archer's profile, with a small card on hover or keyboard focus.
function Archer({ s, tier }: { s: Standing; tier: string }) {
  const label = s.name ?? `@${s.username}`;
  if (!s.username) return <span>{label}</span>;
  return (
    <span className="ulink-wrap">
      <Link href={`/u/${s.username}`} className="ulink">{label}</Link>
      <span className="hovercard" role="tooltip">
        <span className="avatar">{initials(s.name ?? s.username)}</span>
        <span><strong>{label}</strong><span className="muted small">@{s.username}</span><span className="small">{ord(s.place)} in {tier} · best {s.score}</span></span>
      </span>
    </span>
  );
}

// A score that counts up once, the first time it comes into view (still under reduced motion).
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 900), eased = 1 - (1 - k) ** 3;
        el.textContent = String(Math.round(value * eased));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      el.textContent = "0";
      raf = requestAnimationFrame(step);
    }, { threshold: .6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

export function Board({ rows, tier }: { rows: Standing[]; tier: string }) {
  const [all, setAll] = useState(false);
  const podium = rows.slice(0, 3), rest = rows.slice(3);
  const long = rows.length > 10;
  const top = Math.max(1, ...rows.map((r) => r.score));
  if (rows.length === 0) return <p className="muted" style={{ textAlign: "center" }}>No scores in {tier} yet. They appear after the first rank match.</p>;
  return (
    <>
      <ol className="podium" aria-label="Top three">
        {podium.map((s, i) => (
          <li key={i} className={`p${i + 1}`}>
            <span className="avatar lg">{initials(s.name ?? s.username ?? "?")}</span>
            <span className="podium-name"><Archer s={s} tier={tier} /></span>
            <span className="podium-score"><CountUp value={s.score} /></span>
            <span className="podium-block" aria-hidden="true">{i + 1}</span>
            <span className="sr-only">{ord(s.place)} place, score {s.score}</span>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <div className={`lb-wrap${long && !all ? " collapsed" : ""}`} id="lb-wrap">
          <table className="lb">
            <caption className="sr-only">Places 4 to {rows.length}</caption>
            <thead><tr><th scope="col">Place</th><th scope="col">Archer</th><th scope="col">Score</th></tr></thead>
            <tbody>
              {rest.map((s, i) => (
                <tr key={i} className={s.me ? "me" : undefined}>
                  <td>{ord(s.place)}</td>
                  <td><Archer s={s} tier={tier} />{s.me && <span className="pill gold" style={{ marginLeft: 8 }}>You</span>}</td>
                  <td className="lb-score">
                    <span className="lb-bar" aria-hidden="true"><i style={{ "--w": `${Math.round((s.score / top) * 100)}%` } as React.CSSProperties} /></span>
                    <CountUp value={s.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {long && <button type="button" className="btn btn-ghost btn-sm lb-toggle" aria-expanded={all} aria-controls="lb-wrap" onClick={() => setAll((v) => !v)}>{all ? "Show top 10 only" : `Show all ${rows.length} archers`}</button>}
    </>
  );
}
