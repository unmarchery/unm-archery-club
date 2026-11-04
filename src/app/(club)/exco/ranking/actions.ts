"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export type RankState = { ok?: boolean; message?: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const done = (message: string): RankState => { revalidatePath("/ranking"); revalidatePath("/exco/ranking"); return { ok: true, message }; };

export async function saveMatch(_: RankState, fd: FormData): Promise<RankState> {
  const title = String(fd.get("title") ?? "").trim(), held = String(fd.get("held_on") ?? "");
  if (!title || !DATE.test(held)) return { message: "Give the match a title and a date." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_match", { p: { title, held_on: held, time_label: String(fd.get("time_label") ?? ""), format: String(fd.get("format") ?? ""), capacity: Number(fd.get("capacity") || 36) } });
  return error ? { message: messageFor(error) } : done("Match added. Members can register now.");
}

// One archer per line: "20231111 537". Saving marks the match done and updates the leaderboards.
export async function saveScores(_: RankState, fd: FormData): Promise<RankState> {
  const match = String(fd.get("match") ?? "");
  const lines = String(fd.get("scores") ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const scores = [];
  for (const l of lines) {
    const m = l.match(/^(\d{8})\D+(\d{1,4})$/);
    if (!m) return { message: `Check this line: "${l}". Use student ID, then score.` };
    scores.push({ student_id: m[1], score: Number(m[2]) });
  }
  if (!scores.length) return { message: "Add at least one score." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_scores", { p_match: match, p_scores: scores });
  return error ? { message: messageFor(error) } : done(`${data} scores saved. The match moves to history.`);
}

export async function setTier(_: RankState, fd: FormData): Promise<RankState> {
  const sid = String(fd.get("student_id") ?? "").trim(), tier = String(fd.get("tier") ?? "");
  if (!/^\d{8}$/.test(sid)) return { message: "Enter an 8-digit student ID." };
  const supabase = await createClient();
  const { data: name, error } = await supabase.rpc("set_tier", { p_student_id: sid, p_tier: tier });
  return error ? { message: messageFor(error) } : done(`${name} is now ${tier}. Their scores so far stay in their old tier's history.`);
}

export async function saveAutoTier(_: RankState, fd: FormData): Promise<RankState> {
  const n = (k: string) => Number(fd.get(k));
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_auto_tier", { p_on: fd.get("on") === "on", p_intermediate: n("intermediate"), p_pro: n("pro"), p_matches: n("matches") });
  return error ? { message: messageFor(error) } : done(fd.get("on") === "on" ? "Automatic tier-up is on." : "Saved. Automatic tier-up is off; tiers are set by hand.");
}
