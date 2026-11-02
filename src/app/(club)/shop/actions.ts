"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { emailShopManagers, siteFrom } from "@/lib/email";
import { messageFor, type ActionResult } from "@/lib/messages";
import { removeFile, uploadFile, uploadProblem } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderResult = { ok: true; number: number; total_sen: number } | { ok: false; message: string };

// Checkout: a QR payment uploads the receipt first; the database checks stock and prices.
export async function placeOrder(fd: FormData): Promise<OrderResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };

  let items: { option_id: string; qty: number }[];
  try {
    items = (JSON.parse(String(fd.get("items") ?? "[]")) as { option_id: string; qty: number }[])
      .filter((i) => UUID.test(i.option_id) && Number.isInteger(i.qty))
      .map((i) => ({ option_id: i.option_id, qty: i.qty }));
  } catch {
    return { ok: false, message: messageFor({ message: "CART_EMPTY" }) };
  }

  const method = fd.get("method") === "qr" ? "qr" : "cash";
  let receiptPath: string | null = null;
  if (method === "qr") {
    const file = fd.get("receipt");
    const problem = uploadProblem(file);
    if (problem) return { ok: false, message: problem };
    receiptPath = await uploadFile(uid, file as File);
    if (!receiptPath) return { ok: false, message: "The receipt couldn't be uploaded. Please try again." };
  }
  const bankRef = method === "qr" ? String(fd.get("bank_ref") ?? "").slice(0, 60) : null;

  const { data: created, error } = await supabase.rpc("place_order", {
    p_items: items,
    p_method: method,
    p_bank_ref: bankRef,
    p_receipt_path: receiptPath,
  });
  if (error) {
    if (receiptPath) await removeFile(receiptPath);
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath("/", "layout");
  const o = created as { number: number; total_sen: number; full_name: string; student_id: string };
  const site = siteFrom(await headers());
  after(() => emailShopManagers({ ...o, method, bankRef: bankRef?.replace(/\s/g, "").toUpperCase() ?? null }, uid, site));
  return { ok: true, number: o.number, total_sen: o.total_sen };
}

export async function cancelOrder(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  if (!UUID.test(orderId)) return { ok: false, message: messageFor({ message: "ORDER_NOT_FOUND" }) };
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId });
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
