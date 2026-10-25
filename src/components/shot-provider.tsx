"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { ArrowShot } from "./arrow-shot";

type Shoot = (label: string, sub?: string) => void;
const ShotContext = createContext<Shoot>(() => {});

// Lives in the club layout, so the animation keeps playing while the page refreshes
// underneath it (the button that started it may disappear once the booking is saved).
export function ShotProvider({ children }: { children: React.ReactNode }) {
  const [shot, setShot] = useState<{ label: string; sub?: string; key: number } | null>(null);
  const shoot = useCallback<Shoot>((label, sub) => setShot({ label, sub, key: Date.now() }), []);
  return (
    <ShotContext value={shoot}>
      {children}
      {shot && <ArrowShot key={shot.key} label={shot.label} sub={shot.sub} onDone={() => setShot(null)} />}
    </ShotContext>
  );
}

export function useShot() {
  return useContext(ShotContext);
}
