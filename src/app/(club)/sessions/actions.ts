"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageFor } from "@/lib/messages";
import { BOW_TYPES, type Gear } from "@/lib/gear";

export type ActionResult = { ok: true; refunded?: boolean } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanGear(g: Gear): Gear | null {
  if (g.hand !== "RH" && g.hand !== "LH") return null;
  if (g.draw_lbs !== "Not sure" && !/^\d{1,2}$/.test(g.draw_lbs)) return null;
  if (!g.own_bow) return { hand: g.hand, draw_lbs: g.draw_lbs, own_bow: false, own_bow_type: null, own_bow_lbs: null };
  if (!g.own_bow_type || !BOW_TYPES.includes(g.own_bow_type)) return null;
  const lbs = g.own_bow_lbs == null ? null : Math.round(Number(g.own_bow_lbs));
  if (lbs != null && (!Number.isFinite(lbs) || lbs < 5 || lbs > 80)) return null;
  return { hand: g.hand, draw_lbs: g.draw_lbs, own_bow: true, own_bow_type: g.own_bow_type, own_bow_lbs: lbs };
}

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

export async function bookSlot(input: { slotId: string; pass: "single" | "full" | null; gear: Gear }): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(input.slotId)) return { ok: false, message: messageFor({ message: "SLOT_NOT_FOUND" }) };
  const gear = cleanGear(input.gear);
  if (!gear) return { ok: false, message: "Please check your equipment choices." };

  await supabase.rpc("save_my_gear", {
    p_hand: gear.hand,
    p_draw_lbs: gear.draw_lbs,
    p_own_bow: gear.own_bow,
    p_own_bow_type: gear.own_bow_type,
    p_own_bow_lbs: gear.own_bow_lbs,
  });
  const { error } = await supabase.rpc("book_slot", { p_slot: input.slotId, p_pass: input.pass, p_equipment: gear });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cancelBooking(bookingId: string, wholeDay: boolean): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(bookingId)) return { ok: false, message: messageFor({ message: "BOOKING_NOT_FOUND" }) };

  const { data, error } = await supabase.rpc("cancel_booking", { p_booking: bookingId, p_whole_day: wholeDay });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true, refunded: Boolean((data as { refunded?: boolean } | null)?.refunded) };
}
