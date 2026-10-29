import Link from "next/link";
import { clockLabel, passesLabel, shortDay } from "@/lib/format";
import { signedUrls } from "@/lib/receipts";
import { getSession } from "@/lib/session";
import { CancelTopup, TopupForm } from "./form";

type Topup = {
  id: string;
  number: number;
  single_qty: number;
  full_qty: number;
  amount: number;
  method: "qr" | "cash";
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  created_at: string;
  decided_at: string | null;
};

type PaymentSettings = {
  single_price: number;
  fullday_price: number;
  payment_qr_path?: string | null;
  payment_whatsapp_link?: string | null;
};

const STATUS: Record<Topup["status"], { label: string; color: string }> = {
  pending: { label: "Waiting for the treasurer", color: "var(--amber)" },
  approved: { label: "Passes added", color: "var(--gold)" },
  rejected: { label: "Not approved", color: "var(--red)" },
  cancelled: { label: "Cancelled", color: "var(--muted)" },
};

export default async function TopUpPage() {
  const { supabase, profile, status } = await getSession();

  if (status.membership === "member") {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="h1">Top up</h1>
            <p className="sub">Passes are for non-members.</p>
          </div>
        </div>
        <div className="card">
          <p className="small" style={{ margin: 0 }}>You&apos;re a member, so every session is free. There&apos;s nothing to buy.</p>
          <Link href="/sessions" className="btn btn-sm" style={{ alignSelf: "flex-start" }}>Book a session</Link>
        </div>
      </>
    );
  }

  const [{ data: cfg }, { data: history }] = await Promise.all([
    // "*" so the page still loads on a database that hasn't added the payment columns yet.
    supabase.from("settings").select("*").single<PaymentSettings>(),
    supabase.from("topups").select("*").order("created_at", { ascending: false }).limit(10).returns<Topup[]>(),
  ]);
  const qrPath = cfg?.payment_qr_path ?? null;
  const links = await signedUrls([qrPath]);
  const topups = history ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Top up</h1>
          <p className="sub">Buy passes for sessions. The treasurer adds them once they&apos;ve checked your payment.</p>
        </div>
      </div>

      <div className="grid">
        <TopupForm
          studentId={profile.student_id}
          singlePrice={cfg?.single_price ?? 5}
          fullPrice={cfg?.fullday_price ?? 12}
          qrUrl={qrPath ? (links[qrPath] ?? null) : null}
          whatsappLink={cfg?.payment_whatsapp_link ?? null}
        />

        <div className="field" style={{ gap: 16 }}>
          <section className="card" aria-label="Your passes">
            <div className="eyebrow">Your passes</div>
            <div className="pass-row">
              <div><div className="big">{status.single}</div><div className="pass-label">Single</div></div>
              <div><div className="big">{status.full}</div><div className="pass-label">Full day</div></div>
            </div>
          </section>

          <section className="card">
            <div className="eyebrow">Your top-ups</div>
            {topups.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing yet.</p>}
            {topups.map((t) => (
              <div key={t.id} className="field" style={{ gap: 4, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <div className="row">
                  <span className="strong">RM{t.amount} · {passesLabel(t.single_qty, t.full_qty)}</span>
                  <span className="tag"><span className="dot" style={{ background: STATUS[t.status].color }} />{STATUS[t.status].label}</span>
                </div>
                <div className="small muted">
                  #{t.number} · {t.method === "qr" ? "DuitNow QR" : "Cash"} · {shortDay(t.created_at)}, {clockLabel(t.created_at)}
                </div>
                {t.status === "rejected" && t.reason && <p className="small" style={{ margin: 0 }}>Reason: {t.reason}</p>}
                {t.status === "pending" && <CancelTopup topupId={t.id} />}
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
