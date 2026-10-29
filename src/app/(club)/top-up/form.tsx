"use client";

import { useState, useTransition } from "react";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import { compressImage } from "@/lib/compress-image";
import { cancelTopup, submitTopup } from "./actions";

type Props = {
  studentId: string;
  singlePrice: number;
  fullPrice: number;
  qrUrl: string | null;
  whatsappLink: string | null;
};

const MAX = 20;

function Stepper({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <div>
        <div className="strong">{label}</div>
        <div className="small muted">{hint}</div>
      </div>
      <div className="stepper-controls">
        <button type="button" className="icon-btn" aria-label={`One fewer ${label.toLowerCase()}`} disabled={value === 0} onClick={() => onChange(value - 1)}>
          <MinusIcon />
        </button>
        <output className="stepper-value" aria-label={`${label} count`}>{value}</output>
        <button type="button" className="icon-btn" aria-label={`One more ${label.toLowerCase()}`} disabled={value === MAX} onClick={() => onChange(value + 1)}>
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

export function TopupForm({ studentId, singlePrice, fullPrice, qrUrl, whatsappLink }: Props) {
  const shoot = useShot();
  const [single, setSingle] = useState(1);
  const [full, setFull] = useState(0);
  const [method, setMethod] = useState<"qr" | "cash">(qrUrl ? "qr" : "cash");
  const [bankRef, setBankRef] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = single * singlePrice + full * fullPrice;

  async function pickReceipt(file: File | undefined) {
    setError(null);
    if (!file) return setReceipt(null);
    setPreparing(true);
    setReceipt(await compressImage(file));
    setPreparing(false);
  }

  function send() {
    setError(null);
    if (method === "qr" && !bankRef.trim()) return setError("Enter the transaction reference number from your banking app.");
    if (method === "qr" && !receipt) return setError("Add a screenshot of your payment receipt.");
    const fd = new FormData();
    fd.set("single", String(single));
    fd.set("full", String(full));
    fd.set("method", method);
    if (method === "qr" && receipt) {
      fd.set("bank_ref", bankRef);
      fd.set("receipt", receipt);
    }
    startTransition(async () => {
      const res = await submitTopup(fd);
      if (!res.ok) return setError(res.message);
      shoot("Top-up sent", `#${res.number} · RM${res.amount}. Your passes appear once the treasurer checks it.`);
      setSingle(1);
      setFull(0);
      setBankRef("");
      setReceipt(null);
    });
  }

  return (
    <section className="card">
      <div className="eyebrow">Choose passes</div>
      <Stepper label="Single pass" hint={`RM${singlePrice} · any one slot`} value={single} onChange={setSingle} />
      <Stepper label="Full-day pass" hint={`RM${fullPrice} · all 3 slots of one day`} value={full} onChange={setFull} />
      <div className="row total-row">
        <span className="strong">Total</span>
        <span className="total">RM{total}</span>
      </div>

      <div className="eyebrow">Pay by</div>
      <div className="seg" role="group" aria-label="Payment method">
        <button type="button" className={method === "qr" ? "on" : ""} aria-pressed={method === "qr"} onClick={() => setMethod("qr")}>DuitNow QR</button>
        <button type="button" className={method === "cash" ? "on" : ""} aria-pressed={method === "cash"} onClick={() => setMethod("cash")}>Cash</button>
      </div>

      {method === "qr" ? (
        <>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="qr" src={qrUrl} alt="Club DuitNow QR code" />
          ) : (
            <p className="small muted" style={{ margin: 0 }}>The club QR isn&apos;t set up yet. Choose cash, or ask the treasurer how to pay.</p>
          )}
          <ol className="steps small">
            <li>Scan the QR in your banking app and pay exactly <strong>RM{total}</strong>.</li>
            <li>Type your student ID <strong>{studentId}</strong> in the reference or remark.</li>
            <li>Enter the transaction reference number and add a screenshot of the receipt below.</li>
          </ol>
          <label className="field">
            <span className="field-label">Transaction reference number</span>
            <input className="input" value={bankRef} maxLength={40} onChange={(e) => setBankRef(e.target.value)} placeholder="From the receipt in your banking app" autoComplete="off" />
          </label>
          <div className="field">
            <span className="field-label">Receipt screenshot</span>
            <label className="btn btn-ghost btn-sm file-btn">
              {preparing && <span className="spinner" aria-hidden="true" />}
              {receipt ? "Change picture" : "Choose picture"}
              <input type="file" accept="image/*,application/pdf" onChange={(e) => pickReceipt(e.target.files?.[0])} />
            </label>
            {receipt && <span className="small muted">{receipt.name} · {Math.max(1, Math.round(receipt.size / 1024))} KB</span>}
          </div>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: 0 }}>
            Give <strong>RM{total}</strong> to the treasurer, or arrange it in the finance WhatsApp group. Your passes are added once they have the cash.
          </p>
          {whatsappLink && (
            <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href={whatsappLink} target="_blank" rel="noreferrer">
              Open the finance WhatsApp group
            </a>
          )}
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn" onClick={send} disabled={pending || preparing || total === 0}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Sending…" : `Send top-up · RM${total}`}
      </button>
    </section>
  );
}

export function CancelTopup({ topupId }: { topupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const res = await cancelTopup(topupId);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <div className="field" style={{ gap: 6 }}>
      {confirming ? (
        <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <span className="small">Cancel this top-up?</span>
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={cancel}>
            {pending && <span className="spinner" aria-hidden="true" />}Yes, cancel
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirming(false)}>Keep it</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setConfirming(true)}>Cancel request</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
