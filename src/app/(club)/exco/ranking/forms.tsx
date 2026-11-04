"use client";

import { useActionState } from "react";
import { saveAutoTier, saveMatch, saveScores, setTier, type RankState } from "./actions";

function Msg({ s }: { s: RankState }) {
  return s.message ? <p className={s.ok ? "ok" : "error"} role="status" style={{ margin: 0 }}>{s.message}</p> : null;
}

export function MatchForm() {
  const [s, action, pending] = useActionState<RankState, FormData>(saveMatch, {});
  return (
    <form action={action} className="card">
      <h2 className="h2">Add a rank match</h2>
      <div className="filters">
        <label className="field"><span className="field-label">Title</span><input className="input" name="title" maxLength={60} placeholder="Rank Match 4" required /></label>
        <label className="field"><span className="field-label">Date</span><input className="input" type="date" name="held_on" required /></label>
        <label className="field"><span className="field-label">Time (optional)</span><input className="input" name="time_label" maxLength={40} placeholder="2–5pm" /></label>
        <label className="field"><span className="field-label">Format (optional)</span><input className="input" name="format" maxLength={60} placeholder="18 m · 60 arrows" /></label>
        <label className="field"><span className="field-label">Places</span><input className="input" type="number" name="capacity" defaultValue={36} min={1} /></label>
      </div>
      <Msg s={s} />
      <button className="btn btn-sm" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Add match</button>
    </form>
  );
}

export function ScoresForm({ matches }: { matches: { id: string; label: string }[] }) {
  const [s, action, pending] = useActionState<RankState, FormData>(saveScores, {});
  if (!matches.length) return null;
  return (
    <form action={action} className="card">
      <h2 className="h2">Enter scores</h2>
      <p className="muted small" style={{ margin: 0 }}>One archer per line: student ID, then score. Each score counts in the archer&apos;s current tier. Saving moves the match to history.</p>
      <label className="field"><span className="field-label">Match</span><select className="input" name="match">{matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <label className="field"><span className="field-label">Scores</span><textarea className="input" name="scores" rows={6} placeholder={"20231111 537\n20230042 545"} required /></label>
      <Msg s={s} />
      <button className="btn btn-sm" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Save scores</button>
    </form>
  );
}

export function TierForm() {
  const [s, action, pending] = useActionState<RankState, FormData>(setTier, {});
  return (
    <form action={action} className="card">
      <h2 className="h2">Skill badges</h2>
      <p className="muted small" style={{ margin: 0 }}>Everyone starts as Beginner. Move an archer up here; the leaderboards follow, and their scores so far stay in their old tier&apos;s history.</p>
      <div className="filters">
        <label className="field"><span className="field-label">Student ID</span><input className="input" name="student_id" inputMode="numeric" pattern="\d{8}" maxLength={8} required /></label>
        <label className="field"><span className="field-label">Tier</span><select className="input" name="tier" defaultValue="intermediate"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="pro">Pro</option></select></label>
      </div>
      <Msg s={s} />
      <button className="btn btn-sm" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Set tier</button>
    </form>
  );
}

export function AutoTierForm({ on, intermediate, pro, matches }: { on: boolean; intermediate: number; pro: number; matches: number }) {
  const [s, action, pending] = useActionState<RankState, FormData>(saveAutoTier, {});
  return (
    <form action={action} className="card">
      <h2 className="h2">Automatic tier-up</h2>
      <p className="muted small" style={{ margin: 0 }}>Off for now: the exco sets tiers by hand. The targets are saved for when you want archers to move up by themselves.</p>
      <label className="check"><input type="checkbox" name="on" defaultChecked={on} /> Turn on automatic tier-up</label>
      <div className="filters">
        <label className="field"><span className="field-label">Intermediate at an average of</span><input className="input" type="number" name="intermediate" defaultValue={intermediate} min={0} max={1000} /></label>
        <label className="field"><span className="field-label">Pro at an average of</span><input className="input" type="number" name="pro" defaultValue={pro} min={0} max={1000} /></label>
        <label className="field"><span className="field-label">Over the last … rank matches</span><input className="input" type="number" name="matches" defaultValue={matches} min={1} max={10} /></label>
      </div>
      <Msg s={s} />
      <button className="btn btn-sm" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Save</button>
    </form>
  );
}
