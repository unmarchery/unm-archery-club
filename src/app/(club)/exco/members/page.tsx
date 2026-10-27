import { notFound } from "next/navigation";
import { clockLabel, longDay } from "@/lib/format";
import { can, getSession } from "@/lib/session";
import { RequestActions } from "./request-actions";

type Request = {
  request_id: string;
  created_at: string;
  note: string | null;
  student_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  on_form: boolean;
  form_name: string | null;
  form_email: string | null;
};

export default async function MemberRequestsPage() {
  const { supabase, status } = await getSession();
  if (!can(status, "manage_members")) notFound();

  const { data } = await supabase.rpc("member_requests_for_review");
  const requests = (data ?? []) as Request[];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Member requests</h1>
          <p className="sub">Students who show as non-members and asked to be checked. Compare with the membership form before approving.</p>
        </div>
        <span className="tag"><span className="dot" style={{ background: "var(--amber)" }} />{requests.length} waiting</span>
      </div>

      {requests.length === 0 && (
        <div className="card"><p className="muted small" style={{ margin: 0 }}>No requests waiting.</p></div>
      )}

      <div className="grid">
        {requests.map((r) => (
          <section className="card" key={r.request_id}>
            <div>
              <div className="h2">{r.full_name}</div>
              <div className="muted small">
                {r.student_id} · {r.email}
                {r.phone ? ` · ${r.phone}` : ""}
              </div>
            </div>
            <div className="tags">
              {r.on_form ? (
                <span className="pill gold">On the form{r.form_email ? ` as ${r.form_email}` : ""}</span>
              ) : (
                <span className="pill warn">Not on the membership form</span>
              )}
            </div>
            {r.on_form && r.form_name && r.form_name !== r.full_name && (
              <p className="small muted" style={{ margin: 0 }}>Name on the form: {r.form_name}</p>
            )}
            {r.note && <p className="small" style={{ margin: 0 }}>&ldquo;{r.note}&rdquo;</p>}
            <p className="small muted" style={{ margin: 0 }}>Asked {longDay(r.created_at)}, {clockLabel(r.created_at)}</p>
            <RequestActions requestId={r.request_id} name={r.full_name.split(/\s+/)[0] || r.full_name} />
          </section>
        ))}
      </div>
    </>
  );
}
