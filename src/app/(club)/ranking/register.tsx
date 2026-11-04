"use client";

import { useState, useTransition } from "react";
import { registerMatch } from "./actions";

export function RegisterButton({ match, registered }: { match: string; registered: boolean }) {
  const [on, setOn] = useState(registered);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const res = await registerMatch(match, !on);
    if (res.ok) setOn(!on); else setError(res.message);
  });
  return (
    <>
      <button type="button" className={on ? "btn btn-ghost btn-sm" : "btn btn-sm"} disabled={pending} onClick={go}>{on ? "Withdraw" : "Register"}</button>
      {on && <span className="pill gold">Registered</span>}
      {error && <span className="error small">{error}</span>}
    </>
  );
}
