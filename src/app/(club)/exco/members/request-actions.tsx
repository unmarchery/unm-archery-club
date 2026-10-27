"use client";

import { useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import { decideMemberRequest } from "../../actions";

export function RequestActions({ requestId, name }: { requestId: string; name: string }) {
  const shoot = useShot();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await decideMemberRequest(requestId, approve, approve ? "" : reason);
      if (!res.ok) setError(res.message);
      else if (approve) shoot("Approved", `${name} is now a member`);
    });
  }

  if (rejecting) {
    return (
      <div className="field">
        <label className="field">
          <span className="field-label">Reason (the student sees this, optional)</span>
          <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not on the member list. Please register first." autoFocus />
        </label>
        <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => decide(false)}>Reject request</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(false)}>Back</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="field">
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => decide(true)}>Approve</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(true)}>Reject</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
