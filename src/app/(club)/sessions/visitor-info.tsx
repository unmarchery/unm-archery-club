import Link from "next/link";
import { CalendarIcon, TicketIcon, UsersIcon } from "@/components/icons";

// What visitors see on Book a session: the basics, and a way to sign in for open slots.
export function VisitorInfo({ single, full }: { single: number; full: number }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="visitor-book">
      <div className="schedule">
        <h2>Every Tuesday and Thursday</h2>
        <div className="time">4:00 – 7:00 pm</div>
        <div className="week" role="img" aria-label="Sessions on Tuesday and Thursday">
          {days.map((d, i) => <span key={i} className={i === 1 || i === 3 ? "on" : undefined} aria-hidden="true">{d}</span>)}
        </div>
        <div className="hours-strip"><span>4–5pm</span><span>5–6pm</span><span>6–7pm</span></div>
        <ul className="good-to-know">
          <li><b>All equipment provided</b><span>The club provides everything you need to shoot.</span></li>
          <li><b>Venue</b><span>Sports Complex.</span></li>
          <li><b>Flexible</b><span>No forced attendance. Come when it suits you.</span></li>
        </ul>
      </div>
      <div className="how">
        <h2 className="h1" style={{ fontSize: "1.8rem" }}>How booking works</h2>
        <div className="how-row"><UsersIcon /><div><h3>Members</h3><p>Book any session for free, as often as you like.</p></div></div>
        <div className="how-row"><TicketIcon /><div><h3>Guests</h3><p>UNM students who aren&apos;t members yet. Book with an hour pass (RM{single}) or a day pass (RM{full}).</p></div></div>
        <div className="how-row"><CalendarIcon /><div><h3>Open slots</h3><p>Sign in to see which sessions are open and how many slots are left.</p></div></div>
        <Link href="/login" className="btn btn-lg" style={{ width: "auto", alignSelf: "flex-start" }}>Sign in to see open slots</Link>
      </div>
    </div>
  );
}
