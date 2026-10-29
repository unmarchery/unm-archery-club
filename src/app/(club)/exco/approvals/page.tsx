import { notFound } from "next/navigation";
import { clockLabel, passesLabel, shortDay } from "@/lib/format";
import { signedUrls } from "@/lib/receipts";
import { can, getSession, OFFICERS } from "@/lib/session";
import { AskToDelete, DeletionRequests, type DeletionRequest } from "../_receipts/controls";
import { PaymentSettingsForm, TopupActions } from "./decide";

type Pending = {
  id: string;
  number: number;
  created_at: string;
  student_id: string;
  full_name: string;
  single_qty: number;
  full_qty: number;
  amount: number;
  method: "qr" | "cash";
  bank_ref: string | null;
  receipt_path: string | null;
  mine: boolean;
};

type Decided = {
  id: string;
  number: number;
  decided_at: string;
  status: "approved" | "rejected";
  reason: string | null;
  amount: number;
  method: "qr" | "cash";
  single_qty: number;
  full_qty: number;
  student_id: string;
  full_name: string;
  decided_by: string | null;
  receipt_path: string | null;
  receipt_deleted: boolean;
  delete_requested: boolean;
};

type Queue = { pending: Pending[]; recent: Decided[] };

export default async function ApprovalsPage() {
  const { supabase, status } = await getSession();
  if (!can(status, "approve_topups")) notFound();

  const officer = status.position && OFFICERS.includes(status.position) ? status.position : null;
  const [{ data }, { data: cfg }, { data: open }] = await Promise.all([
    supabase.rpc("topups_for_review"),
    supabase.from("settings").select("*").single<{ payment_qr_path?: string | null; payment_whatsapp_link?: string | null }>(),
    officer ? supabase.rpc("receipt_deletions_open") : Promise.resolve({ data: [] }),
  ]);
  const queue = (data ?? { pending: [], recent: [] }) as Queue;
  const links = await signedUrls([
    ...queue.pending.map((t) => t.receipt_path),
    ...queue.recent.map((t) => t.receipt_path),
    cfg?.payment_qr_path,
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Approvals</h1>
          <p className="sub">Check each payment in the club bank app, or that the cash is in hand, before approving. Passes are added straight away.</p>
        </div>
        <span className="tag"><span className="dot" style={{ background: "var(--amber)" }} />{queue.pending.length} waiting</span>
      </div>

      {officer && <DeletionRequests requests={(open ?? []) as DeletionRequest[]} position={officer} />}

      {queue.pending.length === 0 && (
        <div className="card"><p className="muted small" style={{ margin: 0 }}>No top-ups waiting.</p></div>
      )}

      <div className="grid">
        {queue.pending.map((t) => {
          const receipt = t.receipt_path ? links[t.receipt_path] : undefined;
          return (
            <section className="card" key={t.id}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="h2">{t.full_name}</div>
                  <div className="muted small">{t.student_id} · Top-up #{t.number}</div>
                </div>
                <div className="amount">RM{t.amount}</div>
              </div>
              <div className="tags">
                <span className="pill gold">{passesLabel(t.single_qty, t.full_qty)}</span>
                <span className={`pill${t.method === "cash" ? " warn" : ""}`}>{t.method === "qr" ? "DuitNow QR" : "Cash"}</span>
              </div>
              {t.method === "qr" && (
                <>
                  <p className="small" style={{ margin: 0 }}>
                    Bank reference <strong>{t.bank_ref}</strong>. The remark should show {t.student_id}.
                  </p>
                  {receipt && t.receipt_path?.endsWith(".pdf") && (
                    <a href={receipt} target="_blank" rel="noreferrer" className="small">Open the receipt (PDF)</a>
                  )}
                  {receipt && !t.receipt_path?.endsWith(".pdf") && (
                    <a href={receipt} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="receipt" src={receipt} alt={`Receipt for top-up #${t.number}`} />
                    </a>
                  )}
                  {!receipt && <p className="small muted" style={{ margin: 0 }}>The receipt couldn&apos;t be loaded. Refresh the page to try again.</p>}
                </>
              )}
              {t.method === "cash" && <p className="small" style={{ margin: 0 }}>Approve once the treasurer has the RM{t.amount} in cash.</p>}
              <p className="small muted" style={{ margin: 0 }}>Sent {shortDay(t.created_at)}, {clockLabel(t.created_at)}</p>
              {t.mine ? (
                <p className="small muted" style={{ margin: 0 }}>This is your own top-up, so another approver needs to check it.</p>
              ) : (
                <TopupActions topupId={t.id} name={t.full_name.split(/\s+/)[0] || t.full_name} />
              )}
            </section>
          );
        })}
      </div>

      <div className="grid">
        <section className="card">
          <div className="eyebrow">Decided in the last 30 days</div>
          {queue.recent.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing yet.</p>}
          {queue.recent.map((t) => (
            <div key={t.id} className="field" style={{ gap: 2, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <div className="row">
                <span className="strong">#{t.number} {t.full_name} · RM{t.amount}</span>
                <span className="tag">
                  <span className="dot" style={{ background: t.status === "approved" ? "var(--gold)" : "var(--red)" }} />
                  {t.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </div>
              <div className="small muted">
                {passesLabel(t.single_qty, t.full_qty)} · {t.method === "qr" ? "QR" : "Cash"} · by {t.decided_by ?? "someone"}, {shortDay(t.decided_at)} {clockLabel(t.decided_at)}
              </div>
              {t.status === "rejected" && t.reason && <div className="small">Reason: {t.reason}</div>}
              {t.method === "qr" && (
                <div className="row small" style={{ justifyContent: "flex-start", flexWrap: "wrap", marginTop: 4 }}>
                  {t.receipt_deleted ? (
                    <span className="muted">Receipt deleted</span>
                  ) : (
                    <>
                      {t.receipt_path && links[t.receipt_path] && (
                        <a href={links[t.receipt_path]} target="_blank" rel="noreferrer">View receipt</a>
                      )}
                      {officer && !t.delete_requested && <AskToDelete topupId={t.id} number={t.number} position={officer} />}
                      {t.delete_requested && <span className="muted">Delete asked</span>}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        <PaymentSettingsForm
          qrUrl={cfg?.payment_qr_path ? (links[cfg.payment_qr_path] ?? null) : null}
          whatsappLink={cfg?.payment_whatsapp_link ?? ""}
        />
      </div>
    </>
  );
}
