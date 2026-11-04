"use client";

import { useActionState } from "react";
import { saveEvent, type EventState } from "./actions";

export type ClubEvent = {
  id: string; title: string; starts_on: string; ends_on: string | null; time_label: string | null;
  details: string | null; audience: "all" | "members"; featured: boolean;
};

export function EventForm({ event }: { event?: ClubEvent }) {
  const [state, action, pending] = useActionState<EventState, FormData>(saveEvent, {});
  const key = event?.id ?? "new";
  return (
    <form action={action} className={event ? "field" : "card"} style={{ gap: 14 }}>
      {!event && <h2 className="h2">Add an event</h2>}
      <input type="hidden" name="id" value={event?.id ?? ""} />
      <label className="field"><span className="field-label">Title</span><input className="input" name="title" defaultValue={event?.title} maxLength={80} required /></label>
      <div className="filters">
        <label className="field"><span className="field-label">Starts</span><input className="input" type="date" name="starts_on" defaultValue={event?.starts_on} required /></label>
        <label className="field"><span className="field-label">Ends (optional)</span><input className="input" type="date" name="ends_on" defaultValue={event?.ends_on ?? ""} /></label>
        <label className="field"><span className="field-label">Time (optional)</span><input className="input" name="time_label" defaultValue={event?.time_label ?? ""} maxLength={60} placeholder="2–5pm, or Every session" /></label>
      </div>
      <label className="field"><span className="field-label">Details (optional)</span><textarea className="input" name="details" defaultValue={event?.details ?? ""} maxLength={300} /></label>
      <div className="filters" style={{ alignItems: "center" }}>
        <label className="field"><span className="field-label">Who can come</span>
          <select className="input" name="audience" defaultValue={event?.audience ?? "all"}><option value="all">Open to all</option><option value="members">Members only</option></select>
        </label>
        <label className="check" htmlFor={`featured-${key}`}><input id={`featured-${key}`} type="checkbox" name="featured" defaultChecked={event?.featured} /> Show as &quot;Happening now&quot;</label>
      </div>
      {state.message && <p className={state.ok ? "ok" : "error"} role="status">{state.message}</p>}
      <button className="btn btn-sm" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>{pending ? "Saving…" : event ? "Save changes" : "Add event"}</button>
    </form>
  );
}
