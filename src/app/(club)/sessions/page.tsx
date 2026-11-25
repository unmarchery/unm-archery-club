import { bookingOpensUrl, googleCalendarUrl } from "@/lib/calendar";
import { clockLabel, dayKey, longDay, openingLabel, requestTime, shortDay, shortTimeRange } from "@/lib/format";
import type { ClubBows, Gear } from "@/lib/gear";
import { getPublicInfo } from "@/lib/public-info";
import { getOptionalSession } from "@/lib/session";
import { Booker } from "./booker";
import { BookTitle } from "./title";
import type { DayCard, MyBooking } from "./types";
import { VisitorInfo } from "./visitor-info";
import "./book.css";

type Row = {
  slot_id: string; starts_at: string; ends_at: string; cancelled: boolean; cancelled_reason: string | null;
  capacity: number; nonmember_cap: number; booked: number; nonmember_booked: number;
  my_booking_id: string | null; my_pass_kind: "member" | "single" | "full" | null; my_group: string | null;
  waiting?: number; my_waitlist?: number;
};
type Opening = { day: string; open: boolean; status: string; opens_at: string | null };
type Mine = { id: string; slot_id: string; pass_kind: "member" | "single" | "full"; full_day_group: string | null; equipment: Partial<Gear>; slots: { starts_at: string; ends_at: string } };

const until = (iso: string, now: number) => {
  const h = Math.max(1, Math.round((Date.parse(iso) - now) / 3_600_000));
  return h < 24 ? `in ${h} hour${h === 1 ? "" : "s"}` : `in ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`;
};
// The club's academic year, e.g. "2026/27" (a new year starts in September).
const academicYear = (now: number) => {
  const d = new Date(now), y = d.getUTCFullYear(), start = d.getUTCMonth() >= 8 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
};

// Book a session (handoff 5.13): the live booking rules and data, in the approved design.
export default async function SessionsPage() {
  const session = await getOptionalSession();
  const info = await getPublicInfo();
  if (!session) {
    return (
      <div className="book page-bleed">
        <div className="book-head book-head--visitor wrap-v2 gutter"><BookTitle /></div>
        <div className="wrap-v2 gutter"><VisitorInfo single={info.single_price} full={info.fullday_price} /></div>
      </div>
    );
  }

  const { supabase, profile, status } = session;
  const now = requestTime();
  const from = new Date(now).toISOString(), to = new Date(now + 22 * 86_400_000).toISOString();
  const day = (iso: string) => dayKey(iso);
  await supabase.rpc("ensure_slots");
  const [{ data }, { data: cfgData }, { data: openData }, { data: mineData }] = await Promise.all([
    supabase.rpc("slot_availability", { p_from: from, p_to: to }),
    supabase.from("settings").select("nonmember_refund_hours, club_bows").single(),
    supabase.rpc("day_openings", { p_from: day(from), p_to: day(to) }),
    // Row Level Security returns only this archer's own bookings.
    supabase.from("bookings").select("id, slot_id, pass_kind, full_day_group, equipment, slots!inner(starts_at, ends_at)")
      .eq("status", "booked").gt("slots.starts_at", from).returns<Mine[]>(),
  ]);
  const rows = (data ?? []) as Row[];
  const openings = new Map(((openData ?? []) as Opening[]).map((o) => [o.day, o]));
  const member = status.membership === "member";
  const refundMs = (cfgData?.nonmember_refund_hours ?? 2) * 3_600_000;
  const clubBows = (cfgData?.club_bows ?? { RH: [], LH: [] }) as ClubBows;
  const gear: Gear = { hand: profile.hand, draw_lbs: profile.draw_lbs, own_bow: profile.own_bow, own_bow_type: profile.own_bow_type, own_bow_lbs: profile.own_bow_lbs };

  // What happens to the pass if a booking is cancelled now (the same rules the database applies).
  const cancelNote = (b: Mine) => {
    if (b.pass_kind === "member") return "You can rebook if there's still space.";
    if (b.pass_kind === "single") return now <= Date.parse(b.slots.starts_at) - refundMs ? "You'll get your hour pass back." : "It's less than 2 hours to go, so the hour pass won't come back.";
    const groupStart = Math.min(...(mineData ?? []).filter((x) => x.full_day_group === b.full_day_group).map((x) => Date.parse(x.slots.starts_at)));
    return now <= groupStart - refundMs
      ? `Cancel the whole day before ${clockLabel(new Date(groupStart - refundMs).toISOString())} to get your day pass back. Cancelling one hour doesn't return it.`
      : "It's less than 2 hours to the first hour, so the day pass won't come back.";
  };
  const mine: MyBooking[] = [...(mineData ?? [])]
    .sort((a, b) => Date.parse(a.slots.starts_at) - Date.parse(b.slots.starts_at))
    .map((b) => ({
      id: b.id, slotId: b.slot_id, day: shortDay(b.slots.starts_at), time: shortTimeRange(b.slots.starts_at, b.slots.ends_at),
      startsAt: b.slots.starts_at, passKind: b.pass_kind, group: b.full_day_group, gear: b.equipment ?? {},
      cancelNote: cancelNote(b), calendar: googleCalendarUrl(b.slots.starts_at, b.slots.ends_at),
    }));
  const byId = new Map(mine.map((b) => [b.id, b]));

  const byDay = new Map<string, Row[]>();
  for (const r of rows) byDay.set(day(r.starts_at), [...(byDay.get(day(r.starts_at)) ?? []), r]);

  const days: DayCard[] = [...byDay.entries()].map(([key, slots]) => {
    const o = openings.get(key), title = longDay(slots[0].starts_at), short = shortDay(slots[0].starts_at);
    const range = shortTimeRange(slots[0].starts_at, slots[slots.length - 1].ends_at);
    const locked = o && !o.open
      ? o.opens_at
        ? { text: `Opens for booking ${openingLabel(o.opens_at)}`, soon: until(o.opens_at, now), calendar: bookingOpensUrl(short, o.opens_at) }
        : { text: "Not open for booking yet. The exco opens sessions 1–2 weeks ahead.", soon: null, calendar: null }
      : null;
    const live = slots.filter((r) => !r.cancelled && Date.parse(r.starts_at) > now);
    const anyMine = slots.some((r) => r.my_booking_id);
    const free = (r: Row) => r.capacity - r.booked > 0 && (member || r.nonmember_booked < r.nonmember_cap);
    return {
      key, title, short, range, locked,
      slots: slots.map((r) => {
        const left = r.capacity - r.booked;
        const shown = member ? left : Math.min(left, r.nonmember_cap - r.nonmember_booked);
        const waitlistOpen = r.waiting !== undefined && shown <= 0 && Date.parse(r.starts_at) - now > 3_600_000;
        return {
          id: r.slot_id, time: shortTimeRange(r.starts_at, r.ends_at), cancelled: r.cancelled, cancelledReason: r.cancelled_reason,
          started: Date.parse(r.starts_at) <= now, left: Math.max(0, shown), fill: Math.min(100, Math.round((r.booked / Math.max(1, r.capacity)) * 100)),
          mine: r.my_booking_id ? (byId.get(r.my_booking_id) ?? null) : null,
          waitlist: waitlistOpen ? { position: r.my_waitlist ?? 0, waiting: r.waiting ?? 0 } : null,
        };
      }),
      canDay: !anyMine && live.length === slots.length && live.every(free) && (member || status.full > 0),
      dayIds: live.map((r) => r.slot_id),
      allMine: slots.length > 0 && slots.every((r) => r.my_booking_id && byId.has(r.my_booking_id)),
      anyMine,
    };
  });

  const banned = status.banned_until && Date.parse(status.banned_until) > now ? longDay(status.banned_until) : null;

  return (
    <div className="book page-bleed">
      <Booker
        days={days}
        mine={mine}
        banned={banned}
        account={{
          member,
          handle: profile.username ? `@${profile.username}` : profile.full_name.split(/\s+/)[0],
          year: academicYear(now),
          singles: status.single,
          fulls: status.full,
          gear,
          clubBows,
          noshow: { warn: info.noshow_warn_after, ban: info.noshow_ban_after, days: info.ban_days },
          prices: { single: info.single_price, full: info.fullday_price },
        }}
      />
    </div>
  );
}
