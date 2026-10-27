"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { CalendarIcon, CheckCircleIcon, ClipboardIcon, HomeIcon, LogoutIcon, ThemeIcon, WalletIcon } from "./icons";

type Props = {
  name: string;
  membership: "member" | "pending" | "none";
  isExco: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.classList.contains("theme-light") ? "dark" : "light";
  html.classList.remove("theme-dark", "theme-light");
  html.classList.add(`theme-${next}`);
  document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function Sidebar({ name, membership, isExco }: Props) {
  const path = usePathname();
  const item = (href: string) => `menu-item${path === href ? " on" : ""}`;

  return (
    <aside className="side">
      <Link href="/" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="UNM Archery Club logo" width={360} height={260} />
        <span className="brand-name">UNM Archery Club</span>
      </Link>

      <nav className="menu" aria-label="Main">
        <div className="menu-label">Training</div>
        <Link href="/" className={item("/")} aria-current={path === "/" ? "page" : undefined}>
          <HomeIcon />Home
        </Link>
        <Link href="/sessions" className={item("/sessions")} aria-current={path === "/sessions" ? "page" : undefined}>
          <CalendarIcon />Sessions
        </Link>
        {membership !== "member" && (
          <span className="menu-item soon" aria-disabled="true">
            <WalletIcon />Top up<span className="soon-tag">Soon</span>
          </span>
        )}
        {isExco && (
          <>
            <div className="menu-label">Exco</div>
            <span className="menu-item soon" aria-disabled="true">
              <CheckCircleIcon />Approvals<span className="soon-tag">Soon</span>
            </span>
            <span className="menu-item soon" aria-disabled="true">
              <ClipboardIcon />Duty<span className="soon-tag">Soon</span>
            </span>
          </>
        )}
      </nav>

      <div className="side-foot">
        <div className="me">
          <div className="avatar" aria-hidden="true">{initials(name)}</div>
          <div>
            <div className="strong" style={{ fontSize: 14 }}>{name}</div>
            <div className="muted small">{membership === "member" ? "Member" : "Non-member"}</div>
          </div>
        </div>
        <div className="side-actions">
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Switch between light and dark">
            <ThemeIcon />
          </button>
          <form action={logout}>
            <button type="submit" className="icon-btn" aria-label="Log out">
              <LogoutIcon />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
