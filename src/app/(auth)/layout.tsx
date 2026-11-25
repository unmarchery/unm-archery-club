import type { Metadata } from "next";
import Link from "next/link";
import "./auth.css";

// Sign in, sign up and the password pages (handoff 8.4): a dark glass card centred over a dimmed,
// blurred frame of the hero video, with the page's shop-sign title.
// Sign-in pages stay out of Google results.
export const metadata: Metadata = { robots: { index: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <div className="auth__bg" aria-hidden="true" />
      <div className="auth-card">
        <Link href="/" className="auth-home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={44} height={44} />
          <span>UNM Archery Club</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
