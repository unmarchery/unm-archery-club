"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePublicProfile, type ProfileState } from "./actions";

export function PublicProfileForm({ username, bio, instagram }: { username: string; bio: string; instagram: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(savePublicProfile, {});
  return (
    <form action={action} className="card">
      <div className="row"><h2 className="h2">Public profile</h2>{username && <Link href={`/u/${username}`} className="link-btn">View it</Link>}</div>
      <label className="field"><span className="field-label">Username</span><input className="input" name="username" defaultValue={username} maxLength={20} pattern="[A-Za-z0-9._]{3,20}" required autoComplete="nickname" /><span className="muted small">Shown on the leaderboard. 3–20 letters, numbers, dots or underscores.</span></label>
      <label className="field"><span className="field-label">Bio (optional)</span><textarea className="input" name="bio" defaultValue={bio} maxLength={160} /></label>
      <label className="field"><span className="field-label">Instagram username (optional)</span><input className="input" name="instagram" defaultValue={instagram} maxLength={31} autoCapitalize="none" spellCheck={false} placeholder="@yourname" /><span className="muted small">Members see it as a link on your profile.</span></label>
      {state.message && <p className={state.ok ? "ok" : "error"} role="status">{state.message}</p>}
      <button className="btn btn-sm" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>{pending ? "Saving…" : "Save public profile"}</button>
    </form>
  );
}
