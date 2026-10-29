"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageFor, type ActionResult } from "@/lib/messages";
import { removeFile, uploadFile, uploadProblem } from "@/lib/receipts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

// Approve or reject a top-up. The database checks approve_topups and credits the passes.
export async function decideTopup(topupId: string, approve: boolean, reason: string): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(topupId)) return { ok: false, message: messageFor({ message: "TOPUP_NOT_FOUND" }) };

  const { error } = await supabase.rpc("decide_topup", { p_topup: topupId, p_approve: approve, p_reason: reason.slice(0, 300) });
  if (error) return { ok: false, message: messageFor(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

// The club QR picture (optional; keeps the current one when no file is sent) and the
// finance WhatsApp link. Permission is checked before anything is uploaded.
export async function savePaymentSettings(fd: FormData): Promise<ActionResult> {
  const supabase = await signedInClient();
  if (!supabase) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };

  const [{ data: approver }, { data: editor }, { data: cfg }] = await Promise.all([
    supabase.rpc("has_perm", { p_permission: "approve_topups" }),
    supabase.rpc("has_perm", { p_permission: "edit_settings" }),
    supabase.from("settings").select("*").single<{ payment_qr_path?: string | null }>(),
  ]);
  if (!approver && !editor) return { ok: false, message: messageFor({ message: "NOT_ALLOWED" }) };

  const file = fd.get("qr");
  let qrPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const problem = uploadProblem(file, false);
    if (problem) return { ok: false, message: problem };
    qrPath = await uploadFile("club", file);
    if (!qrPath) return { ok: false, message: "The picture couldn't be uploaded. Please try again." };
  }

  const { error } = await supabase.rpc("save_payment_settings", {
    p_qr_path: qrPath,
    p_whatsapp_link: String(fd.get("whatsapp") ?? "").slice(0, 200),
  });
  if (error) {
    if (qrPath) await removeFile(qrPath);
    return { ok: false, message: messageFor(error) };
  }
  if (qrPath && cfg?.payment_qr_path) await removeFile(cfg.payment_qr_path);

  revalidatePath("/", "layout");
  return { ok: true };
}
