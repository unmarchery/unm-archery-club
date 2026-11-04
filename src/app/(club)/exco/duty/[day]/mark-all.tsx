"use client";

import { useState, useTransition } from "react";
import { markAllPresent } from "../actions";

export function MarkAllPresent({ slotId }: { slotId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} style={{ alignSelf: "flex-start" }}
        onClick={() => start(async () => { const r = await markAllPresent(slotId); if (!r.ok) setError(r.message); })}>
        {pending ? "Marking…" : "Mark everyone present"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
