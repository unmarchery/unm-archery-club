"use client";

import { useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import { saveMyCard } from "./actions";

// On your own card: your WhatsApp number, and whether members see a button for it.
export function MyCard({ whatsapp, show }: { whatsapp: string; show: boolean }) {
  const shoot = useShot();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(whatsapp ? `+${whatsapp}` : "");
  const [visible, setVisible] = useState(show);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveMyCard(phone, visible);
      if (!res.ok) return setError(res.message);
      setOpen(false);
      shoot("Saved", visible ? "Members can now WhatsApp you from this page" : "Your number is hidden from members");
    });
  }

  if (!open) {
    return (
      <div className="field" style={{ gap: 6, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <span className="small muted">{show ? "Members can WhatsApp you from here." : "Your WhatsApp button is off."}</span>
        <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>Edit my card</button>
      </div>
    );
  }

  return (
    <div className="field" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <label className="field">
        <span className="field-label">Your WhatsApp number</span>
        <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="012-345 6789" autoFocus />
      </label>
      <label className="check">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        <span>Show a WhatsApp button to members. Anyone with an account can then see your number.</span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm" onClick={save} disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}Save
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
      </div>
    </div>
  );
}
