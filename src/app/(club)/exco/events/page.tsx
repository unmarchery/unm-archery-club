import { notFound } from "next/navigation";
import { dayLabel } from "@/lib/format";
import { can, getSession } from "@/lib/session";
import { deleteEvent } from "./actions";
import { EventForm, type ClubEvent } from "./form";

export default async function EventsToolPage() {
  const { supabase, status } = await getSession();
  if (!can(status, "manage_events")) notFound();
  const { data } = await supabase.from("events").select("*").order("starts_on", { ascending: false }).limit(40);
  const events = (data ?? []) as ClubEvent[];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Events</h1>
          <p className="sub">Post what&apos;s on. Events show on the landing page; mark one as &quot;happening now&quot; to show it big.</p>
        </div>
      </div>
      <EventForm />
      <section className="card">
        <h2 className="h2">Posted events</h2>
        {events.length === 0 && <p className="muted">Nothing posted yet.</p>}
        {events.map((e) => (
          <details key={e.id} className="person">
            <summary>
              <span className="person-main">
                <span className="strong">{e.title}</span>
                <span className="muted small">{dayLabel(e.starts_on)}{e.ends_on ? ` – ${dayLabel(e.ends_on)}` : ""}{e.time_label ? ` · ${e.time_label}` : ""}</span>
              </span>
              <span className="tags">
                {e.featured && <span className="pill gold">Happening now</span>}
                <span className="pill">{e.audience === "members" ? "Members" : "Open to all"}</span>
              </span>
            </summary>
            <div className="person-body">
              <EventForm event={e} />
              <form action={deleteEvent}><input type="hidden" name="id" value={e.id} /><button className="btn btn-danger btn-sm" type="submit">Delete event</button></form>
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
