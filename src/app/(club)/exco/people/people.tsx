"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import { clockLabel, shortDay } from "@/lib/format";
import { OFFICER_POSITIONS, POSITIONS, SWITCHES } from "@/lib/people";
import { addNote, deleteNote, removeFromExco, setPermission, setPosition } from "../actions";

export type Person = {
  id: string;
  full_name: string;
  student_id: string;
  email: string;
  position: string | null;
  handles: string | null;
  me: boolean;
  last_sign_in_at: string | null;
  perms: { permission: string; expires_at: string | null }[];
  notes: { id: string; body: string; created_at: string; by: string; mine: boolean }[];
};

export type Powers = { can_access: boolean; can_positions: boolean; can_notes: boolean; is_owner: boolean; my_perms: string[] };

function usePending() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (job: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (!res.ok) setError(res.message ?? "Something went wrong.");
      else after?.();
    });
  };
  return { error, pending, run };
}

function PositionEditor({ person, powers }: { person: Person; powers: Powers }) {
  const shoot = useShot();
  const [position, setPos] = useState(person.position ?? "");
  const [handles, setHandles] = useState(person.handles ?? "");
  const { error, pending, run } = usePending();
  const officerLocked = !powers.is_owner && OFFICER_POSITIONS.includes(person.position ?? "");

  return (
    <div className="field">
      <div className="filters">
        <label className="field">
          <span className="field-label">Position</span>
          <select className="input" value={position} onChange={(e) => setPos(e.target.value)} disabled={officerLocked}>
            <option value="">No position</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p} disabled={!powers.is_owner && OFFICER_POSITIONS.includes(p) && p !== person.position}>{p}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: "2 1 220px" }}>
          <span className="field-label">What they handle</span>
          <input className="input" value={handles} maxLength={120} onChange={(e) => setHandles(e.target.value)} placeholder="e.g. Payments and top-ups" />
        </label>
      </div>
      {officerLocked && <span className="small muted">Only the President changes this position.</span>}
      {error && <p className="error" role="alert">{error}</p>}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start" }}
        disabled={pending || (position === (person.position ?? "") && handles === (person.handles ?? ""))}
        onClick={() => run(() => setPosition(person.student_id, position, handles), () => shoot("Saved", `${person.full_name.split(/\s+/)[0]}'s card is updated`))}
      >
        {pending && <span className="spinner" aria-hidden="true" />}Save position
      </button>
    </div>
  );
}

function Switches({ person, powers }: { person: Person; powers: Powers }) {
  const [until, setUntil] = useState("");
  const { error, pending, run } = usePending();
  const owner = person.perms.some((p) => p.permission === "owner");
  const on = (key: string) => person.perms.find((p) => p.permission === key);
  // Flip the switch straight away; it snaps back if the server refuses.
  const [shown, flip] = useOptimistic(
    person.perms.map((p) => p.permission),
    (keys: string[], change: { key: string; on: boolean }) => (change.on ? [...keys, change.key] : keys.filter((k) => k !== change.key)),
  );

  if (owner) return <p className="small" style={{ margin: 0 }}><span className="pill gold">President access</span> Has every access.</p>;

  return (
    <div className="field">
      <div className="switches">
        {SWITCHES.map((s) => {
          const current = on(s.key);
          const allowed = powers.can_access && (powers.is_owner || powers.my_perms.includes(s.key));
          return (
            <label key={s.key} className={`switch${allowed ? "" : " off"}`}>
              <input
                type="checkbox"
                checked={shown.includes(s.key)}
                disabled={!allowed || pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  run(() => {
                    flip({ key: s.key, on: next });
                    return setPermission(person.id, s.key, next, until);
                  });
                }}
              />
              <span>
                <span className="strong" style={{ fontSize: 14 }}>{s.label}</span>
                <span className="small muted" style={{ display: "block" }}>
                  {current?.expires_at ? `Until ${shortDay(new Date(Date.parse(current.expires_at) - 1).toISOString())} · ` : ""}{s.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {powers.can_access && (
        <label className="field" style={{ maxWidth: 260 }}>
          <span className="field-label">End date for access you switch on (optional)</span>
          <input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function Notes({ person, powers }: { person: Person; powers: Powers }) {
  const [body, setBody] = useState("");
  const { error, pending, run } = usePending();
  if (!powers.can_notes && person.notes.length === 0) return null;

  return (
    <div className="field">
      <span className="field-label">Notes</span>
      {person.notes.map((n) => (
        <div key={n.id} className="note">
          <p className="small" style={{ margin: 0, whiteSpace: "pre-line" }}>{n.body}</p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <span className="small muted">{n.by}, {shortDay(n.created_at)} {clockLabel(n.created_at)}</span>
            {(n.mine || powers.is_owner) && (
              <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => deleteNote(n.id))}>Delete</button>
            )}
          </div>
        </div>
      ))}
      {powers.can_notes && (
        <>
          <textarea className="input" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Looks after the booking questions in the WhatsApp group" style={{ minHeight: 70 }} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={pending || !body.trim()} onClick={() => run(() => addNote(person.id, body), () => setBody(""))}>
            {pending && <span className="spinner" aria-hidden="true" />}Add note
          </button>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function Remove({ person }: { person: Person }) {
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = usePending();
  return (
    <div className="field" style={{ gap: 6 }}>
      {confirming ? (
        <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <span className="small">Remove {person.full_name.split(/\s+/)[0]} from the exco? Their position and all access go.</span>
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => run(() => removeFromExco(person.id))}>
            {pending && <span className="spinner" aria-hidden="true" />}Remove
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirming(false)}>Keep</button>
        </div>
      ) : (
        <button type="button" className="link-btn" style={{ alignSelf: "flex-start", color: "var(--red)" }} onClick={() => setConfirming(true)}>Remove from exco</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

// One row per exco; tap to open their position, access switches and notes.
export function PersonCard({ person, powers }: { person: Person; powers: Powers }) {
  const owner = person.perms.some((p) => p.permission === "owner");
  const count = person.perms.length;
  return (
    <details className="card person">
      <summary>
        <span className="person-main">
          <span className="strong">{person.full_name}{person.me ? " (you)" : ""}</span>
          <span className="small" style={{ color: "var(--gold-text)", fontWeight: 600 }}>{person.position ?? "No position"}</span>
        </span>
        <span className="tags" style={{ justifyContent: "flex-end" }}>
          <span className="tag">{owner ? "President access" : `${count} access on`}</span>
          <span className="tag">
            <span className="dot" style={{ background: person.last_sign_in_at ? "var(--gold)" : "var(--muted)" }} />
            {person.last_sign_in_at ? `Last in ${shortDay(person.last_sign_in_at)}` : "Not logged in yet"}
          </span>
        </span>
      </summary>
      <div className="person-body">
        <div className="small muted">{person.student_id} · {person.email}</div>
        {powers.can_positions ? (
          <PositionEditor person={person} powers={powers} />
        ) : (
          person.handles && <div className="small muted">{person.handles}</div>
        )}
        <span className="field-label">Access</span>
        <Switches person={person} powers={powers} />
        <Notes person={person} powers={powers} />
        {powers.can_access && !owner && <Remove person={person} />}
      </div>
    </details>
  );
}

export function AddPerson({ powers }: { powers: Powers }) {
  const shoot = useShot();
  const [studentId, setStudentId] = useState("");
  const [position, setPos] = useState("");
  const [handles, setHandles] = useState("");
  const { error, pending, run } = usePending();

  return (
    <section className="card">
      <div className="eyebrow">Add someone to the exco</div>
      <p className="small muted" style={{ margin: 0 }}>They need an account first. Give them a position here, then switch on their access on their card.</p>
      <div className="filters">
        <label className="field">
          <span className="field-label">Student ID</span>
          <input className="input" inputMode="numeric" maxLength={8} value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))} placeholder="20xxxxxx" />
        </label>
        <label className="field">
          <span className="field-label">Position</span>
          <select className="input" value={position} onChange={(e) => setPos(e.target.value)}>
            <option value="">Choose…</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p} disabled={!powers.is_owner && OFFICER_POSITIONS.includes(p)}>{p}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: "2 1 220px" }}>
          <span className="field-label">What they handle (optional)</span>
          <input className="input" value={handles} maxLength={120} onChange={(e) => setHandles(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button
        type="button"
        className="btn btn-sm"
        style={{ alignSelf: "flex-start" }}
        disabled={pending || studentId.length !== 8 || !position}
        onClick={() => run(() => setPosition(studentId, position, handles), () => {
          shoot("Added", `${studentId} is now on the exco`);
          setStudentId("");
          setPos("");
          setHandles("");
        })}
      >
        {pending && <span className="spinner" aria-hidden="true" />}Add to exco
      </button>
    </section>
  );
}
