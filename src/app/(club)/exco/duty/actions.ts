"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { emailNoShow, siteFrom } from "@/lib/email";
import { messageFor, type ActionResult } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

// The rules (who signs up, the 3-day window, the no-show rule) live in the database.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (code: string): ActionResult => ({ ok: false, message: messageFor({ message: code }) });

async function client() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await client();
  if (!supabase) return bad("NOT_SIGNED_IN");
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setMyDuty(day: string, on: boolean) {
  if (!DATE.test(day)) return bad("NOT_TRAINING_DAY");
  return call("set_my_duty", { p_day: day, p_on: on });
}

export async function setDuty(day: string, userId: string, on: boolean) {
  if (!DATE.test(day) || !UUID.test(userId)) return bad("NOT_TRAINING_DAY");
  return call("set_duty", { p_day: day, p_user: userId, p_on: on });
}

// A no-show that brings a warning or a ban also emails the archer, after the response.
export async function markAttendance(bookingId: string, status: "present" | "no_show" | "booked"): Promise<ActionResult> {
  if (!UUID.test(bookingId) || !["present", "no_show", "booked"].includes(status)) return bad("BOOKING_NOT_FOUND");
  const supabase = await client();
  if (!supabase) return bad("NOT_SIGNED_IN");
  const { data, error } = await supabase.rpc("mark_attendance", { p_booking: bookingId, p_status: status });
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  const outcome = data as Parameters<typeof emailNoShow>[0] | null;
  if (outcome && (outcome.warned || outcome.banned_until)) {
    const site = siteFrom(await headers());
    after(() => emailNoShow(outcome, site));
  }
  return { ok: true };
}

export async function liftBan(userId: string) {
  if (!UUID.test(userId)) return bad("STUDENT_NOT_FOUND");
  return call("lift_ban", { p_user: userId });
}

export async function addWalkin(slotId: string, studentId: string, name: string) {
  if (!UUID.test(slotId)) return bad("SLOT_NOT_FOUND");
  const id = studentId.trim();
  if (id && !/^\d{8}$/.test(id)) return bad("STUDENT_NOT_FOUND");
  return call("add_walkin", { p_slot: slotId, p_student_id: id || null, p_name: name.slice(0, 80) });
}

export async function removeWalkin(id: string) {
  if (!UUID.test(id)) return bad("BOOKING_NOT_FOUND");
  return call("remove_walkin", { p_id: id });
}
