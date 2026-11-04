"use client";

import { useState, useTransition } from "react";
import { setOpening } from "./actions";

type Choice = "weekly" | "open" | "w1" | "w2" | "locked";
const LABELS: [Choice, string][] = [["weekly", "Weekly rule"], ["open", "Open now"], ["w1", "1 week before"], ["w2", "2 weeks before"], ["locked", "Lock"]];

// One training day's booking state, changed with a tap.
export function OpeningControl({ day, label, current, note }: { day: string; label: string; current: Choice; note: string }) {
  const [choice, setChoice] = useState<Choice>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pick = (c: Choice) => {
    setError(null);
    start(async () => {
      const res = await setOpening(day, c);
      if (res.ok) setChoice(c); else setError(res.message);
    });
  };
  return (
    <div className="opening-row">
      <div><div className="strong">{label}</div><div className="muted small">{note}</div></div>
      <div className="seg" role="group" aria-label={`Booking for ${label}`}>
        {LABELS.map(([c, l]) => <button key={c} type="button" className={choice === c ? "on" : ""} aria-pressed={choice === c} disabled={pending} onClick={() => pick(c)}>{l}</button>)}
      </div>
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
