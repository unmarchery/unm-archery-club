"use client";

import { useState, useTransition } from "react";
import { ArrowIcon, CloseIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import { BOW_TYPES, type ClubBows, type Gear } from "@/lib/gear";
import { bookDay, bookSlot, cancelBooking } from "./actions";

type BookProps = {
  slotId: string;
  title: string; // "Thursday, 22 October, 4–5pm"
  fullDayTitle: string; // "Thursday, 22 October, 4–7pm"
  member: boolean;
  singles: number;
  fulls: number;
  fullDay: { ok: boolean; note: string };
  gear: Gear;
  clubBows: ClubBows;
  noshow?: { warn: number; ban: number; days: number };
  // Whole-day mode: pick the bow first, then confirm. Members book every hour; guests use a day pass.
  day?: { slotIds: string[] };
};

// "Book the whole day": the bow step, then the confirmation.
export function WholeDayButton(props: BookProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Book the whole day</button>
      {open && <BookingDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

export function BookButton(props: BookProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>Book</button>
      {open && <BookingDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function BookingDialog({ slotId, title, fullDayTitle, member, singles, fulls, fullDay, gear: initialGear, clubBows, noshow, day, onClose }: BookProps & { onClose: () => void }) {
  const shoot = useShot();
  const [pass, setPass] = useState<"single" | "full">(singles > 0 || !fullDay.ok ? "single" : "full");
  const [gear, setGear] = useState<Gear>(initialGear);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"bow" | "confirm">(day ? "bow" : "confirm");

  const weights = (gear.hand === "LH" ? clubBows.LH : clubBows.RH).map(String);
  const canConfirm = day ? member || fulls > 0 : member || (pass === "single" ? singles > 0 : fullDay.ok);
  const heading = day || (!member && pass === "full") ? fullDayTitle : title;
  const bowLabel = gear.own_bow ? `Own bow · ${gear.own_bow_type ?? "Recurve"}` : `Club bow · ${gear.hand === "LH" ? "left-handed" : "right-handed"}${gear.draw_lbs !== "Not sure" ? ` · ${gear.draw_lbs} lbs` : ""}`;

  function setHand(hand: "RH" | "LH") {
    const list = (hand === "LH" ? clubBows.LH : clubBows.RH).map(String);
    setGear((g) => ({ ...g, hand, draw_lbs: list.includes(g.draw_lbs) ? g.draw_lbs : "Not sure" }));
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = day
        ? member ? await bookDay({ slotIds: day.slotIds, gear }) : await bookSlot({ slotId, pass: "full", gear })
        : await bookSlot({ slotId, pass: member ? null : pass, gear });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      shoot("Booked!", day || (!member && pass === "full") ? `${fullDayTitle}, full day` : title);
      onClose();
    });
  }

  return (
    <div
      className="modal-wrap"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="book-title">
        <div className="row">
          <div>
            <div className="eyebrow">{day && step === "bow" ? "Choose your bow" : "Confirm your booking"}</div>
            <h2 className="h2" id="book-title">{heading}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus>
            <CloseIcon />
          </button>
        </div>

        {day ? (
          <span className="pill gold" style={{ alignSelf: "flex-start" }}>{member ? "Free for members, all three hours" : `Uses 1 day pass (you have ${fulls})`}</span>
        ) : member ? (
          <span className="pill gold" style={{ alignSelf: "flex-start" }}>Free for members</span>
        ) : (
          <>
            <div className="eyebrow">Pass</div>
            <button type="button" className={`opt${pass === "single" ? " on" : ""}`} onClick={() => setPass("single")} disabled={singles < 1} aria-pressed={pass === "single"}>
              <span className="strong">Single pass, this slot</span>
              <span className="muted small">{singles > 0 ? `Uses 1 of your ${singles}` : "No single passes left"}</span>
            </button>
            <button type="button" className={`opt${pass === "full" ? " on" : ""}`} onClick={() => setPass("full")} disabled={!fullDay.ok} aria-pressed={pass === "full"}>
              <span className="strong">Full day, all three slots</span>
              <span className="muted small">{fullDay.note}</span>
            </button>
          </>
        )}

        {day && step === "confirm" ? (
          <div className="row"><span className="strong">{bowLabel}</span><button type="button" className="link-btn" onClick={() => setStep("bow")}>Change bow</button></div>
        ) : (<>
        <div className="eyebrow">Equipment</div>
        <div className="seg" role="group" aria-label="Bow">
          <button type="button" className={gear.own_bow ? "" : "on"} aria-pressed={!gear.own_bow} onClick={() => setGear((g) => ({ ...g, own_bow: false }))}>Club bow</button>
          <button type="button" className={gear.own_bow ? "on" : ""} aria-pressed={gear.own_bow} onClick={() => setGear((g) => ({ ...g, own_bow: true, own_bow_type: g.own_bow_type ?? "Recurve" }))}>Own bow</button>
        </div>

        {!gear.own_bow ? (
          <>
            <div className="seg" role="group" aria-label="Hand">
              <button type="button" className={gear.hand === "RH" ? "on" : ""} aria-pressed={gear.hand === "RH"} onClick={() => setHand("RH")}>Right-handed</button>
              <button type="button" className={gear.hand === "LH" ? "on" : ""} aria-pressed={gear.hand === "LH"} onClick={() => setHand("LH")}>Left-handed</button>
            </div>
            <div className="muted small">Draw weight</div>
            <div className="chips">
              {[...weights, "Not sure"].map((w) => (
                <button key={w} type="button" className={`chip${gear.draw_lbs === w ? " on" : ""}`} aria-pressed={gear.draw_lbs === w} onClick={() => setGear((g) => ({ ...g, draw_lbs: w }))}>
                  {w === "Not sure" ? "Not sure" : `${w} lbs`}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="chips">
              {BOW_TYPES.map((b) => (
                <button key={b} type="button" className={`chip${gear.own_bow_type === b ? " on" : ""}`} aria-pressed={gear.own_bow_type === b} onClick={() => setGear((g) => ({ ...g, own_bow_type: b }))}>
                  {b}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field-label">Draw weight (lbs)</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={5}
                max={80}
                placeholder="e.g. 30"
                value={gear.own_bow_lbs ?? ""}
                onChange={(e) => setGear((g) => ({ ...g, own_bow_lbs: e.target.value ? Number(e.target.value) : null }))}
              />
            </label>
          </>
        )}

        <div className="muted small">This is a preference. Club bows are shared, so it isn&apos;t guaranteed.</div>
        </>)}
        {noshow && (!day || step === "confirm") && (
          <p className="noshow-line">If you book and don&apos;t come, it counts as a no-show. {noshow.warn} no-shows bring a warning; {noshow.ban} mean no bookings for {noshow.days} days. Cancel from My bookings if you can&apos;t make it.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {day && step === "bow" ? (
          <button type="button" className="btn" onClick={() => setStep("confirm")}>Continue</button>
        ) : (
        <button type="button" className="btn" onClick={confirm} disabled={!canConfirm || pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : <ArrowIcon />}
          {pending ? "Booking…" : "Confirm booking"}
        </button>
        )}
      </div>
    </div>
  );
}

type CancelProps = {
  bookingId: string;
  fullDay: boolean;
  note: string; // what happens to the pass
};

export function CancelButton({ bookingId, fullDay, note }: CancelProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(wholeDay: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await cancelBooking(bookingId, wholeDay);
      if (!res.ok) setError(res.message);
    });
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>
        {fullDay ? "Cancel…" : "Cancel booking"}
      </button>
    );
  }
  return (
    <div className="card" style={{ padding: 14, gap: 10, background: "var(--surface2)" }}>
      <p className="small" style={{ margin: 0 }}>{note}</p>
      {fullDay ? (
        <>
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(true)}>Cancel the whole day</button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(false)}>Cancel this slot only</button>
        </>
      ) : (
        <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(false)}>Yes, cancel</button>
      )}
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirming(false)}>Keep my booking</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
