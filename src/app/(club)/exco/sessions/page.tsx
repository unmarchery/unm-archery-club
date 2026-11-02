import { notFound } from "next/navigation";
import { dayLabel, shortTimeRange } from "@/lib/format";
import { getSession } from "@/lib/session";
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Sessions</h1>
          <p className="sub">Cancel a slot or the rest of a day (rain, lightning), or close dates ahead. Everyone booked gets their pass back and an email.</p>
        </div>
      </div>

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
