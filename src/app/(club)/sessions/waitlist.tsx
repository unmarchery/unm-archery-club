"use client";

import { useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import type { Gear } from "@/lib/gear";
import { joinWaitlist, leaveWaitlist } from "./actions";

// For a full slot: join the queue, or show your place and leave it.
export function WaitlistButton({ slotId, position, waiting, member, gear }: { slotId: string; position: number; waiting: number; member: boolean; gear: Gear }) {
  const shoot = useShot();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(join: boolean) {
    setError(null);
    startTransition(async () => {
      const res = join ? await joinWaitlist(slotId, gear) : await leaveWaitlist(slotId);
      if (!res.ok) return setError(res.message);
      if (join) shoot("On the waitlist", `You're number ${"position" in res ? res.position : ""}. We'll email you if a spot opens.`);
    });
  }

  return (
    <div className="field" style={{ gap: 6 }}>
      {position > 0 ? (
        <>
          <span className="small">You&apos;re number {position} on the waitlist. If a spot opens you&apos;re booked automatically{member ? "" : " (using one single pass)"} and emailed.</span>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(false)}>
            {pending && <span className="spinner" aria-hidden="true" />}Leave the waitlist
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(true)}>
          {pending && <span className="spinner" aria-hidden="true" />}Join the waitlist{waiting > 0 ? ` (${waiting} waiting)` : ""}
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
