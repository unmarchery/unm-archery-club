import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Gear } from "./gear";

export type Profile = Gear & {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  banned_until: string | null;
};

export type Status = {
  membership: "member" | "pending" | "none";
  single: number;
  full: number;
  banned_until: string | null;
  noshows: number;
  is_exco: boolean;
};

// The signed-in archer, read once per request. Sends signed-out visitors to /login.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const [{ data: profile }, { data: status }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, student_id, full_name, email, phone, hand, draw_lbs, own_bow, own_bow_type, own_bow_lbs, banned_until")
      .eq("id", data.claims.sub)
      .maybeSingle<Profile>(),
    supabase.rpc("my_status").returns<Status>(),
  ]);
  if (!profile || !status) redirect("/login?e=no-profile");

  return { supabase, profile, status: status as Status };
});
