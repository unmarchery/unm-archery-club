"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import { shortDay } from "@/lib/format";
import { gearTags, type Gear } from "@/lib/gear";
import { addWalkin, liftBan, markAttendance, removeWalkin } from "../actions";

export type SheetBooking = {
  id: string;
  user_id: string;
  full_name: string;
  student_id: string;
  is_member: boolean;
  pass_kind: "member" | "single" | "full";
  equipment: Partial<Gear>;
  status: "booked" | "present" | "no_show";
  walk_in: boolean;
  noshows: number;
  banned_until: string | null;
};

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

// One archer: Present / No-show buttons (tap the lit one again to clear it).
export function BookingRow({ booking, open, canFix }: { booking: SheetBooking; open: boolean; canFix: boolean }) {
  const { error, pending, run } = usePending();
  const [status, setShown] = useOptimistic(booking.status);

  function tick(next: SheetBooking["status"]) {
    const value = status === next ? "booked" : next;
    run(() => {
      setShown(value);
      return markAttendance(booking.id, value);
    });
  }

  const kind = booking.walk_in ? "Walk-in" : booking.pass_kind === "member" ? "Member" : booking.pass_kind === "full" ? "Full-day pass" : "Single pass";
  return (
    <div className="attend-row">
      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
        <div className="strong" style={{ fontSize: 14 }}>{booking.full_name}</div>
        <div className="tags" style={{ gap: 6, marginTop: 4 }}>
          <span className="tag">{kind}</span>
          {gearTags(booking.equipment).slice(0, 2).map((t) => (
            <span key={t.label} className="tag">{t.label}</span>
          ))}
          {booking.noshows > 0 && <span className="tag"><span className="dot" style={{ background: "var(--red)" }} />{booking.noshows} no-show{booking.noshows === 1 ? "" : "s"}</span>}
          {booking.banned_until && <span className="tag"><span className="dot" style={{ background: "var(--red)" }} />Paused until {shortDay(booking.banned_until)}</span>}
        </div>
      </div>
      {booking.walk_in ? (
        open && <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => removeWalkin(booking.id))}>Remove walk-in</button>
      ) : (
        <div className="seg" role="group" aria-label={`Attendance for ${booking.full_name}`} style={{ flex: "none" }}>
          <button type="button" className={status === "present" ? "on present" : ""} aria-pressed={status === "present"} disabled={!open || pending} onClick={() => tick("present")}>Present</button>
          <button type="button" className={status === "no_show" ? "on noshow" : ""} aria-pressed={status === "no_show"} disabled={!open || pending} onClick={() => tick("no_show")}>No-show</button>
        </div>
      )}
      {booking.banned_until && canFix && (
        <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => liftBan(booking.user_id))}>Lift ban</button>
      )}
      {error && <p className="error" role="alert" style={{ flexBasis: "100%", margin: 0 }}>{error}</p>}
    </div>
  );
}

export function NameWalkin({ walkin, open }: { walkin: { id: string; full_name: string }; open: boolean }) {
  const { error, pending, run } = usePending();
  return (
    <div className="attend-row">
      <div style={{ flex: "1 1 200px" }}>
        <div className="strong" style={{ fontSize: 14 }}>{walkin.full_name}</div>
        <div className="tags" style={{ marginTop: 4 }}><span className="tag">Walk-in, no account</span></div>
      </div>
      {open && <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => removeWalkin(walkin.id))}>Remove</button>}
      {error && <p className="error" role="alert" style={{ flexBasis: "100%", margin: 0 }}>{error}</p>}
    </div>
  );
}

// Someone turned up without booking: by student ID (a non-member uses a single pass), or just a name.
export function AddWalkin({ slotId }: { slotId: string }) {
  const shoot = useShot();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const { error, pending, run } = usePending();

  if (!open) return <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>+ Add a walk-in</button>;

  return (
    <div className="field" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <div className="filters">
        <label className="field">
          <span className="field-label">Student ID</span>
          <input className="input" inputMode="numeric" maxLength={8} value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))} placeholder="If they have an account" />
        </label>
        <label className="field">
          <span className="field-label">Or name only</span>
          <input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="No account" disabled={studentId.length > 0} />
        </label>
      </div>
      <span className="small muted">A non-member with an account uses one single pass. Name-only walk-ins are just counted.</span>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={pending || (studentId.length !== 8 && !name.trim())}
          onClick={() => run(() => addWalkin(slotId, studentId, studentId ? "" : name), () => {
            shoot("Walk-in added", studentId || name);
            setStudentId("");
            setName("");
            setOpen(false);
          })}
        >
          {pending && <span className="spinner" aria-hidden="true" />}Add walk-in
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
