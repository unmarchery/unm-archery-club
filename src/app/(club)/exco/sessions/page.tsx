import { notFound } from "next/navigation";
import { dayLabel, openingLabel, requestTime, shortTimeRange } from "@/lib/format";
import { can, getSession } from "@/lib/session";
import { OpeningControl } from "./opening";
import { CancelSlot, CloseDate, ReopenDate } from "./controls";

type Overview = {
  can_close: boolean;
  today: string;
  days: { day: string; can_cancel: boolean; slots: { id: string; starts_at: string; ends_at: string; cancelled_reason: string | null; booked: number; ended: boolean }[] }[];
  closed: { day: string; reason: string }[];
};

// Cancel slots for weather on the day (duty, President, VP) and close dates ahead
// (Sessions access). Passes come back and everyone booked is emailed.
export default async function SessionsManagerPage() {
  const { supabase, status } = await getSession();
  if (!status.is_exco) notFound();
  const { data } = await supabase.rpc("sessions_overview");
  if (!data) notFound();
  const o = data as Overview;
  const manage = can(status, "manage_sessions");
  type Opening = { day: string; open: boolean; status: string; opens_at: string | null };
  let openings: Opening[] = [];
  if (manage) {
    await supabase.rpc("ensure_slots");
    const end = new Date(requestTime() + 22 * 86_400_000).toISOString().slice(0, 10);
    const { data: od } = await supabase.rpc("day_openings", { p_from: o.today, p_to: end });
    openings = (od ?? []) as Opening[];
  }
  const choiceOf = (x: Opening) => {
    if (x.status !== "scheduled" || !x.opens_at) return x.status as "weekly" | "open" | "locked";
    const days = Math.round((Date.parse(`${x.day}T09:00:00+08:00`) - Date.parse(x.opens_at)) / 86_400_000);
    return days >= 11 ? "w2" : "w1";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Sessions</h1>
          <p className="sub">Cancel a slot or the rest of a day (rain, lightning), or close dates ahead. Everyone booked gets their pass back and an email.</p>
        </div>
      </div>

      {manage && openings.length > 0 && (
        <section className="card">
          <h2 className="h2">Booking opens</h2>
          <p className="muted small" style={{ margin: 0 }}>Choose when each day opens. Members see a countdown and an Add to calendar link for days that aren&apos;t open yet. The weekly rule opens this week and next every Monday.</p>
          {openings.map((x) => (
            <OpeningControl key={x.day} day={x.day} label={dayLabel(x.day)} current={choiceOf(x)}
              note={x.open ? "Open for booking" : x.opens_at ? `Opens ${openingLabel(x.opens_at)}` : "Locked"} />
          ))}
        </section>
      )}

      {o.can_close && (
        <section className="card">
          <div className="eyebrow">Closed dates</div>
          {o.closed.length === 0 && <p className="small muted" style={{ margin: 0 }}>No dates closed.</p>}
          {o.closed.map((c) => (
            <div key={c.day} className="row" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <span className="small"><strong>{dayLabel(c.day)}</strong> · {c.reason}</span>
              <ReopenDate day={c.day} />
            </div>
          ))}
          <CloseDate today={o.today} />
        </section>
      )}

      <div className="grid">
        {o.days.map((d) => (
          <section className="card" key={d.day}>
            <div className="h2">{dayLabel(d.day)}{d.day === o.today ? " · today" : ""}</div>
            {d.slots.map((s) => (
              <div key={s.id} className="row" style={{ paddingTop: 8, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                <div>
                  <div className="strong" style={{ fontSize: 14 }}>{shortTimeRange(s.starts_at, s.ends_at)}</div>
                  <div className="small muted">{s.cancelled_reason ?? (s.ended ? "Finished" : `${s.booked} booked`)}</div>
                </div>
                {d.can_cancel && !s.cancelled_reason && !s.ended && (
                  <CancelSlot slotId={s.id} label={`${dayLabel(d.day)}, ${shortTimeRange(s.starts_at, s.ends_at)}`} hasLater={d.slots.some((x) => x.starts_at > s.starts_at && !x.cancelled_reason)} />
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
