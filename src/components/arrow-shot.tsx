"use client";

import { useEffect, useEffectEvent } from "react";
import { TargetRings } from "./icons";

// Full-screen "arrow hits the target" confirmation. Calls onDone when the animation ends.
export function ArrowShot({ label, sub, onDone }: { label: string; sub?: string; onDone: () => void }) {
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const t = setTimeout(() => finish(), 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="shot" role="status" aria-live="polite">
      <div className="target-wrap">
        <div className="ripple" />
        <TargetRings className="target" />
        <svg className="arrow" viewBox="0 0 240 44" aria-hidden="true">
          <polygon points="7,22 42,22 32,8 2,8" fill="#AD8F1A" />
          <polygon points="7,22 42,22 32,36 2,36" fill="#EF1928" />
          <line x1="22" y1="22" x2="220" y2="22" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <polygon points="218,14 237,22 218,30" fill="currentColor" />
          <rect x="0" y="19" width="9" height="6" rx="1" fill="currentColor" />
        </svg>
      </div>
      <div className="shot-label">{label}</div>
      {sub && <div className="shot-sub">{sub}</div>}
    </div>
  );
}
