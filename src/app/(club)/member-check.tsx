"use client";

import { useState, useTransition } from "react";
import { CloseIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import type { Status } from "@/lib/session";
import { requestMemberCheck } from "./actions";

type Props = { membership: Status["membership"]; request: Status["request"] };

// Home card for archers who show as non-members: ask the exco to confirm their membership.
export function MemberCheck({ membership, request }: Props) {
  const [open, setOpen] = useState(false);

  if (request?.status === "pending") {
    return (
      <section className="card">
        <div className="row">
          <div className="eyebrow">Membership</div>
          <span className="tag"><span className="dot" style={{ background: "var(--amber)" }} />Check requested</span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          The exco will check the member list and confirm you soon. Until then you book as a non-member.
        </p>
      </section>
    );
  }

  const declined = request?.status === "rejected";
  return (
    <section className="card">
      <div className="eyebrow">Membership</div>
      {declined ? (
        <p className="small" style={{ margin: 0 }}>
          Your last member check was declined{request.reason ? `: ${request.reason}` : "."} You can ask again if something has changed.
        </p>
      ) : membership === "pending" ? (
        <p className="small" style={{ margin: 0 }}>
          Your student ID is on the member list, but with a different email. Ask the exco to confirm it&apos;s you.
        </p>
      ) : (
        <p className="small" style={{ margin: 0 }}>
          Joined the club but showing as a non-member? Ask the exco to check the member list.
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        {declined ? "Ask again" : "Request member check"}
      </button>
      {open && <RequestDialog onClose={() => setOpen(false)} />}
    </section>
  );
}

function RequestDialog({ onClose }: { onClose: () => void }) {
  const shoot = useShot();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await requestMemberCheck(note);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      shoot("Request sent", "The exco will check the member list and confirm you soon");
      onClose();
    });
  }

  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="check-title">
        <div className="row">
          <h2 className="h2" id="check-title">Request member check</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus>
            <CloseIcon />
          </button>
        </div>
        <label className="field">
          <span className="field-label">Anything that helps the exco find you (optional)</span>
          <textarea
            className="input"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I used my Gmail on the membership form, or I paid in cash on 12 Oct"
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn" onClick={send} disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}
