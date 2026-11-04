import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Row = { id: string; title: string; starts_on: string; ends_on: string | null; time_label: string | null; details: string | null; audience: "all" | "members"; featured: boolean };

const W = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (day: string) => { const [y, m, d] = day.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return { dow: W[dt.getUTCDay()], d, mon: M[m - 1] }; };
const label = (day: string) => { const p = parts(day); return `${p.dow} ${p.d} ${p.mon}`; };

// Landing page events: one "happening now" shown big, then what's coming up.
export async function EventsList({ today }: { today: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").or(`ends_on.gte.${today},starts_on.gte.${today}`).order("starts_on").limit(40);
  const rows = ((data ?? []) as Row[]).filter((e) => (e.ends_on ?? e.starts_on) >= today);
  const now = rows.find((e) => e.featured && e.starts_on <= today);
  const next = rows.filter((e) => e !== now).slice(0, 6);
  if (!now && next.length === 0) return null;

  return (
    <section className="events" aria-labelledby="events-title">
      <div className="events-head">
        <h2 id="events-title" className="h1" style={{ fontSize: "clamp(1.7rem, 1.3rem + 1.4vw, 2.4rem)" }}>Events</h2>
        <p className="muted">What&apos;s on at the range this semester.</p>
      </div>
      {now && (
        <article className="event-now card" aria-label="Happening now">
          <div>
            <span className="pill gold">Happening now</span>
            <h3>{now.title}</h3>
            <p className="when">{label(now.starts_on)}{now.ends_on ? ` – ${label(now.ends_on)}` : ""}{now.time_label ? ` · ${now.time_label}` : ""}</p>
          </div>
          <div className="desc">
            {now.details && <p>{now.details}</p>}
            <Link href="/sessions" className="btn" style={{ width: "auto", alignSelf: "flex-start" }}>Book a session</Link>
          </div>
        </article>
      )}
      {next.length > 0 && (
        <ol className="event-list">
          {next.map((e) => {
            const p = parts(e.starts_on);
            return (
              <li key={e.id} className="event-row">
                <div className="date-block" aria-hidden="true"><span className="dow">{p.dow}</span><span className="d">{p.d}</span><span className="m">{p.mon}</span></div>
                <div style={{ minWidth: 0 }}>
                  <h3>{e.title}<span className="sr-only">, {label(e.starts_on)}</span></h3>
                  {(e.time_label || e.details) && <p className="meta">{[e.time_label, e.details].filter(Boolean).join(" · ")}</p>}
                </div>
                <span className={e.audience === "members" ? "pill gold" : "pill"}>{e.audience === "members" ? "Members" : "Open to all"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
