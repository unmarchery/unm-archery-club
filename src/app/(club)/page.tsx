import Link from "next/link";
import { BowScene } from "@/components/bow-scene";
import { EventsList } from "@/components/events-list";
import { SignInPopup } from "@/components/signin-popup";
import { TIMEZONE } from "@/lib/format";
import { getOptionalSession } from "@/lib/session";
import { getPublicInfo } from "@/lib/public-info";

// The public landing page: the range animation, the session basics, and a way in.
export default async function LandingPage() {
  const session = await getOptionalSession();
  const member = session?.status.membership === "member";
  const info = await getPublicInfo();
  const single = info.single_price;
  const full = info.fullday_price;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

  return (
    <div className="landing">
      <section className="hero-top">
        <h1 className="hero-title">Find your<br />anchor point.</h1>
        <div className="hero-lead">
          <p>UNM Archery Club trains every Tuesday and Thursday, 4–7pm, at the Sports Complex. The club provides all the equipment. Members shoot free; everyone else books with an hour or day pass.</p>
          <div className="hero-actions">
            <Link href="/sessions" className="btn btn-lg cta-shoot">
              Book a session
              <span className="cta-arrow" aria-hidden="true"><svg viewBox="0 0 30 14"><path d="M2 7h22" /><path d="M21 3.2 27 7l-6 3.8" /><path d="M2 3.5 5.5 7 2 10.5M6 3.5 9.5 7 6 10.5" /></svg></span>
            </Link>
            {!member && <Link href={session ? "/me" : "/signup"} className="btn btn-ghost btn-lg">Join the club</Link>}
          </div>
        </div>
      </section>

      <BowScene />

      <dl className="facts card">
        <div><dt>Training</dt><dd>Tue &amp; Thu, 4–7pm</dd></div>
        <div><dt>Venue</dt><dd>Sports Complex</dd></div>
        <div><dt>Members</dt><dd>Free, every session</dd></div>
        <div><dt>Guests</dt><dd>RM{single} hour · RM{full} day</dd></div>
      </dl>

      {!session && (
        <section className="inline-signin card" aria-labelledby="is-title">
          <div>
            <h2 id="is-title" className="h2">Let&apos;s get you into the Archery Range!!</h2>
            <p className="muted">Only for UNM Students. Sign in to see open slots and book.</p>
          </div>
          <div className="is-actions">
            <Link href="/login" className="btn">Sign in</Link>
            <Link href="/signup" className="btn btn-ghost">Sign up</Link>
          </div>
          <p className="muted small" style={{ gridColumn: "1 / -1", margin: 0 }}>First time? <Link href="/faq">Read the FAQ</Link>: what to wear, where the range is, and what to expect.</p>
        </section>
      )}

      <EventsList today={today} />
      {!session && <SignInPopup />}
    </div>
  );
}
