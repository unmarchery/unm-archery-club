"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Dialog } from "@/components/dialog";
import { BOW_TYPES, type ClubBows, type Gear } from "@/lib/gear";
import { bookDay, bookSlot, cancelBooking, editBooking } from "./actions";
import type { Account, DayCard, MyBooking, SlotRow } from "./types";

// "Club bow · Right · 18 lbs" / "Own bow · Recurve · 30 lbs"
export function gearLine(g: Partial<Gear>) {
  if (g.own_bow) return ["Own bow", g.own_bow_type ?? "Recurve", g.own_bow_lbs ? `${g.own_bow_lbs} lbs` : null].filter(Boolean).join(" · ");
  return ["Club bow", g.hand === "LH" ? "Left" : "Right", !g.draw_lbs || g.draw_lbs === "Not sure" ? "any weight" : `${g.draw_lbs} lbs`].join(" · ");
}

const passName = (k: MyBooking["passKind"]) => (k === "member" ? "Member" : k === "single" ? "Hour pass" : "Day pass");

export type BookingTarget =
  | { mode: "slot"; day: DayCard; slot: SlotRow }
  | { mode: "day"; day: DayCard }
  | { mode: "edit"; booking: MyBooking };

// The booking pop-up (handoff 5.13): a page-level dialog with only the live site's options — Club bow or
// Own bow; for club bows the hand and a draw-weight preference; for your own bow its type and weight —
// and the no-show warning. Book, Book the whole day, or Edit an existing booking (Save / Cancel this slot).
export function BookingDialog({ target, account, onClose, onDone, onCancel }: {
  target: BookingTarget; account: Account; onClose: () => void; onDone: () => void; onCancel: (b: MyBooking) => void;
}) {
  const edit = target.mode === "edit" ? target.booking : null;
  const start: Gear = edit ? { ...account.gear, ...edit.gear } as Gear : account.gear;
  const [gear, setGear] = useState<Gear>(start);
  const fullDayOk = target.mode === "slot" && !account.member && target.day.canDay && account.fulls > 0;
  const [pass, setPass] = useState<"single" | "full">(target.mode === "slot" && !account.member && account.singles < 1 && fullDayOk ? "full" : "single");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const weights = (gear.hand === "LH" ? account.clubBows.LH : account.clubBows.RH).map(String);
  const setHand = (hand: "RH" | "LH") => {
    const list = (hand === "LH" ? account.clubBows.LH : account.clubBows.RH).map(String);
    setGear((g) => ({ ...g, hand, draw_lbs: list.includes(g.draw_lbs) ? g.draw_lbs : "Not sure" }));
  };

  // Title, price chip and whether the archer has what this booking needs.
  let title: string, price: string, priceCls = "", canGo = true;
  if (target.mode === "edit") {
    title = `Edit · ${edit!.day} · ${edit!.time}`;
    price = `Booked · ${passName(edit!.passKind)}`;
  } else if (target.mode === "day") {
    title = `${target.day.short} · whole day, ${target.day.range}`;
    if (account.member) price = "Free for members, all three hours";
    else { canGo = account.fulls > 0; price = canGo ? `Uses 1 Day pass · you have ${account.fulls}` : "No day passes left"; priceCls = canGo ? "is-guest" : "is-empty"; }
  } else {
    title = `${target.day.short} · ${pass === "full" ? `whole day, ${target.day.range}` : target.slot.time}`;
    if (account.member) price = "Free for members";
    else if (pass === "full") { price = `Uses 1 Day pass · you have ${account.fulls}`; priceCls = "is-guest"; }
    else { canGo = account.singles > 0; price = canGo ? `Uses 1 Hour pass · you have ${account.singles}` : "No hour passes left"; priceCls = canGo ? "is-guest" : "is-empty"; }
  }

  function go() {
    setError(null);
    startTransition(async () => {
      const res = target.mode === "edit"
        ? await editBooking({ bookingId: edit!.id, gear })
        : target.mode === "day"
          ? account.member ? await bookDay({ slotIds: target.day.dayIds, gear }) : await bookSlot({ slotId: target.day.dayIds[0], pass: "full", gear })
          : await bookSlot({ slotId: target.slot.id, pass: account.member ? null : pass, gear });
      if (!res.ok) { setError(res.message); return; }
      setDone(true);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => { onClose(); onDone(); }, reduce ? 0 : 750);
    });
  }

  const goLabel = done ? (edit ? "Saved" : "Booked") : pending ? (edit ? "Saving…" : "Booking…") : edit ? "Save changes" : target.mode === "day" ? "Book the whole day" : "Confirm booking";

  return (
    <Dialog onClose={onClose} labelledBy="bk-title" className="bk">
      <h2 className="bk__title" id="bk-title">{title}</h2>
      <span className={`bk__price ${priceCls}`.trim()}>{price}</span>
      {edit?.group && <p className="bk__note">A day pass shares one set-up: this changes every hour of that day.</p>}

      {fullDayOk && (
        <>
          <span className="bk__label">PASS</span>
          <div className="seg" role="group" aria-label="Pass">
            <button type="button" className={pass === "single" ? "on" : ""} aria-pressed={pass === "single"} disabled={account.singles < 1} onClick={() => setPass("single")}>Hour pass · {account.singles} left</button>
            <button type="button" className={pass === "full" ? "on" : ""} aria-pressed={pass === "full"} onClick={() => setPass("full")}>Day pass · all 3 hours</button>
          </div>
        </>
      )}

      <span className="bk__label">EQUIPMENT</span>
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
          <span className="bk__label">DRAW WEIGHT</span>
          <div className="bk-chips" role="group" aria-label="Draw weight">
            {[...weights, "Not sure"].map((w) => (
              <button key={w} type="button" aria-pressed={gear.draw_lbs === w} onClick={() => setGear((g) => ({ ...g, draw_lbs: w }))}>{w === "Not sure" ? "Not sure" : `${w} lbs`}</button>
            ))}
          </div>
          <p className="bk__note">This is a preference. Club bows are shared, so it isn&apos;t guaranteed.</p>
        </>
      ) : (
        <>
          <span className="bk__label">YOUR BOW</span>
          <div className="bk-chips" role="group" aria-label="Bow type">
            {BOW_TYPES.map((b) => <button key={b} type="button" aria-pressed={gear.own_bow_type === b} onClick={() => setGear((g) => ({ ...g, own_bow_type: b }))}>{b}</button>)}
          </div>
          <label className="field">
            <span className="field-label">Draw weight (lbs, optional)</span>
            <input className="input" type="number" inputMode="numeric" min={5} max={80} placeholder="e.g. 30" value={gear.own_bow_lbs ?? ""}
              onChange={(e) => setGear((g) => ({ ...g, own_bow_lbs: e.target.value ? Number(e.target.value) : null }))} />
          </label>
        </>
      )}

      {!edit && (
        <p className="bk__warn">If you book and don&apos;t come, it counts as a no-show. {account.noshow.warn} no-shows bring a warning; {account.noshow.ban} mean no bookings for {account.noshow.days} days. Cancel from My bookings if you can&apos;t make it.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="bk__foot">
        <span className="bk__summary">{gearLine(gear)}</span>
        <span className="bk__acts">
          {edit && <a className="link-btn" href={edit.calendar} target="_blank" rel="noreferrer">Add to calendar</a>}
          {edit && <button type="button" className="btn btn--danger btn--sm" disabled={pending || done} onClick={() => { onClose(); onCancel(edit); }}><span className="btn__label">Cancel this slot</span></button>}
          {!canGo && !edit ? (
            <Link className="btn btn--primary bk__go" href="/shop"><span className="btn__label">Get passes</span></Link>
          ) : (
            <button type="button" className={`btn btn--primary bk__go${done ? " is-done" : ""}`} disabled={pending || done || !canGo} onClick={go}>
              {pending && <span className="spinner" aria-hidden="true" />}<span className="btn__label">{done ? `✓ ${goLabel}` : goLabel}</span>
            </button>
          )}
        </span>
      </div>
    </Dialog>
  );
}

export type CancelTarget = { title: string; note: string; run: (wholeDay: boolean) => Promise<{ ok: boolean; message?: string }>; dayPass?: boolean };

// Cancel always asks first. A day-pass hour offers "this hour only" or "the whole day".
export function ConfirmCancel({ target, onClose }: { target: CancelTarget; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (whole: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await target.run(whole);
      if (!res.ok) { setError(res.message ?? "Something went wrong. Please try again."); return; }
      onClose();
    });
  };
  return (
    <Dialog onClose={onClose} labelledBy="cf-title" className="confirm">
      <h2 className="dlg-title" id="cf-title">{target.title}</h2>
      <p className="confirm__text">{target.note}</p>
      <p className="bk__note">Your place goes back to the pool for someone else.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="dlg-actions">
        <button type="button" className="btn btn--glass btn--sm" disabled={pending} onClick={onClose} autoFocus><span className="btn__label">Keep it</span></button>
        {target.dayPass && <button type="button" className="btn btn--danger btn--sm" disabled={pending} onClick={() => run(false)}><span className="btn__label">This hour only</span></button>}
        <button type="button" className="btn btn--primary btn--sm" disabled={pending} onClick={() => run(Boolean(target.dayPass))}>
          {pending && <span className="spinner" aria-hidden="true" />}<span className="btn__label">{target.dayPass ? "Cancel the whole day" : "Cancel booking"}</span>
        </button>
      </div>
    </Dialog>
  );
}

// A small Cancel button for lists (My bookings page). Same props as before; it now asks in a pop-up.
export function CancelButton({ bookingId, fullDay, note }: { bookingId: string; fullDay: boolean; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="cancel-inline">
      <button type="button" className="btn btn--danger btn--sm" onClick={() => setOpen(true)}><span className="btn__label">{fullDay ? "Cancel…" : "Cancel booking"}</span></button>
      {open && (
        <ConfirmCancel
          onClose={() => setOpen(false)}
          target={{ title: "Cancel this booking?", note, dayPass: fullDay, run: (whole) => cancelBooking(bookingId, whole) }}
        />
      )}
    </span>
  );
}

export type { ClubBows };
