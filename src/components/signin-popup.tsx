"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoginForm } from "@/app/(auth)/forms";
import { CloseIcon, ShieldIcon } from "./icons";

const SEEN = "unm-seen-signin";

// Shown once to first-time visitors: after they scroll past the animation, or after 10 seconds.
export function SignInPopup() {
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(SEEN) === "1"; } catch { /* storage blocked: show it */ }
    if (seen) return;
    const show = () => { cleanup(); setOpen(true); };
    const timer = window.setTimeout(show, 10000);
    const onScroll = () => { const r = document.querySelector(".range"); if (r && r.getBoundingClientRect().bottom < 0) show(); };
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, []);

  useEffect(() => {
    const d = dlg.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  const close = () => {
    try { localStorage.setItem(SEEN, "1"); } catch { /* fine */ }
    dlg.current?.close();
    setOpen(false);
  };

  if (!open) return null;
  return (
    <dialog ref={dlg} className="signin-dlg" aria-labelledby="sp-title" onClose={close} onClick={(e) => { if (e.target === dlg.current) close(); }}>
      <div className="modal">
        <button type="button" className="icon-btn sp-x" aria-label="Close" onClick={close}><CloseIcon /></button>
        <h2 id="sp-title" className="h1" style={{ fontSize: "clamp(1.75rem, 1.4rem + 1.2vw, 2.15rem)", paddingRight: 44 }}>Let&apos;s get you into the Archery Range!!</h2>
        <span className="pill" style={{ alignSelf: "flex-start" }}><ShieldIcon className="inline-icon" />Only for UNM Students</span>
        <p className="muted small" style={{ margin: 0 }}>Staff or alumni? Message the club on Instagram.</p>
        <LoginForm />
        <p className="small" style={{ margin: 0, textAlign: "center" }}>Haven&apos;t registered yet? <Link href="/signup" onClick={close}>Sign up</Link></p>
      </div>
    </dialog>
  );
}
