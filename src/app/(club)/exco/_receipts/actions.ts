"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageFor, type ActionResult } from "@/lib/messages";
import { removeFile } from "@/lib/receipts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

// The President, VP or Treasurer asks to delete one receipt. The database checks the position.
export async function requestReceiptDeletion(topupId: string, reason: string): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(topupId)) return { ok: false, message: messageFor({ message: "RECEIPT_NOT_FOUND" }) };

  const { error } = await supabase.rpc("request_receipt_deletion", { p_topup: topupId, p_reason: reason.slice(0, 300) });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

// Agreeing (when the pair is the Treasurer plus the President or VP) deletes the file too.
export async function decideReceiptDeletion(requestId: string, agree: boolean): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(requestId)) return { ok: false, message: messageFor({ message: "REQUEST_NOT_FOUND" }) };

  const { data: path, error } = await supabase.rpc("decide_receipt_deletion", { p_request: requestId, p_agree: agree });
  if (error) return { ok: false, message: messageFor(error) };
  if (typeof path === "string" && path) await removeFile(path);

  revalidatePath("/", "layout");
  return { ok: true };
}
