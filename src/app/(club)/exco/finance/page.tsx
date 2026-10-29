import Link from "next/link";
import { notFound } from "next/navigation";
import { clockLabel, dayKey, passesLabel, requestTime, shortDay } from "@/lib/format";
import { signedUrls } from "@/lib/receipts";
import { can, getSession, OFFICERS } from "@/lib/session";
import { AskToDelete, DeletionRequests, type DeletionRequest } from "../_receipts/controls";

type FinanceRow = {
  id: string;
  number: number;
  created_at: string;
  decided_at: string;
  student_id: string;
  full_name: string;
  single_qty: number;
  full_qty: number;
  amount: number;
  method: "qr" | "cash";
  bank_ref: string | null;
  approved_by: string | null;
  receipt_path: string | null;
  receipt_deleted: boolean;
  delete_requested: boolean;
};

type Report = {
  rows: FinanceRow[];
  count: number;
  total: number;
  qr_total: number;
  cash_total: number;
  unused_single: number;
  unused_full: number;
  unused_value: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Quick ranges in Malaysian calendar days: this month, last month, this year.
function ranges(today: string) {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  return [
    { label: "This month", from: `${y}-${pad(m)}-01`, to: today },
    { label: "Last month", from: `${prevY}-${pad(prevM)}-01`, to: `${prevY}-${pad(prevM)}-${pad(prevEnd)}` },
    { label: "This year", from: `${y}-01-01`, to: today },
  ];
}

export default async function FinancePage({ searchParams }: PageProps<"/exco/finance">) {
  const { supabase, status } = await getSession();
  if (!can(status, "export_finance") && !can(status, "approve_topups")) notFound();

  const today = dayKey(new Date(requestTime()).toISOString());
  const quick = ranges(today);
  const q = await searchParams;
  const from = typeof q.from === "string" && DATE.test(q.from) ? q.from : quick[0].from;
  const to = typeof q.to === "string" && DATE.test(q.to) && q.to >= from ? q.to : today;

  const officer = status.position && OFFICERS.includes(status.position) ? status.position : null;
  const [{ data }, { data: open }] = await Promise.all([
    supabase.rpc("finance_report", { p_from: from, p_to: to }),
    officer ? supabase.rpc("receipt_deletions_open") : Promise.resolve({ data: [] }),
  ]);
  const r = (data ?? { rows: [], count: 0, total: 0, qr_total: 0, cash_total: 0, unused_single: 0, unused_full: 0, unused_value: 0 }) as Report;
  const links = await signedUrls(r.rows.map((x) => x.receipt_path));
  const canExport = can(status, "export_finance");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Finance</h1>
          <p className="sub">Money from approved top-ups, and the passes the club still owes.</p>
        </div>
        {canExport && (
          <a className="btn btn-sm" href={`/exco/finance/export?from=${from}&to=${to}`} download>
            Download for Excel
          </a>
        )}
      </div>

      {officer && <DeletionRequests requests={(open ?? []) as DeletionRequest[]} position={officer} />}

      <section className="card">
        <div className="chips">
          {quick.map((x) => (
            <Link key={x.label} href={`/exco/finance?from=${x.from}&to=${x.to}`} className={`chip${x.from === from && x.to === to ? " on" : ""}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              {x.label}
            </Link>
          ))}
        </div>
        <form className="filters" method="get">
          <label className="field">
            <span className="field-label">From</span>
            <input className="input" type="date" name="from" defaultValue={from} max={today} />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input className="input" type="date" name="to" defaultValue={to} max={today} />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm">Show</button>
        </form>
      </section>

      <div className="stats">
        <section className="card">
          <div className="eyebrow">Received</div>
          <div className="stat-value">RM{r.total}</div>
          <div className="small muted">{r.count} top-up{r.count === 1 ? "" : "s"}, {shortDay(`${from}T12:00:00+08:00`)} to {shortDay(`${to}T12:00:00+08:00`)}</div>
        </section>
        <section className="card">
          <div className="eyebrow">DuitNow QR</div>
          <div className="stat-value">RM{r.qr_total}</div>
          <div className="small muted">Should match the club bank account</div>
        </section>
        <section className="card">
          <div className="eyebrow">Cash</div>
          <div className="stat-value">RM{r.cash_total}</div>
          <div className="small muted">Should match the cash box</div>
        </section>
        <section className="card">
          <div className="eyebrow">Passes not used yet</div>
          <div className="stat-value">RM{r.unused_value}</div>
          <div className="small muted">{r.unused_single} single + {r.unused_full} full day, at today&apos;s prices</div>
        </section>
      </div>

      <section className="card">
        <div className="eyebrow">Approved top-ups</div>
        {r.rows.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>No approved top-ups in these dates.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Approved</th>
                  <th>#</th>
                  <th>Archer</th>
                  <th>Passes</th>
                  <th className="num">Amount</th>
                  <th>Method</th>
                  <th>Bank ref</th>
                  <th>Approved by</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.number}>
                    <td>{shortDay(x.decided_at)}, {clockLabel(x.decided_at)}</td>
                    <td>{x.number}</td>
                    <td>{x.full_name}<div className="muted">{x.student_id}</div></td>
                    <td className="soft">{passesLabel(x.single_qty, x.full_qty)}</td>
                    <td className="num strong">RM{x.amount}</td>
                    <td>{x.method === "qr" ? "QR" : "Cash"}</td>
                    <td>{x.bank_ref ?? "–"}</td>
                    <td className="soft">{x.approved_by ?? "–"}</td>
                    <td>
                      {x.method === "cash" ? (
                        "–"
                      ) : x.receipt_deleted ? (
                        <span className="muted">Deleted</span>
                      ) : (
                        <div className="row" style={{ justifyContent: "flex-start" }}>
                          {x.receipt_path && links[x.receipt_path] && (
                            <a href={links[x.receipt_path]} target="_blank" rel="noreferrer">View</a>
                          )}
                          {officer && !x.delete_requested && <AskToDelete topupId={x.id} number={x.number} position={officer} />}
                          {x.delete_requested && <span className="muted">Delete asked</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
