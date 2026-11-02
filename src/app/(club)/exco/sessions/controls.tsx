"use client";

import { useState, useTransition } from "react";
import { CloseIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import { cancelSessions, closeDate, reopenDate } from "./actions";

function usePending() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (job: () => Promise<{ ok: boolean; message?: string }>, done?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (!res.ok) setError(res.message ?? "Something went wrong.");
      else done?.();
    });
  };
  return { error, pending, run };
}

export function CancelSlot({ slotId, label, hasLater }: { slotId: string; label: string; hasLater: boolean }) {
  const shoot = useShot();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Rain");
  const [rest, setRest] = useState(false);
  const { error, pending, run } = usePending();

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Cancel…</button>
      {open && (
        <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`cancel-${slotId}`}>
            <div className="row">
              <h2 className="h2" id={`cancel-${slotId}`}>Cancel {label}?</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)} autoFocus><CloseIcon /></button>
            </div>
            <label className="field">
              <span className="field-label">Reason (everyone booked sees this)</span>
              <input className="input" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="chips">
              {["Rain", "Lightning", "Range not available"].map((r) => (
                <button key={r} type="button" className={`chip${reason === r ? " on" : ""}`} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
            {hasLater && (
              <label className="check">
                <input type="checkbox" checked={rest} onChange={(e) => setRest(e.target.checked)} />
                <span>Also cancel the rest of the day</span>
              </label>
            )}
            <p className="small muted" style={{ margin: 0 }}>Bookings not yet marked present are cancelled, passes come back, and everyone gets an email.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn btn-danger" disabled={pending || !reason.trim()} onClick={() => run(() => cancelSessions(slotId, rest, reason), () => { setOpen(false); shoot("Cancelled", "Everyone booked will get an email"); })}>
              {pending && <span className="spinner" aria-hidden="true" />}{rest ? "Cancel the rest of the day" : "Cancel this slot"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function CloseDate({ today }: { today: string }) {
  const shoot = useShot();
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const { error, pending, run } = usePending();
  return (
    <div className="field" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <div className="filters">
        <label className="field">
          <span className="field-label">Date</span>
          <input className="input" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="field" style={{ flex: "2 1 220px" }}>
          <span className="field-label">Reason</span>
          <input className="input" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Exam week, Deepavali" />
        </label>
        <button type="button" className="btn btn-sm" disabled={pending || !day || !reason.trim()} onClick={() => run(() => closeDate(day, reason), () => { shoot("Date closed", "Anyone booked will get an email"); setDay(""); setReason(""); })}>
          {pending && <span className="spinner" aria-hidden="true" />}Close date
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function ReopenDate({ day }: { day: string }) {
  const { error, pending, run } = usePending();
  return (
    <span>
      <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => reopenDate(day))}>Reopen</button>
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}
