import { LockIcon } from "@/components/icons";
import { clockLabel, dayKey, longDay, openingLabel, requestTime, shortDay, shortTimeRange, weekLabel } from "@/lib/format";
import type { ClubBows, Gear } from "@/lib/gear";
import { getSession } from "@/lib/session";
import { BookButton, CancelButton } from "./booking";

type Row = {
  slot_id: string;
  starts_at: string;
  ends_at: string;
  cancelled: boolean;
  cancelled_reason: string | null;
  capacity: number;
  nonmember_cap: number;
  booked: number;
  nonmember_booked: number;
  my_booking_id: string | null;
  my_pass_kind: "member" | "single" | "full" | null;
  my_group: string | null;
};

type State = "cancelled" | "booked" | "full" | "nmfull" | "almost" | "open";

const COLOR: Record<State, string> = {
  open: "var(--blue)",
  almost: "var(--amber)",
  full: "var(--red)",
  nmfull: "var(--red)",
  cancelled: "var(--red)",
  booked: "var(--gold)",
};

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default async function SessionsPage() {
  const { supabase, profile, status } = await getSession();
  await supabase.rpc("ensure_slots");

  const [{ data: windowData }, { data: cfg }] = await Promise.all([
    supabase.rpc("booking_window"),
    supabase.from("settings").select("nonmember_refund_hours, club_bows, day_start, day_end, slot_minutes").single(),
  ]);
  const win = (Array.isArray(windowData) ? windowData[0] : windowData) as { bookable_until: string; next_opens_at: string };
  const untilMs = Date.parse(win.bookable_until);
  const { data } = await supabase.rpc("slot_availability", {
    p_from: new Date().toISOString(),
    p_to: new Date(untilMs + 8 * 86_400_000).toISOString(),
  });
  const rows = (data ?? []) as Row[];

  const member = status.membership === "member";
  const now = requestTime();
  const refundMs = (cfg?.nonmember_refund_hours ?? 2) * 3_600_000;
  const slotsPerDay = cfg ? Math.floor((minutes(cfg.day_end) - minutes(cfg.day_start)) / cfg.slot_minutes) : 3;
  const gear: Gear = {
    hand: profile.hand,
    draw_lbs: profile.draw_lbs,
    own_bow: profile.own_bow,
    own_bow_type: profile.own_bow_type,
    own_bow_lbs: profile.own_bow_lbs,
  };
  const clubBows = (cfg?.club_bows ?? { RH: [], LH: [] }) as ClubBows;

  const stateOf = (r: Row): State => {
    const left = r.capacity - r.booked;
    if (r.cancelled) return "cancelled";
    if (r.my_booking_id) return "booked";
    if (left <= 0) return "full";
    if (!member && r.nonmember_booked >= r.nonmember_cap) return "nmfull";
    if (left <= 4) return "almost";
    return "open";
  };

  const open = rows.filter((r) => Date.parse(r.starts_at) < untilMs);
  const later = rows.filter((r) => Date.parse(r.starts_at) >= untilMs && !r.cancelled);

  const days = new Map<string, Row[]>();
  for (const r of open) days.set(dayKey(r.starts_at), [...(days.get(dayKey(r.starts_at)) ?? []), r]);

  const laterDays = [...new Set(later.map((r) => dayKey(r.starts_at)))].map(
    (k) => shortDay(later.find((r) => dayKey(r.starts_at) === k)!.starts_at),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Sessions</h1>
          <p className="sub">Tuesdays and Thursdays, 4–7pm. Up to 20 archers per slot.</p>
        </div>
        <div className="tags">
          <span className="tag"><span className="dot" style={{ background: COLOR.open }} />Open</span>
          <span className="tag"><span className="dot" style={{ background: COLOR.almost }} />Almost full</span>
          <span className="tag"><span className="dot" style={{ background: COLOR.full }} />Full</span>
        </div>
      </div>

      {status.banned_until && Date.parse(status.banned_until) > now && (
        <div className="card notice">
          <p className="small" style={{ margin: 0 }}>
            You&apos;re paused from booking until {longDay(status.banned_until)} because of no-shows.
          </p>
        </div>
      )}

      {days.size === 0 && <div className="card"><p className="muted small" style={{ margin: 0 }}>No sessions open for booking right now.</p></div>}

      {[...days.entries()].map(([key, slots]) => {
        const first = slots[0];
        const dayTitle = longDay(first.starts_at);
        const states = slots.map(stateOf);
        const blocker = slots.find((_, i) => states[i] !== "open" && states[i] !== "almost");
        const fullDay = (() => {
          if (member) return { ok: false, note: "" };
          if (status.full < 1) return { ok: false, note: "No full-day passes left" };
          if (slots.length < slotsPerDay) return { ok: false, note: "The first slot has already started" };
          if (blocker) {
            return {
              ok: false,
              note: blocker.my_booking_id
                ? `You already booked ${shortTimeRange(blocker.starts_at, blocker.ends_at)}`
                : `${shortTimeRange(blocker.starts_at, blocker.ends_at)} has no spot for you`,
            };
          }
          return { ok: true, note: `Uses 1 of your ${status.full} full-day passes` };
        })();
        const dayRange = shortTimeRange(first.starts_at, slots[slots.length - 1].ends_at);

        return (
          <section className="day" key={key}>
            <div className="day-head">
              <h2 className="h2">{dayTitle}</h2>
              <span className="muted small">{weekLabel(first.starts_at)}</span>
            </div>
            <div className="slots">
              {slots.map((r, i) => {
                const state = states[i];
                const left = r.capacity - r.booked;
                const time = shortTimeRange(r.starts_at, r.ends_at);
                const label = {
                  cancelled: `Cancelled${r.cancelled_reason ? `: ${r.cancelled_reason}` : ""}`,
                  booked: r.my_pass_kind === "full" ? "Booked, full day" : "Booked",
                  full: "Full",
                  nmfull: "No non-member spots",
                  almost: `${left} left`,
                  open: `${left} spots left`,
                }[state];

                let cancelNote = "";
                if (r.my_booking_id) {
                  const start = Date.parse(r.starts_at);
                  if (r.my_pass_kind === "member") cancelNote = "Cancel this booking? You can rebook if there's still space.";
                  else if (r.my_pass_kind === "single")
                    cancelNote = now <= start - refundMs
                      ? "Cancel this booking? You'll get your single pass back."
                      : "It's less than 2 hours to go, so the pass won't come back. Cancel anyway?";
                  else {
                    const groupStart = Math.min(...rows.filter((x) => x.my_group === r.my_group).map((x) => Date.parse(x.starts_at)));
                    cancelNote = now <= groupStart - refundMs
                      ? `Cancel the whole day before ${clockLabel(new Date(groupStart - refundMs).toISOString())} to get your full-day pass back. Cancelling one slot frees the spot but keeps the pass used.`
                      : "It's less than 2 hours to the first slot, so the full-day pass won't come back.";
                  }
                }

                return (
                  <div className="card" key={r.slot_id}>
                    <div className="row">
                      <div className="slot-time">{time}</div>
                      <span className="tag"><span className="dot" style={{ background: COLOR[state] }} />{label}</span>
                    </div>
                    <div className="bar">
                      <span style={{ width: `${Math.min(100, Math.round((r.booked / r.capacity) * 100))}%`, background: COLOR[state] }} />
                    </div>
                    <div className="muted small">
                      {r.booked} of {r.capacity} booked
                      {!member && `, non-member spots ${r.nonmember_booked} of ${r.nonmember_cap}`}
                    </div>
                    {(state === "open" || state === "almost") && (
                      <BookButton
                        slotId={r.slot_id}
                        title={`${dayTitle}, ${time}`}
                        fullDayTitle={`${dayTitle}, ${dayRange}`}
                        member={member}
                        singles={status.single}
                        fulls={status.full}
                        fullDay={fullDay}
                        gear={gear}
                        clubBows={clubBows}
                      />
                    )}
                    {state === "booked" && r.my_booking_id && (
                      <CancelButton bookingId={r.my_booking_id} fullDay={r.my_pass_kind === "full"} note={cancelNote} />
                    )}
                    {(state === "full" || state === "nmfull") && (
                      <button type="button" className="btn btn-ghost" disabled>Full</button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="card locked">
        <LockIcon />
        <div>
          <div className="slot-time" style={{ fontSize: 16 }}>
            {laterDays.length ? laterDays.join(" and ") : "Next week"}
          </div>
          <div className="muted small">Booking opens {openingLabel(win.next_opens_at)}</div>
        </div>
      </section>
    </>
  );
}
