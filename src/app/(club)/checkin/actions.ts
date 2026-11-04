"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export type CheckinState = { ok?: boolean; message?: string };

export async function checkIn(_: CheckinState, fd: FormData): Promise<CheckinState> {
  const day = String(fd.get("d") ?? ""), code = String(fd.get("k") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[0-9a-f]{12}$/.test(code)) return { message: messageFor({ message: "CHECKIN_INVALID" }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in", { p_day: day, p_code: code });
  if (error) return { message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "You're checked in. Enjoy the session!" };
}
