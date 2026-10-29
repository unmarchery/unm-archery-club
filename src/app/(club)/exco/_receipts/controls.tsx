"use client";

import { useState, useTransition } from "react";
import { CloseIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import { shortDay } from "@/lib/format";
import { decideReceiptDeletion, requestReceiptDeletion } from "./actions";

export type DeletionRequest = {
  id: string;
  number: number;
  amount: number;
  full_name: string;
  reason: string;
  requested_by: string;
  created_at: string;
  expires_at: string;
  mine: boolean;
  can_agree: boolean;
};

// "Delete…" next to a receipt: asks for a reason, then waits for a second officer.
export function AskToDelete({ topupId, number, position }: { topupId: string; number: number; position: string }) {
  const shoot = useShot();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const needs = position === "Treasurer" ? "the President or VP" : "the Treasurer";

  function send() {
    setError(null);
    if (!reason.trim()) return setError("Write a reason for the other officer.");
    startTransition(async () => {
      const res = await requestReceiptDeletion(topupId, reason);
      if (!res.ok) return setError(res.message);
      shoot("Request sent", `The receipt is deleted once ${needs} agrees`);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>Delete…</button>
      {open && (
        <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`del-${topupId}`}>
            <div className="row">
              <h2 className="h2" id={`del-${topupId}`}>Delete the receipt for #{number}?</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)} autoFocus>
                <CloseIcon />
              </button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Only the picture is deleted. The top-up stays in Finance with its amount, bank reference and who approved it.
              It&apos;s deleted once {needs} agrees, within 14 days.
            </p>
            <label className="field">
              <span className="field-label">Reason</span>
              <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The archer asked us to remove it" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn" onClick={send} disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {pending ? "Sending…" : "Ask to delete"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Decide({ request }: { request: DeletionRequest }) {
  const shoot = useShot();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(agree: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await decideReceiptDeletion(request.id, agree);
      if (!res.ok) return setError(res.message);
      if (agree) shoot("Receipt deleted", `The receipt for #${request.number} is gone`);
    });
  }

  return (
    <div className="field" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {request.can_agree && (
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => decide(true)}>
            {pending && <span className="spinner" aria-hidden="true" />}Agree and delete
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => decide(false)}>Decline</button>
      </div>
      {!request.can_agree && <span className="small muted">The Treasurer needs to agree to this one.</span>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function DeletionRequests({ requests, position }: { requests: DeletionRequest[]; position: string }) {
  if (requests.length === 0) return null;
  const needs = position === "Treasurer" ? "the President or VP" : "the Treasurer";
  return (
    <section className="card">
      <div className="row">
        <div className="eyebrow">Receipt delete requests</div>
        <span className="tag"><span className="dot" style={{ background: "var(--amber)" }} />{requests.length} open</span>
      </div>
      {requests.map((r) => (
        <div key={r.id} className="field" style={{ gap: 6, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <span className="strong">#{r.number} {r.full_name} · RM{r.amount}</span>
          <span className="small">Asked by {r.requested_by}: &ldquo;{r.reason}&rdquo;</span>
          <span className="small muted">Lapses {shortDay(r.expires_at)} if nobody agrees.</span>
          {r.mine ? <span className="small muted">Waiting for {needs} to agree.</span> : <Decide request={r} />}
        </div>
      ))}
    </section>
  );
}
