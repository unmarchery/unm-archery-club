"use client";

import Link from "next/link";
import { useState } from "react";

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

export function Board({ rows, tier }: { rows: Standing[]; tier: string }) {
  const [all, setAll] = useState(false);
  const podium = rows.slice(0, 3), rest = rows.slice(3);
  const long = rows.length > 10;
  if (rows.length === 0) return <p className="muted" style={{ textAlign: "center" }}>No scores in {tier} yet. They appear after the first rank match.</p>;
  return (
    <>
      <ol className="podium" aria-label="Top three">
        {podium.map((s, i) => (
          <li key={i} className={`p${i + 1}`}>
            <span className="avatar lg">{initials(s.name ?? s.username ?? "?")}</span>
            <span className="podium-name"><Archer s={s} tier={tier} /></span>
            <span className="podium-score">{s.score}</span>
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
                  <td className="lb-score">{s.score}</td>
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
