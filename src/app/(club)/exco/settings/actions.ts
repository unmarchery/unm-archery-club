"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { ok?: boolean; message?: string };

const NUMBERS = [
  "single_price", "fullday_price", "slot_minutes", "capacity", "nonmember_cap_pct", "booking_open_dow",
  "nonmember_refund_hours", "member_cancel_minutes", "noshow_warn_after", "noshow_ban_after", "ban_days",
  "starter_password_days", "duty_min_people", "attendance_days",
];
const TIMES = ["day_start", "day_end", "booking_open_time"];
const DATES = ["membership_valid_until", "noshow_count_from"];

const weights = (text: string) =>
  [...new Set(text.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 5 && n <= 80))].sort((a, b) => a - b);

// Turns the Settings form into one update; the database checks the permission and limits.
export async function saveSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { message: messageFor({ message: "NOT_SIGNED_IN" }) };

  const p: Record<string, unknown> = {};
  for (const k of NUMBERS) {
    const n = Number(fd.get(k));
    if (!Number.isInteger(n)) return { message: messageFor({ message: "INVALID_SETTING" }) };
    p[k] = n;
  }
  for (const k of TIMES) {
    const t = String(fd.get(k) ?? "");
    if (!/^\d{2}:\d{2}$/.test(t)) return { message: messageFor({ message: "INVALID_SETTING" }) };
    p[k] = t;
  }
  for (const k of DATES) {
    const d = String(fd.get(k) ?? "");
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { message: messageFor({ message: "INVALID_SETTING" }) };
    p[k] = d;
  }
  const days = fd.getAll("session_days").map(Number).filter((n) => n >= 1 && n <= 7);
  if (days.length === 0) return { message: "Pick at least one training day." };
  p.session_days = days;
  p.club_bows = { RH: weights(String(fd.get("bows_rh") ?? "")), LH: weights(String(fd.get("bows_lh") ?? "")) };

  const { error } = await supabase.rpc("update_settings", { p });
  if (error) return { message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Every change is in the log on the People page." };
}
