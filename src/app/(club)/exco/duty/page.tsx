import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { OpenDay, RosterDay, type Roster } from "./roster";

// Duty: the equipment team signs up for training days, and anyone with Attendance access
// opens a day's sheet from here.
export default async function DutyPage() {
  const { supabase, status } = await getSession();
  if (!status.is_exco) notFound();
  const { data } = await supabase.rpc("duty_roster");
  if (!data) notFound();
  const r = data as Roster;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Duty</h1>
          <p className="sub">
            {r.can_sign
              ? "Tick the training days you'll be on duty. Each day needs at least " + r.min_people + " people."
              : `Who's on duty for the next two weeks. Each day needs at least ${r.min_people} people.`}
          </p>
        </div>
      </div>

      {r.can_attend && <OpenDay today={r.today} />}

      {r.days.length === 0 && <div className="card"><p className="small muted" style={{ margin: 0 }}>No training days in the next two weeks.</p></div>}
      <div className="grid">
        {r.days.map((d) => (
          <RosterDay key={d.day} day={d} roster={r} />
        ))}
      </div>
    </>
  );
}
