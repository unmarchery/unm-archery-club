"use client";

import { useState, useTransition } from "react";
import { toggleReaction } from "./actions";

export const REACTS: [string, string, string][] = [["clap", "👏", "Applause"], ["fire", "🔥", "On fire"], ["target", "🎯", "Bullseye"], ["strong", "💪", "Strong"], ["star", "⭐", "Star"]];

type Props = { target: string; username: string; counts: Record<string, number>; mine: string[]; canReact: boolean };

// Supportive emoji only, counts only: reactions cheer people on without starting arguments.
export function Reactions({ target, username, counts, mine, canReact }: Props) {
  const [on, setOn] = useState(new Set(mine));
  const [base] = useState(() => Object.fromEntries(REACTS.map(([k]) => [k, (counts[k] ?? 0) - (mine.includes(k) ? 1 : 0)])));
  const [pop, setPop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const tap = (k: string) => {
    if (!canReact) return;
    setError(null);
    const next = new Set(on);
    if (next.has(k)) next.delete(k); else next.add(k);
    setOn(next);
    setPop(next.has(k) ? k : null);
    start(async () => {
      const res = await toggleReaction(target, k, username);
      if (!res.ok) { setOn(new Set(on)); setError(res.message); }
    });
  };

  return (
    <>
      <div className="reacts">
        {REACTS.map(([k, e, label]) => {
          const c = base[k] + (on.has(k) ? 1 : 0);
          return (
            <button key={k} type="button" className={`react${on.has(k) ? " on" : ""}${pop === k ? " pop" : ""}`} aria-pressed={on.has(k)} aria-label={`${label}, ${c}`} disabled={!canReact} onClick={() => tap(k)} onAnimationEnd={() => setPop(null)}>
              <span className="emo" aria-hidden="true">{e}</span><span>{c}</span>
              {pop === k && <span className="react-float" aria-hidden="true">{e}</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
