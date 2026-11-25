"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/messages";
import { removeFile, uploadFile, uploadProblem } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/server";

export type EventState = { ok?: boolean; message?: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Saves one event. The database checks the Events switch and the limits again.
export async function saveEvent(_: EventState, fd: FormData): Promise<EventState> {
  const title = String(fd.get("title") ?? "").trim();
  const starts = String(fd.get("starts_on") ?? "");
  const ends = String(fd.get("ends_on") ?? "");
  if (!title) return { message: "Give the event a title." };
  if (!DATE.test(starts)) return { message: "Pick the day the event starts." };
  if (ends && (!DATE.test(ends) || ends < starts)) return { message: "The end day must be on or after the start day." };

  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  // The picture: a new upload replaces the old one, "remove" clears it, otherwise it stays as it is.
  // Pictures are public, so they go to the public "shop" bucket under e/. Uploads wait for the permission check.
  const photo = fd.get("photo");
  const remove = fd.get("remove_photo") === "on";
  let imagePath: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    const problem = uploadProblem(photo, false);
    if (problem) return { message: problem };
    const { data: allowed } = await supabase.rpc("has_perm", { p_permission: "manage_events" });
    if (!allowed) return { message: messageFor({ message: "NOT_ALLOWED" }) };
    const path = await uploadFile("e", photo, "shop");
    if (!path) return { message: "The picture couldn't be uploaded. Please try again." };
    imagePath = path;
  } else if (remove) {
    imagePath = "";
  }
  const old = imagePath !== undefined && id
    ? ((await supabase.from("events").select("image_path").eq("id", id).maybeSingle<{ image_path: string | null }>()).data?.image_path ?? null)
    : null;

  const { error } = await supabase.rpc("save_event", {
    p: {
      id,
      title,
      starts_on: starts,
      ends_on: ends,
      time_label: String(fd.get("time_label") ?? ""),
      details: String(fd.get("details") ?? ""),
      audience: fd.get("audience") === "members" ? "members" : "all",
      featured: fd.get("featured") === "on",
      ...(imagePath !== undefined && { image_path: imagePath }),
    },
  });
  if (error) {
    if (imagePath) await removeFile(imagePath, "shop");
    return { message: messageFor(error) };
  }
  if (old && old !== imagePath) await removeFile(old, "shop");
  revalidatePath("/");
  revalidatePath("/exco/events");
  return { ok: true, message: "Event saved. It shows on the landing page." };
}

export async function deleteEvent(fd: FormData) {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const { data } = await supabase.from("events").select("image_path").eq("id", id).maybeSingle<{ image_path: string | null }>();
  const { error } = await supabase.rpc("delete_event", { p_id: id });
  if (!error && data?.image_path) await removeFile(data.image_path, "shop");
  revalidatePath("/");
  revalidatePath("/exco/events");
}
