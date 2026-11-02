"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CloseIcon } from "@/components/icons";
import { dayLabel } from "@/lib/format";
import { setDuty, setMyDuty } from "./actions";

type Person = { id: string; full_name: string; position: string | null; me?: boolean };
export type Roster = {
  can_sign: boolean;
  can_manage: boolean;
  can_attend: boolean;
  min_people: number;
  today: string;
  days: { day: string; people: Person[] }[];
  team: Person[];
};

export function RosterDay({ day, roster }: { day: Roster["days"][number]; roster: Roster }) {
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mine = day.people.some((p) => p.me);
  const short = roster.min_people - day.people.length;
  const others = roster.team.filter((t) => !day.people.some((p) => p.id === t.id));

  function run(job: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (!res.ok) setError(res.message ?? "Something went wrong.");
    });
  }

  return (
    <section className="card">
      <div className="row">
        <div className="h2">{dayLabel(day.day)}{day.day === roster.today ? " · today" : ""}</div>
        {short > 0 ? (
          <span className="tag"><span className="dot" style={{ background: "var(--amber)" }} />{day.people.length === 0 ? "Nobody yet" : `Needs ${short} more`}</span>
        ) : (
          <span className="tag"><span className="dot" style={{ background: "var(--gold)" }} />{day.people.length} on duty</span>
        )}
      </div>
      {day.people.length > 0 ? (
        <div className="tags">
          {day.people.map((p) => (
            <span key={p.id} className={`pill${p.me ? " gold" : ""}`}>
              {p.full_name}
              {roster.can_manage && (
                <button type="button" className="pill-x" aria-label={`Take ${p.full_name} off duty`} disabled={pending} onClick={() => run(() => setDuty(day.day, p.id, false))}>
                  <CloseIcon />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>Nobody has signed up yet.</p>
      )}
      {short > 0 && day.people.length > 0 && (
        <p className="small" style={{ margin: 0 }}>Only {day.people.length} on duty. Someone else needs to take this day.</p>
      )}
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {roster.can_sign && (
          <button type="button" className={`btn btn-sm${mine ? " btn-ghost" : ""}`} disabled={pending} onClick={() => run(() => setMyDuty(day.day, !mine))}>
            {pending && <span className="spinner" aria-hidden="true" />}
            {mine ? "I can't make it" : "I'll be on duty"}
          </button>
        )}
        {roster.can_attend && day.day === roster.today && (
          <Link className="btn btn-sm" href={`/exco/duty/${day.day}`}>Open attendance</Link>
        )}
      </div>
      {roster.can_manage && others.length > 0 && (
        <div className="filters">
          <label className="field">
            <span className="field-label">Put someone on duty</span>
            <select className="input" value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">Choose…</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}{t.position ? ` (${t.position})` : ""}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!adding || pending} onClick={() => { const who = adding; setAdding(""); run(() => setDuty(day.day, who, true)); }}>Add</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

// Open the attendance sheet for today or a recent day.
export function OpenDay({ today }: { today: string }) {
  const router = useRouter();
  const [day, setDay] = useState(today);
  return (
    <section className="card">
      <div className="eyebrow">Attendance</div>
      <div className="filters">
        <label className="field">
          <span className="field-label">Day</span>
          <input className="input" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        </label>
        <button type="button" className="btn btn-sm" disabled={!day} onClick={() => router.push(`/exco/duty/${day}`)}>Open sheet</button>
      </div>
    </section>
  );
}
