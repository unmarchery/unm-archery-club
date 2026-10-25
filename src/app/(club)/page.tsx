import Link from "next/link";
import { ArrowIcon, InfoIcon, TargetRings } from "@/components/icons";
import { clockLabel, longDay, requestTime, timeRange } from "@/lib/format";
import { gearTags, type Gear } from "@/lib/gear";
import { getSession } from "@/lib/session";

type Upcoming = {
  id: string;
  pass_kind: "member" | "single" | "full";
  full_day_group: string | null;
  equipment: Partial<Gear>;
  slots: { starts_at: string; ends_at: string };
};

export default async function HomePage() {
  const { supabase, profile, status } = await getSession();
  const [{ data: upcoming }, { data: cfg }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, pass_kind, full_day_group, equipment, slots!inner(starts_at, ends_at)")
      .eq("status", "booked")
      .gt("slots.starts_at", new Date().toISOString())
      .returns<Upcoming[]>(),
    supabase.from("settings").select("noshow_ban_after, nonmember_refund_hours").single(),
  ]);

  const sorted = [...(upcoming ?? [])].sort((a, b) => Date.parse(a.slots.starts_at) - Date.parse(b.slots.starts_at));
  const next = sorted[0];
  const refundMs = (cfg?.nonmember_refund_hours ?? 2) * 3_600_000;
  const firstName = profile.full_name.split(/\s+/)[0] || profile.full_name;

  let nextView: { day: string; time: string; note: string } | null = null;
  if (next) {
    const start = next.slots.starts_at;
    const cancelBy = clockLabel(new Date(Date.parse(start) - refundMs).toISOString());
    if (next.full_day_group) {
      const group = sorted.filter((b) => b.full_day_group === next.full_day_group);
      nextView = {
        day: longDay(start),
        time: `${timeRange(start, group[group.length - 1].slots.ends_at)}, full day`,
        note: `Free cancellation for the whole day until ${cancelBy}.`,
      };
    } else {
      nextView = {
        day: longDay(start),
        time: timeRange(start, next.slots.ends_at),
        note: next.pass_kind === "member" ? `You can cancel any time before ${clockLabel(start)}.` : `Free cancellation until ${cancelBy}.`,
      };
    }
  }
  const tags = gearTags(next && Object.keys(next.equipment ?? {}).length ? next.equipment : profile);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1 className="h1">Hi, {firstName}</h1>
        </div>
        <Link href="/sessions" className="btn btn-sm">
          <ArrowIcon />Book a session
        </Link>
      </div>

      {status.banned_until && Date.parse(status.banned_until) > requestTime() && (
        <div className="card notice">
          <InfoIcon />
          <p className="small" style={{ margin: 0 }}>
            You&apos;re paused from booking until {longDay(status.banned_until)} because of {status.noshows} no-shows.
          </p>
        </div>
      )}

      <div className="grid">
        {status.membership === "member" ? (
          <section className="card pass-card" aria-label="Your membership">
            <TargetRings className="rings" />
            <div className="eyebrow">Membership</div>
            <div className="big" style={{ fontSize: 40 }}>Member</div>
            <div className="tags">
              <span className="pill gold">Unlimited sessions</span>
              <span className="pill">No-shows {status.noshows} of {cfg?.noshow_ban_after ?? 3}</span>
            </div>
          </section>
        ) : (
          <section className="card pass-card" aria-label="Your passes">
            <TargetRings className="rings" />
            <div className="eyebrow">Your passes</div>
            <div className="pass-row">
              <div><div className="big">{status.single}</div><div className="pass-label">Single</div></div>
              <div><div className="big">{status.full}</div><div className="pass-label">Full day</div></div>
            </div>
            {status.membership === "pending" ? (
              <p className="small muted" style={{ margin: 0 }}>
                Your student ID is on the member list but the email didn&apos;t match. The exco will confirm it soon; until then you book as a non-member.
              </p>
            ) : (
              <span className="pill" style={{ alignSelf: "flex-start" }}>Top-up page coming soon</span>
            )}
          </section>
        )}

        {nextView ? (
          <section className="card">
            <div className="row">
              <div className="eyebrow">Next session</div>
              <span className="tag"><span className="dot" style={{ background: "var(--gold)" }} />Booked</span>
            </div>
            <div>
              <div className="when">{nextView.day}</div>
              <div className="when-time">{nextView.time}</div>
            </div>
            <div className="tags">
              {tags.map((t) => (
                <span key={t.label} className={`pill${t.tone ? ` ${t.tone}` : ""}`}>{t.label}</span>
              ))}
            </div>
            <div className="muted small">{nextView.note}</div>
          </section>
        ) : (
          <section className="card">
            <div className="eyebrow">Next session</div>
            <p className="muted small" style={{ margin: 0 }}>Nothing booked yet.</p>
            <Link href="/sessions" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>See sessions</Link>
          </section>
        )}
      </div>
    </>
  );
}
