"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/(auth)/actions";
import { ArrowIcon, CloseIcon, LogoutIcon, PlusIcon, ShieldIcon, TicketIcon } from "./icons";

export type BarUser = {
  name: string;
  member: boolean;
  isExco: boolean;
  single: number;
  full: number;
};

const TABS = [
  { href: "/sessions", label: "Book a session" },
  { href: "/shop", label: "Shop" },
  { href: "/ranking", label: "Ranking" },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

export function TopBar({ user }: { user: BarUser | null }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [card, setCard] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menus when the page changes, on Escape, or on a tap outside the card.
  const [seenPath, setSeenPath] = useState(path);
  if (path !== seenPath) { setSeenPath(path); setMenu(false); setCard(false); }
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setCard(false); chipRef.current?.focus(); } };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!cardRef.current?.contains(t) && !chipRef.current?.contains(t)) setCard(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [card]);

  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);

  return (
    <header className={`topbar${scrolled ? " scrolled" : ""}`}>
      <div className="topbar-in wrap-v2 gutter">
        <Link href="/" className="brand-v2" aria-label="UNM Archery Club, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={360} height={260} />
          <span>UNM Archery Club</span>
        </Link>
        <nav className="tabs" aria-label="Main">
          <div className="tabs-main">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className="tab" aria-current={current(t.href)}>{t.label}</Link>
            ))}
          </div>
          <div className="tabs-account">
            {!user?.member && <Link href="/join" className="btn btn-ghost tab-join" aria-current={current("/join")}>Join Club</Link>}
            {!user && <Link href="/login" className="btn">Sign In</Link>}
            {user && (
              <div className="chip-wrap">
                <button ref={chipRef} type="button" className="profile-chip" aria-expanded={card} aria-controls="profile-card" aria-label="Open your profile card" onClick={() => setCard((v) => !v)}>
                  <span className="avatar">{initials(user.name)}</span>
                  <span className="chip-text">
                    <span>{user.name.split(/\s+/)[0]}</span>
                    <span className="chip-sub">
                      {user.member ? <span className="mini-inf" aria-label="Unlimited sessions"><i />∞</span> : <><TicketIcon className="inline-icon" />{user.single} hour · {user.full} day</>}
                    </span>
                  </span>
                  <ChevronDown />
                </button>
                {!user.member && <Link href="/shop" className="plus-btn" aria-label="Buy passes in the shop"><PlusIcon /></Link>}
              </div>
            )}
          </div>
          <button type="button" className="icon-btn menu-btn" aria-expanded={menu} aria-controls="mobile-menu" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu((v) => !v)}>
            {menu ? <CloseIcon /> : <MenuIcon />}
          </button>
        </nav>
      </div>

      {menu && (
        <div className="mobile-menu" id="mobile-menu">
          <nav className="wrap-v2 gutter" aria-label="Main, mobile">
            {TABS.map((t) => <Link key={t.href} href={t.href} className="mm-link" aria-current={current(t.href)}>{t.label}<ArrowIcon className="inline-icon" /></Link>)}
            {!user?.member && <Link href="/join" className="btn btn-ghost">Join Club</Link>}
          </nav>
        </div>
      )}

      {user && card && (
        <div className="profile-card" id="profile-card" ref={cardRef} role="dialog" aria-label="Your profile card">
          <Link href="/me" className="pc-head">
            <span className="avatar lg">{initials(user.name)}</span>
            <span className="pc-who">
              <span className="pc-name">{user.name}</span>
              <span className="tags"><span className={user.member ? "pill gold" : "pill"}>{user.member ? "Member" : "Guest"}</span></span>
              <span className="pc-open">Open my profile <ArrowIcon className="inline-icon" /></span>
            </span>
          </Link>
          <div className="pc-block">
            <h4>{user.member ? "Membership" : "Your passes"}</h4>
            {user.member ? (
              <div className="inf-bar" role="img" aria-label="Unlimited sessions"><div className="inf-track" /><span className="inf-cap">∞</span></div>
            ) : (
              <div>
                <div className="pass-line"><span>Hour passes</span><b>{user.single}</b><Link href="/shop" className="plus-btn" aria-label="Buy an hour pass"><PlusIcon /></Link></div>
                <div className="pass-line"><span>Day passes</span><b>{user.full}</b><Link href="/shop" className="plus-btn" aria-label="Buy a day pass"><PlusIcon /></Link></div>
              </div>
            )}
          </div>
          <div className="pc-links">
            <Link href="/bookings"><TicketIcon />My bookings</Link>
            {user.isExco && <Link href="/exco"><ShieldIcon />Exco tools</Link>}
            <form action={logout}><button type="submit"><LogoutIcon />Sign out</button></form>
          </div>
        </div>
      )}
    </header>
  );
}
