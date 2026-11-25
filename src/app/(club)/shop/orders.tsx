"use client";

import { useState, useTransition } from "react";
import { cancelOrder } from "./actions";

export function CancelOrder({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button type="button" className="link-btn" disabled={pending} onClick={() => startTransition(async () => {
        const res = await cancelOrder(orderId);
        if (!res.ok) setError(res.message);
      })}>Cancel order</button>
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}
