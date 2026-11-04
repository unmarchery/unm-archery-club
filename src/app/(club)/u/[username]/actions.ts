"use server";

import { revalidatePath } from "next/cache";
import { messageFor, type ActionResult } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMOJI = ["clap", "fire", "target", "strong", "star"];

// Tap an emoji to react to someone's profile; tap again to take it back. Members only.
export async function toggleReaction(target: string, emoji: string, username: string): Promise<ActionResult & { on?: boolean }> {
  if (!UUID.test(target) || !EMOJI.includes(emoji)) return { ok: false, message: messageFor({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_reaction", { p_target: target, p_emoji: emoji });
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath(`/u/${username}`);
  return { ok: true, on: Boolean(data) };
}
