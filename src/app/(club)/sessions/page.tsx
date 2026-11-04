import Link from "next/link";
import { LockIcon } from "@/components/icons";
import { bookingOpensUrl, googleCalendarUrl } from "@/lib/calendar";
import { clockLabel, dayKey, longDay, openingLabel, requestTime, shortDay, shortTimeRange } from "@/lib/format";
import type { ClubBows, Gear } from "@/lib/gear";
import { getPublicInfo } from "@/lib/public-info";
import { getOptionalSession } from "@/lib/session";
import { BookButton, CancelButton, WholeDayButton } from "./booking";
import { DayCarousel } from "./carousel";
import { VisitorInfo } from "./visitor-info";
import { WaitlistButton } from "./waitlist";

type Row = {
  slot_id: string; starts_at: string; ends_at: string; cancelled: boolean; cancelled_reason: string | null;
  capacity: number; nonmember_cap: number; booked: number; nonmember_booked: number;
  my_booking_id: string | null; my_pass_kind: "member" | "single" | "full" | null; my_group: string | null;
  waiting?: number; my_waitlist?: number;
};
type Opening = { day: string; open: boolean; status: string; opens_at: string | null };

const until = (iso: string, now: number) => {
  const h = Math.max(1, Math.round((Date.parse(iso) - now) / 3_600_000));
  return h < 24 ? `in ${h} hour${h === 1 ? "" : "s"}` : `in ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`;
};

export default async function SessionsPage() {
  const session = await getOptionalSession();
  const info = await getPublicInfo();
  const head = (
    <div className="page-head">
      <div>
        <h1 className="h1">Book a session</h1>
        <p className="sub">Tuesdays and Thursdays, 4–7pm, in hour slots. The exco opens each session for booking 1–2 weeks ahead.</p>
      </div>
    </div>
  );
  if (!session) return <>{head}<VisitorInfo single={info.single_price} full={info.fullday_price} /></>;

  const { supabase, profile, status } = session;
  const now = requestTime();
  const from = new Date(now).toISOString(), to = new Date(now + 22 * 86_400_000).toISOString();
  const day = (iso: string) => dayKey(iso);
  await supabase.rpc("ensure_slots");
  const [{ data }, { data: cfgData }, { data: openData }] = await Promise.all([
    supabase.rpc("slot_availability", { p_from: from, p_to: to }),
    supabase.from("settings").select("nonmember_refund_hours, club_bows").single(),
    supabase.rpc("day_openings", { p_from: day(from), p_to: day(to) }),
  ]);
  const rows = (data ?? []) as Row[];
  const openings = new Map(((openData ?? []) as Opening[]).map((o) => [o.day, o]));
  const member = status.membership === "member";
  const refundMs = (cfgData?.nonmember_refund_hours ?? 2) * 3_600_000;
  const clubBows = (cfgData?.club_bows ?? { RH: [], LH: [] }) as ClubBows;
  const gear: Gear = { hand: profile.hand, draw_lbs: profile.draw_lbs, own_bow: profile.own_bow, own_bow_type: profile.own_bow_type, own_bow_lbs: profile.own_bow_lbs };
  const noshow = { warn: info.noshow_warn_after, ban: info.noshow_ban_after, days: info.ban_days };

  const days = new Map<string, Row[]>();
  for (const r of rows) days.set(day(r.starts_at), [...(days.get(day(r.starts_at)) ?? []), r]);

  const cancelNote = (r: Row) => {
    if (r.my_pass_kind === "member") return "Cancel this booking? You can rebook if there's still space.";
    if (r.my_pass_kind === "single") return now <= Date.parse(r.starts_at) - refundMs ? "Cancel this booking? You'll get your hour pass back." : "It's less than 2 hours to go, so the pass won't come back. Cancel anyway?";
    const groupStart = Math.min(...rows.filter((x) => x.my_group === r.my_group).map((x) => Date.parse(x.starts_at)));
    return now <= groupStart - refundMs ? `Cancel the whole day before ${clockLabel(new Date(groupStart - refundMs).toISOString())} to get your day pass back.` : "It's less than 2 hours to the first slot, so the day pass won't come back.";
  };

  const boxes = [...days.entries()].map(([key, slots]) => {
    const o = openings.get(key), title = longDay(slots[0].starts_at), short = shortDay(slots[0].starts_at);
    if (o && !o.open) {
      return (
        <article key={key} className="day-box locked-box" aria-label={`${title}, not open yet`}>
          <LockIcon />
          <h3>{short}</h3>
          {o.opens_at ? (
            <>
              <p>Opens for booking {openingLabel(o.opens_at)} · <strong>{until(o.opens_at, now)}</strong></p>
              <a className="btn btn-ghost btn-sm" href={bookingOpensUrl(short, o.opens_at)} target="_blank" rel="noreferrer">Add to calendar</a>
            </>
          ) : <p>Not open for booking yet. The exco opens sessions 1–2 weeks ahead.</p>}
        </article>
      );
    }
    const live = slots.filter((r) => !r.cancelled && Date.parse(r.starts_at) > now);
    const anyMine = slots.some((r) => r.my_booking_id);
    const free = (r: Row) => r.capacity - r.booked > 0 && (member || r.nonmember_booked < r.nonmember_cap);
    const canDay = !anyMine && live.length === slots.length && live.every(free) && (member || status.full > 0);
    const range = shortTimeRange(slots[0].starts_at, slots[slots.length - 1].ends_at);
    const fullDay = { ok: !member && status.full > 0 && canDay, note: status.full > 0 ? `Uses 1 of your ${status.full} day passes` : "No day passes left" };
    const common = { title, fullDayTitle: `${title}, ${range}`, member, singles: status.single, fulls: status.full, fullDay, gear, clubBows, noshow };
    return (
      <article key={key} className="day-box">
        <header className="day-box-head"><h3>{short}</h3><span className="pill">{range}</span></header>
        {!member && <p className="helper">Staying all 3 hours? A day pass is cheaper: RM{info.fullday_price} instead of RM{info.single_price * slots.length}.</p>}
        <ul className="hours">
          {slots.map((r) => {
            const left = r.capacity - r.booked, started = Date.parse(r.starts_at) <= now;
            const shown = member ? left : Math.min(left, r.nonmember_cap - r.nonmember_booked);
            return (
              <li key={r.slot_id} className="hour">
                <div className="hour-time">{shortTimeRange(r.starts_at, r.ends_at)}</div>
                <div className="hour-status">
                  <span className="strong">{r.cancelled ? `Cancelled${r.cancelled_reason ? `: ${r.cancelled_reason}` : ""}` : shown > 0 ? <><b>{shown}</b> slots remaining</> : "Full"}{!r.cancelled && shown > 0 && shown <= 3 && <span className="pill gold" style={{ marginLeft: 6 }}>Almost full</span>}</span>
                  <div className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((r.booked / r.capacity) * 100))}%`, background: shown <= 3 ? "var(--bull)" : "var(--forest)" }} /></div>
                </div>
                <div className="hour-action">
                  {r.cancelled || started ? <span className="pill">{r.cancelled ? "Cancelled" : "Started"}</span>
                    : r.my_booking_id ? <><span className="pill gold">Booked</span><CancelButton bookingId={r.my_booking_id} fullDay={r.my_pass_kind === "full"} note={cancelNote(r)} /><a className="link-btn" href={googleCalendarUrl(r.starts_at, r.ends_at)} target="_blank" rel="noreferrer">Add to calendar</a></>
                    : shown > 0 ? <BookButton slotId={r.slot_id} {...common} title={`${title}, ${shortTimeRange(r.starts_at, r.ends_at)}`} />
                    : r.waiting !== undefined && Date.parse(r.starts_at) - now > 3_600_000 ? <WaitlistButton slotId={r.slot_id} position={r.my_waitlist ?? 0} waiting={r.waiting} member={member} gear={gear} />
                    : <span className="pill">Full</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <footer className="day-box-foot">
          {canDay ? <><p className="muted small">{member ? "All three hours, free." : `Uses 1 day pass. You have ${status.full}.`}</p><WholeDayButton slotId={live[0].slot_id} {...common} day={{ slotIds: live.map((r) => r.slot_id) }} /></>
            : <p className="muted small">{anyMine ? "You've booked hours on this day." : !member && status.full < 1 ? `Book all three hours with one day pass (RM${info.fullday_price}).` : "Whole-day booking needs a free spot in every hour."}</p>}
        </footer>
      </article>
    );
  });

  return (
    <>
      {head}
      {status.banned_until && Date.parse(status.banned_until) > now && (
        <div className="card notice"><p className="small" style={{ margin: 0 }}>You&apos;re paused from booking until {longDay(status.banned_until)} because of no-shows.</p></div>
      )}
      <div className="pass-bar card">
        {member ? <><strong>Member</strong><span className="muted">Every session is free for you.</span></>
          : <><strong>Your passes</strong><span className="pill">{status.single} hour</span><span className="pill">{status.full} day</span><Link className="btn btn-ghost btn-sm" href="/shop" style={{ marginLeft: "auto" }}>Buy passes</Link></>}
      </div>
      {boxes.length === 0 ? <div className="card"><p className="muted small" style={{ margin: 0 }}>No sessions in the next three weeks.</p></div>
        : <DayCarousel count={boxes.length}>{boxes}</DayCarousel>}
    </>
  );
}
