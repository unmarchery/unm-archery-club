"use server";

import { revalidatePath } from "next/cache";
import { messageFor, type ActionResult } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function registerMatch(match: string, on: boolean): Promise<ActionResult> {
  if (!UUID.test(match)) return { ok: false, message: messageFor({ message: "NOT_FOUND" }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_match", { p_match: match, p_on: on });
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/ranking");
  return { ok: true };
}
