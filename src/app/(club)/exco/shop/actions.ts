"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { emailOrderDecision, siteFrom } from "@/lib/email";
import { messageFor, type ActionResult } from "@/lib/messages";
import { uploadFile, uploadProblem } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/server";

// Every rule is checked again in the database (manage_shop, not your own order, stock).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (code: string): ActionResult => ({ ok: false, message: messageFor({ message: code }) });

async function client() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await client();
  if (!supabase) return bad("NOT_SIGNED_IN");
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function decideOrder(orderId: string, approve: boolean, reason: string): Promise<ActionResult> {
  if (!UUID.test(orderId)) return bad("ORDER_NOT_FOUND");
  const supabase = await client();
  if (!supabase) return bad("NOT_SIGNED_IN");
  const { data, error } = await supabase.rpc("decide_order", { p_order: orderId, p_approve: approve, p_reason: reason.slice(0, 300) });
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  const site = siteFrom(await headers());
  if (data) after(() => emailOrderDecision(data as Parameters<typeof emailOrderDecision>[0], site));
  return { ok: true };
}

export async function markCollected(orderId: string, collected: boolean) {
  if (!UUID.test(orderId)) return bad("ORDER_NOT_FOUND");
  return call("mark_collected", { p_order: orderId, p_collected: collected });
}

export async function saveSection(id: string | null, name: string, sort: number, visible: boolean) {
  if (id && !UUID.test(id)) return bad("ITEM_NOT_FOUND");
  return call("save_section", { p_id: id, p_name: name.slice(0, 40), p_sort: Math.round(sort) || 0, p_visible: visible });
}

export async function saveShopLink(link: string) {
  return call("save_shop_link", { p_link: link.slice(0, 200) });
}

// An item with its photos. New photos are uploaded only after the permission check.
export async function saveProduct(fd: FormData): Promise<ActionResult> {
  const supabase = await client();
  if (!supabase) return bad("NOT_SIGNED_IN");
  const { data: allowed } = await supabase.rpc("has_perm", { p_permission: "manage_shop" });
  if (!allowed) return bad("NOT_ALLOWED");

  let item: Record<string, unknown>;
  try {
    item = JSON.parse(String(fd.get("item") ?? "{}"));
  } catch {
    return bad("INVALID_ITEM");
  }
  const kept = Array.isArray(item.images) ? (item.images as unknown[]).filter((p): p is string => typeof p === "string" && p.startsWith("p/")) : [];
  const uploads = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 8);
  for (const f of uploads) {
    const problem = uploadProblem(f, false);
    if (problem) return { ok: false, message: problem };
  }
  const added: string[] = [];
  for (const f of uploads) {
    const path = await uploadFile("p", f, "shop");
    if (!path) return { ok: false, message: "A photo couldn't be uploaded. Please try again." };
    added.push(path);
  }
  let sizeChart = typeof item.size_chart === "string" && item.size_chart.startsWith("p/") ? item.size_chart : null;
  const chart = fd.get("size_chart");
  if (chart instanceof File && chart.size > 0) {
    const problem = uploadProblem(chart, false);
    if (problem) return { ok: false, message: problem };
    sizeChart = await uploadFile("p", chart, "shop");
  }

  return call("save_product", { p: { ...item, images: [...kept, ...added], size_chart: sizeChart } });
}
