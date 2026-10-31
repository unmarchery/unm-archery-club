"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { CalendarIcon, ChartIcon, CheckCircleIcon, ClipboardIcon, HomeIcon, KeyIcon, LogoutIcon, ShieldIcon, StarIcon, ThemeIcon, UsersIcon, WalletIcon } from "./icons";

type Props = {
  name: string;
  membership: "member" | "pending" | "none";
  position: string | null;
  isExco: boolean;
  memberRequests: number | null; // pending count for member managers, null for everyone else
  topupRequests: number | null; // pending count for top-up approvers, null for everyone else
  finance: boolean;
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

export function Sidebar({ name, membership, position, isExco, memberRequests, topupRequests, finance }: Props) {
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
          <Link href="/top-up" className={item("/top-up")} aria-current={path === "/top-up" ? "page" : undefined}>
            <WalletIcon />Top up
          </Link>
        )}
        <Link href="/exco" className={item("/exco")} aria-current={path === "/exco" ? "page" : undefined}>
          <StarIcon />Our exco
        </Link>
        {isExco && (
          <>
            <div className="menu-label">Exco</div>
            <Link href="/exco/people" className={item("/exco/people")} aria-current={path === "/exco/people" ? "page" : undefined}>
              <ShieldIcon />People
            </Link>
            {memberRequests !== null && (
              <Link href="/exco/members" className={item("/exco/members")} aria-current={path === "/exco/members" ? "page" : undefined}>
                <UsersIcon />Members
                {memberRequests > 0 && <span className="badge">{memberRequests}</span>}
              </Link>
            )}
            {memberRequests !== null && (
              <Link href="/exco/accounts" className={item("/exco/accounts")} aria-current={path === "/exco/accounts" ? "page" : undefined}>
                <KeyIcon />Accounts
              </Link>
            )}
            {topupRequests !== null && (
              <Link href="/exco/approvals" className={item("/exco/approvals")} aria-current={path === "/exco/approvals" ? "page" : undefined}>
                <CheckCircleIcon />Approvals
                {topupRequests > 0 && <span className="badge">{topupRequests}</span>}
              </Link>
            )}
            {finance && (
              <Link href="/exco/finance" className={item("/exco/finance")} aria-current={path === "/exco/finance" ? "page" : undefined}>
                <ChartIcon />Finance
              </Link>
            )}
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
            <div className="muted small">{position ?? (membership === "member" ? "Member" : "Non-member")}</div>
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
