"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "./actions";

export type Settings = {
  single_price: number; fullday_price: number; session_days: number[]; day_start: string; day_end: string;
  slot_minutes: number; capacity: number; nonmember_cap_pct: number; booking_open_dow: number; booking_open_time: string;
  nonmember_refund_hours: number; member_cancel_minutes: number; noshow_warn_after: number; noshow_ban_after: number;
  ban_days: number; membership_valid_until: string | null; club_bows: { RH: number[]; LH: number[] };
  starter_password_days?: number; duty_min_people?: number; attendance_days?: number; noshow_count_from?: string | null;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hm = (t: string) => t.slice(0, 5);

function Num({ name, label, value, unit, min = 0, max }: { name: string; label: string; value: number; unit?: string; min?: number; max?: number }) {
  return (
    <label className="field">
      <span className="field-label">{label}{unit ? ` (${unit})` : ""}</span>
      <input className="input" type="number" name={name} defaultValue={value} min={min} max={max} required />
    </label>
  );
}

export function SettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="field" style={{ gap: 16 }}>
      <section className="card">
        <div className="eyebrow">Prices (non-members)</div>
        <div className="filters">
          <Num name="single_price" label="Single pass" unit="RM" value={s.single_price} />
          <Num name="fullday_price" label="Full-day pass" unit="RM" value={s.fullday_price} />
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Sessions</div>
        <div className="field">
          <span className="field-label">Training days</span>
          <div className="chips">
            {DAYS.map((d, i) => (
              <label key={d} className="switch" style={{ padding: "8px 12px" }}>
                <input type="checkbox" name="session_days" value={i + 1} defaultChecked={s.session_days.includes(i + 1)} />
                <span className="strong" style={{ fontSize: 14 }}>{d}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="filters">
          <label className="field"><span className="field-label">First slot starts</span><input className="input" type="time" name="day_start" defaultValue={hm(s.day_start)} required /></label>
          <label className="field"><span className="field-label">Last slot ends</span><input className="input" type="time" name="day_end" defaultValue={hm(s.day_end)} required /></label>
          <Num name="slot_minutes" label="Slot length" unit="minutes" value={s.slot_minutes} min={15} max={240} />
        </div>
        <div className="filters">
          <Num name="capacity" label="Archers per slot" value={s.capacity} min={1} />
          <Num name="nonmember_cap_pct" label="Most a slot non-members can take" unit="%" value={s.nonmember_cap_pct} max={100} />
        </div>
        <div className="filters">
          <label className="field">
            <span className="field-label">Booking for next week opens on</span>
            <select className="input" name="booking_open_dow" defaultValue={s.booking_open_dow}>
              {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">At</span><input className="input" type="time" name="booking_open_time" defaultValue={hm(s.booking_open_time)} required /></label>
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Cancelling</div>
        <div className="filters">
          <Num name="nonmember_refund_hours" label="Non-members get the pass back if they cancel this early" unit="hours" value={s.nonmember_refund_hours} />
          <Num name="member_cancel_minutes" label="Members can cancel until this long before" unit="minutes" value={s.member_cancel_minutes} />
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">No-shows and attendance</div>
        <div className="filters">
          <Num name="noshow_warn_after" label="Warning at" unit="no-shows" value={s.noshow_warn_after} min={1} />
          <Num name="noshow_ban_after" label="Ban at" unit="no-shows" value={s.noshow_ban_after} min={2} />
          <Num name="ban_days" label="Ban length" unit="days" value={s.ban_days} min={1} />
        </div>
        <div className="filters">
          <label className="field">
            <span className="field-label">Count no-shows from (start of semester)</span>
            <input className="input" type="date" name="noshow_count_from" defaultValue={s.noshow_count_from ?? ""} />
          </label>
          <Num name="attendance_days" label="Attendance can be changed for" unit="days after" value={s.attendance_days ?? 3} max={14} />
          <Num name="duty_min_people" label="People needed on duty" value={s.duty_min_people ?? 2} min={1} max={10} />
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Membership and accounts</div>
        <div className="filters">
          <label className="field">
            <span className="field-label">Memberships valid until (empty = no end)</span>
            <input className="input" type="date" name="membership_valid_until" defaultValue={s.membership_valid_until ?? ""} />
          </label>
          <Num name="starter_password_days" label="Starter passwords work for" unit="days" value={s.starter_password_days ?? 14} min={1} />
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Club bows offered at booking</div>
        <div className="filters">
          <label className="field"><span className="field-label">Right-handed draw weights (lbs)</span><input className="input" name="bows_rh" defaultValue={s.club_bows.RH.join(", ")} /></label>
          <label className="field"><span className="field-label">Left-handed draw weights (lbs)</span><input className="input" name="bows_lh" defaultValue={s.club_bows.LH.join(", ")} /></label>
        </div>
      </section>

      {state.message && <p className={state.ok ? "ok" : "error"} role={state.ok ? "status" : "alert"}>{state.message}</p>}
      <button type="submit" className="btn" disabled={pending} style={{ maxWidth: 320 }}>
        {pending && <span className="spinner" aria-hidden="true" />}{pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
