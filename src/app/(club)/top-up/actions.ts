"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageFor, type ActionResult } from "@/lib/messages";
import { removeFile, uploadFile, uploadProblem } from "@/lib/receipts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TopupResult = { ok: true; number: number; amount: number } | { ok: false; message: string };

function count(fd: FormData, name: string) {
  const n = Number(fd.get(name) ?? 0);
  return Number.isInteger(n) ? n : -1;
}

// A QR top-up uploads the receipt first, then records the request. If the database
// refuses it (say the bank reference was already used), the upload is removed again.
export async function submitTopup(fd: FormData): Promise<TopupResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };

  const method = fd.get("method") === "qr" ? "qr" : "cash";
  let receiptPath: string | null = null;
  if (method === "qr") {
    const file = fd.get("receipt");
    const problem = uploadProblem(file);
    if (problem) return { ok: false, message: problem };
    receiptPath = await uploadFile(uid, file as File);
    if (!receiptPath) return { ok: false, message: "The receipt couldn't be uploaded. Please try again." };
  }

  const { data: created, error } = await supabase.rpc("request_topup", {
    p_single: count(fd, "single"),
    p_full: count(fd, "full"),
    p_method: method,
    p_bank_ref: method === "qr" ? String(fd.get("bank_ref") ?? "").slice(0, 60) : null,
    p_receipt_path: receiptPath,
  });
  if (error) {
    if (receiptPath) await removeFile(receiptPath);
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath("/", "layout");
  const t = created as { number: number; amount: number };
  return { ok: true, number: t.number, amount: t.amount };
}

export async function cancelTopup(topupId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(topupId)) return { ok: false, message: messageFor({ message: "TOPUP_NOT_FOUND" }) };

  const { error } = await supabase.rpc("cancel_topup", { p_topup: topupId });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}
