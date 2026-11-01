"use client";

import { useTransition } from "react";
import { leaveWaitlist } from "../sessions/actions";

export function LeaveWaitlist({ slotId }: { slotId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="link-btn" disabled={pending} onClick={() => startTransition(async () => void (await leaveWaitlist(slotId)))}>
      Leave
    </button>
  );
}
