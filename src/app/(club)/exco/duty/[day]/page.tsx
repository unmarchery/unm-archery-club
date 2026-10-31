import Link from "next/link";
import { notFound } from "next/navigation";
import { dayLabel, shortTimeRange } from "@/lib/format";
import { getSession } from "@/lib/session";
import { AddWalkin, BookingRow, NameWalkin, type SheetBooking } from "./sheet";

type Sheet = {
  day: string;
  open: boolean;
  can_fix: boolean;
  locked_after: string;
  duty: string[];
  slots: { id: string; starts_at: string; ends_at: string; bookings: SheetBooking[]; walkins: { id: string; full_name: string }[] }[];
};

// "RH 18 lbs ×3 · LH 14 lbs ×1 · Own bow ×2": what to set up for a slot.
function prepList(bookings: SheetBooking[]) {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "no_show") continue;
    const g = b.equipment ?? {};
    const key = g.own_bow ? "Own bow" : `${g.hand === "LH" ? "LH" : "RH"} ${!g.draw_lbs || g.draw_lbs === "Not sure" ? "any weight" : `${g.draw_lbs} lbs`}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort().map(([k, n]) => `${k} ×${n}`);
}

export default async function AttendancePage({ params }: PageProps<"/exco/duty/[day]">) {
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const { supabase } = await getSession();
  const { data } = await supabase.rpc("attendance_day", { p_day: day });
  if (!data) notFound();
  const s = data as Sheet;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/exco/duty" className="small" style={{ color: "var(--gold-text)" }}>← Duty</Link>
          <h1 className="h1">Attendance · {dayLabel(s.day)}</h1>
          <p className="sub">
            On duty: {s.duty.length ? s.duty.join(", ") : "nobody signed up"}.{" "}
            {s.open
              ? s.can_fix ? "You can change this any time." : `You can tick until the end of ${dayLabel(s.locked_after)}.`
              : "Locked. Only the President or VP can change it now."}
          </p>
        </div>
      </div>

      {s.slots.length === 0 && <div className="card"><p className="small muted" style={{ margin: 0 }}>No training on this day.</p></div>}

      {s.slots.map((slot) => {
        const present = slot.bookings.filter((b) => b.status === "present").length + slot.walkins.length;
        const noShows = slot.bookings.filter((b) => b.status === "no_show").length;
        const prep = prepList(slot.bookings);
        return (
          <section className="card" key={slot.id}>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <div className="slot-time">{shortTimeRange(slot.starts_at, slot.ends_at)}</div>
              <div className="tags">
                <span className="tag">{slot.bookings.length} booked</span>
                <span className="tag"><span className="dot" style={{ background: "var(--gold)" }} />{present} present</span>
                {noShows > 0 && <span className="tag"><span className="dot" style={{ background: "var(--red)" }} />{noShows} no-show</span>}
              </div>
            </div>
            {prep.length > 0 && <p className="small muted" style={{ margin: 0 }}>Set up: {prep.join(" · ")}</p>}
            {slot.bookings.length === 0 && slot.walkins.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nobody booked.</p>}
            <div className="field" style={{ gap: 0 }}>
              {slot.bookings.map((b) => (
                <BookingRow key={b.id} booking={b} open={s.open} canFix={s.can_fix} />
              ))}
              {slot.walkins.map((w) => (
                <NameWalkin key={w.id} walkin={w} open={s.open} />
              ))}
            </div>
            {s.open && <AddWalkin slotId={slot.id} />}
          </section>
        );
      })}
    </>
  );
}
