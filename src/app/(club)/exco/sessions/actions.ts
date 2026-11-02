"use server";

import { revalidatePath } from "next/cache";
import { flushSoon } from "@/lib/flush";
import { messageFor, type ActionResult } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

// Who may cancel or close is checked in the database; everyone affected is emailed.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  await flushSoon();
  return { ok: true };
}

export async function cancelSessions(slotId: string, restOfDay: boolean, reason: string) {
  if (!UUID.test(slotId)) return { ok: false, message: messageFor({ message: "SLOT_NOT_FOUND" }) } as ActionResult;
  return call("cancel_sessions", { p_slot: slotId, p_rest_of_day: restOfDay, p_reason: reason.slice(0, 120) });
}

export async function closeDate(day: string, reason: string) {
  if (!DATE.test(day)) return { ok: false, message: messageFor({ message: "NOT_TRAINING_DAY" }) } as ActionResult;
  return call("close_date", { p_day: day, p_reason: reason.slice(0, 120) });
}

export async function reopenDate(day: string) {
  if (!DATE.test(day)) return { ok: false, message: messageFor({ message: "NOT_TRAINING_DAY" }) } as ActionResult;
  return call("reopen_date", { p_day: day });
}
