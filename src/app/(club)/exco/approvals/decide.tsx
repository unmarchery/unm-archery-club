"use client";

import { useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import { compressImage } from "@/lib/compress-image";
import { decideTopup, savePaymentSettings } from "./actions";

export function TopupActions({ topupId, name }: { topupId: string; name: string }) {
  const shoot = useShot();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    setError(null);
    if (!approve && !reason.trim()) return setError("Write a reason, so the archer knows what to fix.");
    startTransition(async () => {
      const res = await decideTopup(topupId, approve, approve ? "" : reason);
      if (!res.ok) setError(res.message);
      else if (approve) shoot("Approved", `${name}'s passes are added`);
    });
  }

  if (rejecting) {
    return (
      <div className="field">
        <label className="field">
          <span className="field-label">Reason (the archer sees this)</span>
          <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount doesn't match, or no payment found" autoFocus />
        </label>
        <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => decide(false)}>
            {pending && <span className="spinner" aria-hidden="true" />}Reject top-up
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(false)}>Back</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="field">
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => decide(true)}>
          {pending && <span className="spinner" aria-hidden="true" />}Approve
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(true)}>Reject</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function PaymentSettingsForm({ qrUrl, whatsappLink }: { qrUrl: string | null; whatsappLink: string }) {
  const shoot = useShot();
  const [link, setLink] = useState(whatsappLink);
  const [qr, setQr] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return setQr(null);
    setPreparing(true);
    // A QR must stay sharp, so it's only shrunk if it's very large.
    setQr(await compressImage(file, 1200, 0.92));
    setPreparing(false);
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("whatsapp", link);
    if (qr) fd.set("qr", qr);
    startTransition(async () => {
      const res = await savePaymentSettings(fd);
      if (!res.ok) return setError(res.message);
      setQr(null);
      shoot("Saved", "Archers see the new payment details on the Top up page");
    });
  }

  return (
    <section className="card">
      <div className="eyebrow">Payment details</div>
      <p className="small muted" style={{ margin: 0 }}>Shown to non-members on the Top up page.</p>
      {qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qr" src={qrUrl} alt="Current club DuitNow QR code" />
      ) : (
        <p className="small" style={{ margin: 0 }}>No QR yet. Upload a screenshot of the club&apos;s DuitNow QR.</p>
      )}
      <div className="field">
        <span className="field-label">DuitNow QR picture</span>
        <label className="btn btn-ghost btn-sm file-btn">
          {preparing && <span className="spinner" aria-hidden="true" />}
          {qr ? "Change picture" : qrUrl ? "Replace QR" : "Choose picture"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {qr && <span className="small muted">{qr.name} · ready to save</span>}
      </div>
      <label className="field">
        <span className="field-label">Finance WhatsApp group link (for cash)</span>
        <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" inputMode="url" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={save} disabled={pending || preparing}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Saving…" : "Save payment details"}
      </button>
    </section>
  );
}
