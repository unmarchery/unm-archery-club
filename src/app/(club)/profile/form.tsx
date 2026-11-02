"use client";

import { useActionState, useState } from "react";
import { BOW_TYPES, type ClubBows, type Gear } from "@/lib/gear";
import { saveProfile, type ProfileState } from "./actions";

export function ProfileForm({ phone, gear, clubBows }: { phone: string; gear: Gear; clubBows: ClubBows }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const [hand, setHand] = useState(gear.hand);
  const [ownBow, setOwnBow] = useState(gear.own_bow);
  const weights = hand === "LH" ? clubBows.LH : clubBows.RH;

  return (
    <form action={action} className="card">
      <div className="eyebrow">Details and equipment</div>
      <label className="field">
        <span className="field-label">Phone</span>
        <input className="input" type="tel" name="phone" defaultValue={phone} placeholder="012-345 6789" />
      </label>
      <div className="field">
        <span className="field-label">Hand</span>
        <div className="seg" role="group" aria-label="Hand">
          <button type="button" className={hand === "RH" ? "on" : ""} aria-pressed={hand === "RH"} onClick={() => setHand("RH")}>Right-handed</button>
          <button type="button" className={hand === "LH" ? "on" : ""} aria-pressed={hand === "LH"} onClick={() => setHand("LH")}>Left-handed</button>
        </div>
        <input type="hidden" name="hand" value={hand} />
      </div>
      <label className="check">
        <input type="checkbox" name="own_bow" checked={ownBow} onChange={(e) => setOwnBow(e.target.checked)} />
        <span>I bring my own bow</span>
      </label>
      {ownBow ? (
        <div className="filters">
          <label className="field">
            <span className="field-label">Bow type</span>
            <select className="input" name="own_bow_type" defaultValue={gear.own_bow_type ?? "Recurve"}>
              {BOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Draw weight (lbs, optional)</span>
            <input className="input" type="number" name="own_bow_lbs" min={5} max={80} defaultValue={gear.own_bow_lbs ?? ""} />
          </label>
        </div>
      ) : (
        <label className="field">
          <span className="field-label">Club bow draw weight</span>
          <select className="input" name="draw_lbs" key={hand} defaultValue={weights.map(String).includes(gear.draw_lbs) ? gear.draw_lbs : "Not sure"}>
            <option value="Not sure">Not sure</option>
            {weights.map((w) => <option key={w} value={w}>{w} lbs</option>)}
          </select>
        </label>
      )}
      {state.message && <p className={state.ok ? "ok" : "error"} role={state.ok ? "status" : "alert"}>{state.message}</p>}
      <button type="submit" className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}Save
      </button>
    </form>
  );
}
