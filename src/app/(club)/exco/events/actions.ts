"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/messages";
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
  const { error } = await supabase.rpc("save_event", {
    p: {
      id: String(fd.get("id") ?? ""),
      title,
      starts_on: starts,
      ends_on: ends,
      time_label: String(fd.get("time_label") ?? ""),
      details: String(fd.get("details") ?? ""),
      audience: fd.get("audience") === "members" ? "members" : "all",
      featured: fd.get("featured") === "on",
    },
  });
  if (error) return { message: messageFor(error) };
  revalidatePath("/");
  revalidatePath("/exco/events");
  return { ok: true, message: "Event saved. It shows on the landing page." };
}

export async function deleteEvent(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("delete_event", { p_id: String(fd.get("id") ?? "") });
  revalidatePath("/");
  revalidatePath("/exco/events");
}
