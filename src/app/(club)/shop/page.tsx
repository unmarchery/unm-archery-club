import Link from "next/link";
import { clockLabel, shortDay } from "@/lib/format";
import { signedUrls } from "@/lib/receipts";
import { getSession } from "@/lib/session";
import { rm, type Catalog } from "@/lib/shop";
import { PassesSection } from "./passes";
import { CancelOrder, Storefront } from "./storefront";

type Order = {
  id: string;
  number: number;
  total_sen: number;
  method: "qr" | "cash";
  status: "pending" | "paid" | "rejected" | "cancelled";
  reason: string | null;
  collected_at: string | null;
  created_at: string;
  shop_order_items: { name: string; option_label: string; qty: number }[];
};

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Waiting for payment check", color: "var(--amber)" },
  paid: { label: "Paid, ready to collect", color: "var(--gold)" },
  collected: { label: "Collected", color: "var(--muted)" },
  rejected: { label: "Not approved", color: "var(--red)" },
  cancelled: { label: "Cancelled", color: "var(--muted)" },
};

// The Shop: one tab per section. Passes is the top-up form; the rest sell items.
export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const { supabase, profile } = await getSession();
  const q = await searchParams;
  const [{ data }, { data: orders }, { data: cfg }] = await Promise.all([
    supabase.rpc("shop_catalog"),
    supabase.from("shop_orders").select("id, number, total_sen, method, status, reason, collected_at, created_at, shop_order_items(name, option_label, qty)")
      .order("created_at", { ascending: false }).limit(10).returns<Order[]>(),
    supabase.from("settings").select("*").single<{ payment_qr_path?: string | null }>(),
  ]);
  const catalog = data as Catalog | null;
  // Members train free, so passes are hidden for them. Guests see passes first.
  const sections = (catalog?.sections ?? [])
    .filter((s) => s.visible && !(catalog?.member && s.kind === "passes"))
    .sort((a, b) => (a.kind === "passes" ? -1 : 0) - (b.kind === "passes" ? -1 : 0));
  // Before the shop is set up, the Passes form still works on its own.
  if (!catalog || sections.length === 0) {
    return (
      <>
        <div className="page-head"><div><h1 className="h1">Shop</h1></div></div>
        <PassesSection />
      </>
    );
  }
  const current = sections.find((s) => s.id === q.s) ?? sections[0];
  const qrPath = cfg?.payment_qr_path ?? null;
  const links = current.kind === "products" ? await signedUrls([qrPath]) : {};

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Shop</h1>
          <p className="sub">{catalog.member ? "Club merch and more. You're a member, so sessions are free and passes are hidden." : "Session passes first, then club merch. Pay by DuitNow QR or in cash at the range."}</p>
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Shop sections">
        {sections.map((s) => (
          <Link key={s.id} href={`/shop?s=${s.id}`} role="tab" aria-selected={s.id === current.id} className={`chip${s.id === current.id ? " on" : ""}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            {s.name}
          </Link>
        ))}
      </div>

      {current.kind === "passes" ? (
        <PassesSection />
      ) : (
        <Storefront
          section={current}
          member={catalog.member}
          studentId={profile.student_id}
          qrUrl={qrPath ? (links[qrPath] ?? null) : null}
        />
      )}

      {current.kind === "products" && (orders ?? []).length > 0 && (
        <section className="card">
          <div className="eyebrow">Your orders</div>
          {(orders ?? []).map((o) => {
            const st = STATUS[o.status === "paid" && o.collected_at ? "collected" : o.status];
            return (
              <div key={o.id} className="field" style={{ gap: 4, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <div className="row">
                  <span className="strong">Order #{o.number} · {rm(o.total_sen)}</span>
                  <span className="tag"><span className="dot" style={{ background: st.color }} />{st.label}</span>
                </div>
                <div className="small muted">
                  {o.shop_order_items.map((i) => `${i.qty}× ${i.name} (${i.option_label})`).join(", ")} · {shortDay(o.created_at)}, {clockLabel(o.created_at)}
                </div>
                {o.status === "rejected" && o.reason && <p className="small" style={{ margin: 0 }}>Reason: {o.reason}</p>}
                {o.status === "paid" && !o.collected_at && catalog.pickup_link && (
                  <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href={catalog.pickup_link} target="_blank" rel="noreferrer">Join the pick-up group</a>
                )}
                {o.status === "pending" && <CancelOrder orderId={o.id} />}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
