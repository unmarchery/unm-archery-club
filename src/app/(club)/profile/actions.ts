"use server";

import { revalidatePath } from "next/cache";
import { BOW_TYPES } from "@/lib/gear";
import { messageFor } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; message?: string };

// Phone number and the equipment the booking form starts with.
export async function saveProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { message: messageFor({ message: "NOT_SIGNED_IN" }) };

  const phone = String(fd.get("phone") ?? "").trim();
  if (phone && !/^\+?[0-9 -]{8,16}$/.test(phone)) return { message: "Enter a valid phone number." };
  const hand = fd.get("hand") === "LH" ? "LH" : "RH";
  const ownBow = fd.get("own_bow") === "on";
  // With their own bow the club weight field isn't shown; "" keeps the saved one.
  const draw = ownBow ? "" : String(fd.get("draw_lbs") ?? "Not sure");
  if (!ownBow && draw !== "Not sure" && !/^\d{1,2}$/.test(draw)) return { message: "Choose a draw weight." };
  const type = String(fd.get("own_bow_type") ?? "");
  const lbsRaw = String(fd.get("own_bow_lbs") ?? "").trim();
  const lbs = lbsRaw ? Math.round(Number(lbsRaw)) : null;
  if (ownBow && (!BOW_TYPES.includes(type) || (lbs != null && (!Number.isFinite(lbs) || lbs < 5 || lbs > 80)))) {
    return { message: "Check your own bow's type and draw weight (5–80 lbs)." };
  }

  const [phoneRes, gearRes] = await Promise.all([
    supabase.from("profiles").update({ phone: phone || null }).eq("id", uid),
    supabase.rpc("save_my_gear", { p_hand: hand, p_draw_lbs: draw, p_own_bow: ownBow, p_own_bow_type: ownBow ? type : null, p_own_bow_lbs: ownBow ? lbs : null }),
  ]);
  if (phoneRes.error || gearRes.error) return { message: messageFor(phoneRes.error ?? gearRes.error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

// Username, bio and Instagram: what other archers see on your public profile.
export async function savePublicProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const bio = String(fd.get("bio") ?? "").trim();
  const ig = String(fd.get("instagram") ?? "").trim().replace(/^@/, "");
  if (!/^[a-z0-9._]{3,20}$/.test(username)) return { message: messageFor({ message: "INVALID_USERNAME" }) };
  if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) return { message: messageFor({ message: "INVALID_INSTAGRAM" }) };
  if (bio.length > 160) return { message: messageFor({ message: "BIO_TOO_LONG" }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_my_profile", { p_username: username, p_bio: bio, p_instagram: ig });
  if (error) return { message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Others see this on your profile." };
}
