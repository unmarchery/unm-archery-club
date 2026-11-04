import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { Reactions } from "./reactions";

type PublicProfile = {
  id: string; username: string; full_name: string; bio: string | null; instagram: string | null;
  tier: "beginner" | "intermediate" | "pro"; member: boolean; position: string | null; is_me: boolean;
  reactions: Record<string, number>; mine: string[];
};
const TIER = { beginner: "Beginner", intermediate: "Intermediate", pro: "Pro" };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

// Another archer's profile: who they are, their tier, Instagram, and reactions from members.
export default async function ProfileOfPage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const { supabase, status } = await getSession();
  const { data } = await supabase.rpc("public_profile", { p_username: username });
  const p = data as PublicProfile | null;
  if (!p) notFound();
  const viewerMember = status.membership === "member";

  return (
    <div className="profile-grid">
      <section className="card id-card" aria-label="Profile">
        <span className="avatar xl">{initials(p.full_name)}</span>
        <div>
          <h1 className="h1">{p.full_name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>@{p.username}</p>
        </div>
        <div className="tags">
          <span className={p.member ? "pill gold" : "pill"}>{p.member ? "Member" : "Guest"}</span>
          {p.member && <span className={`tier tier-${p.tier}`}>{TIER[p.tier]}</span>}
          {p.position && <span className="pill">{p.position}</span>}
        </div>
        {p.bio && <p style={{ margin: 0 }}>{p.bio}</p>}
        {p.instagram && (
          <a className="ig-link" href={`https://instagram.com/${encodeURIComponent(p.instagram)}`} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17 7h.01" /></svg>
            @{p.instagram}<span className="sr-only"> on Instagram (opens in a new tab)</span>
          </a>
        )}
        {p.is_me && <Link href="/profile" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>Edit my profile</Link>}
      </section>
      <section className="card" aria-labelledby="react-title">
        <h2 id="react-title" className="h2">{p.is_me ? "Reactions you've received" : "Reactions"}</h2>
        <Reactions target={p.id} username={p.username} counts={p.reactions} mine={p.mine} canReact={viewerMember && !p.is_me} />
        <p className="muted small" style={{ margin: 0 }}>
          {p.is_me ? "Members react to your profile to cheer you on." : viewerMember ? `Cheer ${p.full_name.split(/\s+/)[0]} on. Tap again to take a reaction back.` : "Members can react to each other's profiles. Join the club to cheer people on."}
        </p>
      </section>
    </div>
  );
}
