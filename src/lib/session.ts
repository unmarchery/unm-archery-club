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
  must_change_password?: boolean; // starter accounts; missing before migration 0003
};

export type Status = {
  membership: "member" | "pending" | "none";
  single: number;
  full: number;
  banned_until: string | null;
  noshows: number;
  is_exco: boolean;
  perms: string[];
  request: { status: "pending" | "approved" | "rejected"; reason: string | null } | null;
  pending_member_requests: number;
  pending_topups: number; // for approvers; missing before migration 0005
  position: string | null; // exco position, e.g. "Treasurer"; missing before migration 0005
};

// The three officers who together decide whether a receipt is deleted.
export const OFFICERS = ["President", "Vice President", "Treasurer"];

export function can(status: Status, permission: string) {
  return status.perms.includes("owner") || status.perms.includes(permission);
}

// The signed-in archer, read once per request. Sends signed-out visitors to /login.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const [{ data: profile }, { data: status }] = await Promise.all([
    supabase
      .from("profiles")
      // "*" so the page still loads on a database that hasn't added newer columns yet.
      .select("*")
      .eq("id", data.claims.sub)
      .maybeSingle<Profile>(),
    supabase.rpc("my_status").returns<Status>(),
  ]);
  if (!profile || !status) redirect("/login?e=no-profile");

  // Defaults keep pages working on a database that hasn't run the newer migrations yet.
  const s = status as Partial<Status>;
  return {
    supabase,
    profile,
    status: {
      ...s,
      perms: s.perms ?? [],
      request: s.request ?? null,
      pending_member_requests: s.pending_member_requests ?? 0,
      pending_topups: s.pending_topups ?? 0,
      position: s.position ?? null,
    } as Status,
  };
});
