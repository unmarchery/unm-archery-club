"use client";

import { useActionState } from "react";
import { checkIn, type CheckinState } from "./actions";

export function CheckinForm({ d, k }: { d: string; k: string }) {
  const [s, action, pending] = useActionState<CheckinState, FormData>(checkIn, {});
  if (s.ok) return <p className="ok" role="status" style={{ fontSize: 18 }}>{s.message}</p>;
  return (
    <form action={action} className="field" style={{ gap: 12 }}>
      <input type="hidden" name="d" value={d} /><input type="hidden" name="k" value={k} />
      <button className="btn btn-lg" type="submit" disabled={pending}>{pending ? "Checking in…" : "Check me in"}</button>
      {s.message && <p className="error" role="alert" style={{ margin: 0 }}>{s.message}</p>}
    </form>
  );
}
