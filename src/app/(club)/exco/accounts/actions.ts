"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { messageFor } from "@/lib/messages";
import { starterPassword } from "@/lib/starter";

type Member = { student_id: string; full_name: string | null; email: string };
export type CreateResult =
  | { ok: true; created: number; remaining: number; failed: { student_id: string; reason: string }[] }
  | { ok: false; message: string };

// Stay under the hosting time limit per request; anything left is done on the next click.
const TIME_BUDGET_MS = 7000;
const PARALLEL = 6;

export async function createStarterAccounts(): Promise<CreateResult> {
  // The overview call checks manage_members as the signed-in user.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_account_overview");
  if (error) return { ok: false, message: messageFor(error) };
  const ready = ((data as { ready?: Member[] } | null)?.ready ?? []).filter((m) => /^\d{8}$/.test(m.student_id));

  const admin = createAdminClient();
  const started = Date.now();
  const failed: { student_id: string; reason: string }[] = [];
  let created = 0;
  let next = 0;

  async function worker() {
    while (next < ready.length && Date.now() - started < TIME_BUDGET_MS) {
      const m = ready[next++];
      const { error: err } = await admin.auth.admin.createUser({
        email: m.email.toLowerCase(),
        password: starterPassword(m.full_name, m.student_id),
        email_confirm: true,
        user_metadata: { student_id: m.student_id, full_name: m.full_name ?? "", must_change_password: true },
      });
      if (err) {
        failed.push({
          student_id: m.student_id,
          reason: /already|registered|exists/i.test(err.message) ? "this email already has an account" : "couldn't create the account",
        });
      } else {
        created++;
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  revalidatePath("/exco/accounts");
  return { ok: true, created, remaining: ready.length - next, failed };
}
