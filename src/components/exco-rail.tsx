"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarIcon, ChartIcon, CheckCircleIcon, ClipboardIcon, GearIcon, HomeIcon, KeyIcon, ShieldIcon, StarIcon, TrophyIcon, UsersIcon, WalletIcon } from "./icons";

const ICONS = { home: HomeIcon, shield: ShieldIcon, users: UsersIcon, key: KeyIcon, check: CheckCircleIcon, chart: ChartIcon, calendar: CalendarIcon, clipboard: ClipboardIcon, wallet: WalletIcon, gear: GearIcon, star: StarIcon, trophy: TrophyIcon };
export type RailTool = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

// One bubble at rest showing the last tool you hovered; a liquid column with every tool's name when
// hovered, focused or tapped. The bulge that follows the pointer comes from an SVG goo filter.
export function ExcoRail({ tools }: { tools: RailTool[] }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  const active = tools.findIndex((t) => (t.href === "/exco" ? path === "/exco" : path.startsWith(t.href)));
  const [cur, setCur] = useState(Math.max(0, active));
  const [hv, setHv] = useState(Math.max(0, active));
  const [open, setOpen] = useState(false);
  const pointer = useRef({ type: "mouse", at: 0 });

  useEffect(() => { document.documentElement.dataset.exco = ""; return () => { delete document.documentElement.dataset.exco; }; }, []);
  // Follow the page: when the current tool changes, the resting bubble shows it.
  const [shown, setShown] = useState(active);
  if (active !== shown) { setShown(active); if (active >= 0) { setCur(active); setHv(active); } }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!nav.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => { setOpen(false); setHv(cur); };
  const style = { "--n": tools.length, "--i": cur, "--hv": open ? hv : 0 } as React.CSSProperties;

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" /><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g" /><feComposite in="SourceGraphic" in2="g" operator="atop" /></filter>
      </svg>
      <nav
        ref={nav}
        className={`exco-rail${open ? " open" : ""}`}
        style={style}
        aria-label="Exco tools"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") close(); }}
        onPointerDown={(e) => { pointer.current = { type: e.pointerType, at: Date.now() }; }}
        onFocus={() => { if (Date.now() - pointer.current.at > 600) setOpen(true); }}
        onBlur={(e) => { if (!nav.current?.contains(e.relatedTarget as Node)) close(); }}
        onClick={(e) => {
          // On touch, the first tap opens the column; the next tap picks a tool.
          if (!open) { e.preventDefault(); setOpen(true); return; }
          if (!(e.target as HTMLElement).closest("a")) { close(); return; }
          if (pointer.current.type !== "mouse") setTimeout(close, 250);
        }}
      >
        <div className="rail-goo" aria-hidden="true"><span className="rail-body" /><span className="rail-blob" /></div>
        <ul className="rail-items">
          {tools.map((t, i) => {
            const Icon = ICONS[t.icon];
            return (
              <li key={t.href} className={i === cur ? "cur" : undefined} onPointerOver={() => { if (open) { setHv(i); setCur(i); } }}>
                <Link href={t.href} className={i === hv && open ? "hv" : undefined} aria-current={i === active ? "page" : undefined} aria-label={t.badge ? `${t.label}, ${t.badge} waiting` : t.label} onFocus={() => { setHv(i); setCur(i); }}>
                  <Icon />
                  {!!t.badge && <span className="rail-badge" aria-hidden="true">{t.badge}</span>}
                  <span className="rail-tip" aria-hidden="true">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
