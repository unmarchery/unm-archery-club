"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageFor, type ActionResult } from "@/lib/messages";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

export async function requestMemberCheck(note: string): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };

  const { error } = await supabase.rpc("request_member_check", { p_note: note.slice(0, 300) });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

// Exco: approve or reject a member check. The database checks the manage_members permission.
export async function decideMemberRequest(requestId: string, approve: boolean, reason: string): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(requestId)) return { ok: false, message: messageFor({ message: "REQUEST_NOT_FOUND" }) };

  const { error } = await supabase.rpc("decide_member_request", {
    p_request: requestId,
    p_approve: approve,
    p_reason: reason.slice(0, 300),
  });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}
