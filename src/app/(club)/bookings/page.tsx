import Link from "next/link";
import { CalendarIcon } from "@/components/icons";
import { googleCalendarUrl } from "@/lib/calendar";
import { clockLabel, longDay, requestTime, shortDay, shortTimeRange } from "@/lib/format";
import { getSession } from "@/lib/session";
import { CancelButton } from "../sessions/booking";
import { LeaveWaitlist } from "./leave";

type Booking = {
  id: string;
  status: "booked" | "cancelled" | "present" | "no_show";
  pass_kind: "member" | "single" | "full";
  walk_in: boolean;
  slots: { starts_at: string; ends_at: string; cancelled_reason: string | null };
};
type Waiting = { slot_id: string; slots: { starts_at: string; ends_at: string } };
type Ledger = { id: number; kind: "single" | "full"; delta: number; reason: string; note: string | null; created_at: string };

const REASON: Record<string, string> = {
  topup: "Top-up", booking: "Booked", refund: "Cancelled in time", session_cancelled: "Session cancelled", adjust: "Added by exco",
};
const STATUS: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "var(--gold)" },
  no_show: { label: "No-show", color: "var(--red)" },
  booked: { label: "Not marked", color: "var(--muted)" },
};

// Your upcoming and past sessions, your waitlist places and your pass history.
export default async function MyBookingsPage() {
  const { supabase, status } = await getSession();
  const [{ data: bookings }, { data: waiting }, { data: ledger }, { data: cfg }] = await Promise.all([
    supabase.from("bookings").select("id, status, pass_kind, walk_in, slots!inner(starts_at, ends_at, cancelled_reason)")
      .neq("status", "cancelled").returns<Booking[]>(),
    supabase.from("waitlist").select("slot_id, slots!inner(starts_at, ends_at)").returns<Waiting[]>(),
    supabase.from("pass_ledger").select("id, kind, delta, reason, note, created_at").order("created_at", { ascending: false }).limit(30).returns<Ledger[]>(),
    supabase.from("settings").select("nonmember_refund_hours").single(),
  ]);
  const now = requestTime();
  const all = [...(bookings ?? [])].sort((a, b) => Date.parse(a.slots.starts_at) - Date.parse(b.slots.starts_at));
  const upcoming = all.filter((b) => Date.parse(b.slots.ends_at) > now);
  const past = all.filter((b) => Date.parse(b.slots.ends_at) <= now).reverse().slice(0, 20);
  const refundMs = (cfg?.nonmember_refund_hours ?? 2) * 3_600_000;

  const note = (b: Booking) =>
    b.pass_kind === "member"
      ? "Cancel this booking?"
      : b.pass_kind === "single"
        ? now <= Date.parse(b.slots.starts_at) - refundMs ? "Cancel? You'll get your single pass back." : "It's less than 2 hours to go, so the pass won't come back. Cancel anyway?"
        : "A full-day pass comes back only when you cancel the whole day in time.";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">My bookings</h1>
          <p className="sub">Your sessions, waitlist places{status.membership === "member" ? "" : " and passes"}.</p>
        </div>
        <Link href="/sessions" className="btn btn-sm">Book a session</Link>
      </div>

      <div className="grid">
        <section className="card">
          <div className="eyebrow">Upcoming</div>
          {upcoming.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing booked.</p>}
          {upcoming.map((b) => (
            <div key={b.id} className="field" style={{ gap: 6, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <div className="strong">{longDay(b.slots.starts_at)}, {shortTimeRange(b.slots.starts_at, b.slots.ends_at)}</div>
              <div className="small muted">{b.pass_kind === "member" ? "Member" : b.pass_kind === "full" ? "Full-day pass" : "Single pass"}</div>
              <a className="link-btn" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }} href={googleCalendarUrl(b.slots.starts_at, b.slots.ends_at)} target="_blank" rel="noreferrer">
                <CalendarIcon className="inline-icon" />Add to Google Calendar
              </a>
              {b.status === "booked" && Date.parse(b.slots.starts_at) > now && <CancelButton bookingId={b.id} fullDay={b.pass_kind === "full"} note={note(b)} />}
            </div>
          ))}
        </section>

        <div className="field" style={{ gap: 16 }}>
          {(waiting ?? []).length > 0 && (
            <section className="card">
              <div className="eyebrow">On the waitlist</div>
              {(waiting ?? []).map((w) => (
                <div key={w.slot_id} className="row" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <span className="small">{shortDay(w.slots.starts_at)}, {shortTimeRange(w.slots.starts_at, w.slots.ends_at)}</span>
                  <LeaveWaitlist slotId={w.slot_id} />
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <div className="eyebrow">Past sessions</div>
            {past.length === 0 && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
            {past.map((b) => (
              <div key={b.id} className="row" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                <span className="small">{shortDay(b.slots.starts_at)}, {shortTimeRange(b.slots.starts_at, b.slots.ends_at)}{b.walk_in ? " · walk-in" : ""}</span>
                <span className="tag"><span className="dot" style={{ background: STATUS[b.status]?.color }} />{STATUS[b.status]?.label}</span>
              </div>
            ))}
          </section>

          {(ledger ?? []).length > 0 && (
            <section className="card">
              <div className="eyebrow">Pass history</div>
              {(ledger ?? []).map((l) => (
                <div key={l.id} className="row" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <span className="small">{REASON[l.reason] ?? l.reason}{l.note ? ` · ${l.note}` : ""}<span className="muted"> · {shortDay(l.created_at)} {clockLabel(l.created_at)}</span></span>
                  <span className="strong" style={{ fontSize: 14, color: l.delta > 0 ? "var(--gold-text)" : "var(--ink)" }}>
                    {l.delta > 0 ? "+" : ""}{l.delta} {l.kind === "full" ? "full day" : "single"}
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
