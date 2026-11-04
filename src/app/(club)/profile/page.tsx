import Link from "next/link";
import type { ClubBows } from "@/lib/gear";
import { getSession } from "@/lib/session";
import { ProfileForm } from "./form";
import { PublicProfileForm } from "./public-form";

export default async function ProfilePage() {
  const { supabase, profile, status } = await getSession();
  const { data: cfg } = await supabase.from("settings").select("club_bows").single();
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Profile</h1>
          <p className="sub">Your public profile, your details, and the equipment the booking form starts with. <Link href="/me">Your passes and next session</Link> · <Link href="/bookings">My bookings</Link></p>
        </div>
      </div>
      <div className="grid">
        <section className="card">
          <div className="eyebrow">Account</div>
          <div><div className="strong">{profile.full_name}</div><div className="small muted">{profile.student_id} · {profile.email}</div></div>
          <div className="small">{status.position ?? (status.membership === "member" ? "Member" : "Non-member")}</div>
          <p className="small muted" style={{ margin: 0 }}>Name or student ID wrong? Ask the exco to fix it.</p>
          <Link href="/set-password" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>Change password</Link>
        </section>
        <PublicProfileForm username={profile.username ?? ""} bio={profile.bio ?? ""} instagram={profile.instagram ?? ""} />
        <ProfileForm
          phone={profile.phone ?? ""}
          gear={{ hand: profile.hand, draw_lbs: profile.draw_lbs, own_bow: profile.own_bow, own_bow_type: profile.own_bow_type, own_bow_lbs: profile.own_bow_lbs }}
          clubBows={(cfg?.club_bows ?? { RH: [], LH: [] }) as ClubBows}
        />
      </div>
    </>
  );
}
