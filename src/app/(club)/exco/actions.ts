"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageFor, type ActionResult } from "@/lib/messages";
import { SWITCHES } from "@/lib/people";

// Every rule (who may switch what, officer positions, owner lock) lives in the database
// functions; these only check the shape of the input and pass it on.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, message: messageFor({ message: "NOT_SIGNED_IN" }) };
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: messageFor(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

const bad = (code: string): ActionResult => ({ ok: false, message: messageFor({ message: code }) });

export async function saveMyCard(whatsapp: string, show: boolean) {
  return call("save_my_card", { p_whatsapp: whatsapp.slice(0, 30), p_show: show });
}

export async function setPermission(userId: string, permission: string, on: boolean, until: string) {
  if (!UUID.test(userId) || !SWITCHES.some((s) => s.key === permission)) return bad("NOT_ALLOWED");
  if (until && !DATE.test(until)) return bad("DATE_IN_PAST");
  return call("set_permission", { p_user: userId, p_permission: permission, p_on: on, p_until: until || null });
}

export async function setPosition(studentId: string, position: string, handles: string) {
  if (!/^\d{8}$/.test(studentId.trim())) return bad("STUDENT_NOT_FOUND");
  return call("set_position", { p_student_id: studentId.trim(), p_position: position, p_handles: handles.slice(0, 120) });
}

export async function removeFromExco(userId: string) {
  if (!UUID.test(userId)) return bad("STUDENT_NOT_FOUND");
  return call("remove_from_exco", { p_user: userId });
}

export async function addNote(about: string, body: string) {
  if (!UUID.test(about)) return bad("STUDENT_NOT_FOUND");
  return call("add_exco_note", { p_about: about, p_body: body.slice(0, 1000) });
}

export async function deleteNote(noteId: string) {
  if (!UUID.test(noteId)) return bad("NOT_ALLOWED");
  return call("delete_exco_note", { p_note: noteId });
}
