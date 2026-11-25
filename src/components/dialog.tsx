"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { CloseIcon } from "./icons";

// A page-level pop-up (handoff 5.13): always a top-layer <dialog>, so it opens centred on screen and
// can never be clipped by a card or an overflow container. Closes with ✕, Esc or a click on the backdrop,
// and gives focus back to whatever opened it. Mount it only while open.
export function Dialog({ onClose, label, labelledBy, className = "", children, closeLabel = "Close", bare }: {
  onClose: () => void; label?: string; labelledBy?: string; className?: string; children: React.ReactNode; closeLabel?: string;
  bare?: boolean; // no panel: the content brings its own surfaces
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  // Opened in a layout effect, so it is already on screen when the content's own layout effects measure it.
  useLayoutEffect(() => {
    const d = ref.current!;
    const back = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => { e.preventDefault(); close.current(); };
    d.addEventListener("cancel", onCancel);
    return () => { d.removeEventListener("cancel", onCancel); back?.focus?.(); };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dlg ${className}`.trim()}
      aria-label={label}
      aria-labelledby={labelledBy}
      onClick={(e) => { if (e.target === e.currentTarget) close.current(); }}
    >
      <div className={bare ? "dlg__bare" : "dlg__panel"}>
        <button type="button" className="dlg__x" aria-label={closeLabel} onClick={() => close.current()}><CloseIcon /></button>
        {children}
      </div>
    </dialog>
  );
}
