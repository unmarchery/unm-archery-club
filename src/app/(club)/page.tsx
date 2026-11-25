import Link from "next/link";
import { ShopSign } from "@/components/shop-sign";
import { SignInPopup } from "@/components/signin-popup";
import { toneFor } from "@/components/landing/event-art";
import { EventsCarousel, type LandingEvent } from "@/components/landing/events-carousel";
import { ArrowGlyph, Hero } from "@/components/landing/hero";
import { ArrowDivider, Bows, Marquee } from "@/components/landing/motion";
import { TIMEZONE } from "@/lib/format";
import { getPublicInfo } from "@/lib/public-info";
import { getOptionalSession } from "@/lib/session";
import { shopImage } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import "./landing.css";

type Row = { id: string; title: string; starts_on: string; ends_on: string | null; time_label: string | null; details: string | null; audience: "all" | "members"; featured: boolean; image_path?: string | null };

const W = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (day: string) => { const [y, m, d] = day.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return { dow: W[dt.getUTCDay()], d, mon: M[m - 1] }; };
const dm = (day: string) => { const p = parts(day); return `${p.d} ${p.mon}`; };
const dmw = (day: string) => { const p = parts(day); return `${p.dow} ${p.d} ${p.mon}`; };

// The public landing page (handoff 5.3–5.11): hero video, Events, Join Club, Weekly Sessions.
export default async function LandingPage() {
  const session = await getOptionalSession();
  const member = session?.status.membership === "member";
  const info = await getPublicInfo();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

  // Current and upcoming events: ones already on first (featured before the rest), then by start date.
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").or(`ends_on.gte.${today},starts_on.gte.${today}`).order("starts_on").limit(40);
  const rows = ((data ?? []) as Row[]).filter((e) => (e.ends_on ?? e.starts_on) >= today);
  const isNow = (e: Row) => e.starts_on <= today;
  rows.sort((a, b) => Number(isNow(b)) - Number(isNow(a)) || Number(b.featured) - Number(a.featured) || a.starts_on.localeCompare(b.starts_on));
  const events: LandingEvent[] = rows.slice(0, 8).map((e) => ({
    id: e.id,
    title: e.title,
    now: isNow(e),
    dateLabel: isNow(e) ? (e.ends_on && e.ends_on !== today ? `Until ${dm(e.ends_on)}` : "Today") : dmw(e.starts_on),
    rangeLabel: e.ends_on && e.ends_on !== e.starts_on ? `${dm(e.starts_on)} – ${dm(e.ends_on)}` : dmw(e.starts_on),
    time: e.time_label,
    who: e.audience === "members" ? "Members" : "Open to all",
    details: e.details,
    image: e.image_path ? shopImage(e.image_path) : null,
    tone: toneFor(e.title),
  }));

  const fee = info.membership_fee;
  const joinHref = session ? "/me" : "/signup";

  return (
    <div className="landing">
      <Hero />

      <section className="section events" id="events" aria-labelledby="events-title">
        <div className="wrap-v2 gutter"><ShopSign id="events-title" title="Events" tag="01 · ON THE RANGE" /></div>
        <EventsCarousel events={events} />
      </section>

      <ArrowDivider dir="ltr" />

      <section className="section join" id="join" aria-labelledby="join-title">
        <div className="wrap-v2 gutter join__grid">
          <div className="join__main">
            <ShopSign id="join-title" title="Join Club" tag="02 · MEMBERSHIP" />
            <p className="lede">One membership puts you on the shooting line every week, with the gear, the coaching and a place on the board.</p>
            <p className="perks__label">Perks:</p>
            <ul className="perks" role="list">
              <li className="perk" data-glow>
                <svg className="perk__icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 20a14 14 0 1 0 4-9.9" /><path d="M6 6v6h6" /><path d="M20 12v8l5 3" /></svg>
                <div><h3>Unlimited sessions</h3><p>Shoot every Tuesday and Thursday with no range fees.</p></div>
              </li>
              <li className="perk" data-glow>
                <svg className="perk__icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 34V22h7v12M17 34V12h7v22M26 34V17h7v17" /><path d="M5 34h31" /></svg>
                <div><h3>Ranking system unlocked</h3><p>Log your scores and climb the club board.</p></div>
              </li>
              <li className="perk" data-glow>
                <svg className="perk__icon" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="11" r="5" /><path d="M9 35c0-7 5-12 11-12s11 5 11 12" /><path d="M29 6l6-3" /></svg>
                <div><h3>Coaches on the line</h3><p>Form checks from stance and draw to anchor and release.</p></div>
              </li>
              <li className="perk perk--price" data-glow>
                <svg className="perk__icon" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" /><circle cx="20" cy="20" r="9" /><circle cx="20" cy="20" r="3" /></svg>
                <div>
                  <h3>{fee != null ? <><span className="price">RM{fee}</span> for the whole academic year</> : <>One fee for the whole academic year</>}</h3>
                  <p>One payment covers every session until next year.</p>
                </div>
              </li>
            </ul>
            <div className="join__cta">
              {member ? (
                <p className="join__member"><span aria-hidden="true">✦</span> You&apos;re a member. Every session is free for you.</p>
              ) : (
                <Link className="btn btn--primary btn--lg" href={joinHref} data-magnetic>
                  <span className="btn__label">Join Club</span>
                  <ArrowGlyph />
                </Link>
              )}
            </div>
          </div>
          <Bows sectionId="join" />
        </div>
      </section>

      <ArrowDivider dir="rtl" />

      <section className="section weekly" id="weekly" aria-labelledby="weekly-title">
        <div className="wrap-v2 gutter"><ShopSign id="weekly-title" title="Weekly Sessions" tag="03 · EVERY WEEK" /></div>
        <Marquee items={[
          { k: "When", v: "Every Tue & Thu", s: "4–7pm" },
          { k: "Venue", v: "Sports Complex", s: "On campus" },
          { k: "Members", v: "Free", s: "Every session" },
          { k: "Guests", v: `RM${info.single_price} / hour`, s: `RM${info.fullday_price} / day` },
          { k: "Beginners", v: "Welcome", s: "Coached from day one" },
        ]} />
        <div className="wrap-v2 gutter weekly__cta">
          <Link className="btn btn--primary btn--lg" href="/sessions" data-magnetic>
            <span className="btn__label">Book a session</span>
            <ArrowGlyph />
          </Link>
        </div>
      </section>

      {!session && <SignInPopup />}
    </div>
  );
}
