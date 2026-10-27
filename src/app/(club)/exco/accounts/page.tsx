import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { can, getSession } from "@/lib/session";
import { STARTER_RULE } from "@/lib/starter";
import { CopyText, CreateAccountsButton } from "./create-button";

type Member = { student_id: string; full_name: string | null; email: string | null };
type Overview = { total: number; with_account: number; ready: Member[]; blocked: Member[] };

export default async function AccountsPage() {
  const { supabase, status } = await getSession();
  if (!can(status, "manage_members")) notFound();

  const [{ data }, { data: settings }, h] = await Promise.all([
    supabase.rpc("member_account_overview"),
    supabase.from("settings").select("*").single(),
    headers(),
  ]);
  const o = (data ?? { total: 0, with_account: 0, ready: [], blocked: [] }) as Overview;
  const days = Number(settings?.starter_password_days ?? 14);
  const site = `https://${h.get("host") ?? "our website"}`;
  const message =
    `🏹 UNM Archery Club booking is live! Log in at ${site} with your student ID.\n` +
    `Your first password is ${STARTER_RULE}. Example: Alex Tan, 20512034 → alex20512034\n` +
    `You'll be asked to choose your own password straight away. Please log in within ${days} days; after that the first password stops working.`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Accounts</h1>
          <p className="sub">Create accounts for everyone on the member list, so they can log in without waiting for an email code.</p>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="eyebrow">Member list</div>
          <div className="tags">
            <span className="pill">{o.total} on the list</span>
            <span className="pill gold">{o.with_account} {o.with_account === 1 ? "has an account" : "have accounts"}</span>
            <span className="pill">{o.ready.length} ready to create</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Starter password: {STARTER_RULE}. They must change it at first login, and it stops working after {days} days.
          </p>
          <CreateAccountsButton count={o.ready.length} />
        </section>

        <section className="card">
          <div className="eyebrow">Message for the WhatsApp group</div>
          <p className="small" style={{ margin: 0, whiteSpace: "pre-line" }}>{message}</p>
          <CopyText text={message} />
        </section>
      </div>

      {o.blocked.length > 0 && (
        <section className="card">
          <div className="eyebrow">Can&apos;t get a starter account ({o.blocked.length})</div>
          <p className="small muted" style={{ margin: 0 }}>
            Their email on the form isn&apos;t a uni email. They can sign up normally with their uni email, or fix the form entry and sync again.
          </p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {o.blocked.map((m) => (
              <li key={m.student_id}>
                {m.full_name ?? "No name"}, {m.student_id}: {m.email || "no email"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
