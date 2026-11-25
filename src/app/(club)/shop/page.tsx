import { ShopSign } from "@/components/shop-sign";
import { clockLabel, shortDay } from "@/lib/format";
import { signedUrls } from "@/lib/receipts";
import { getSession } from "@/lib/session";
import { productSlugs, rm, sectionTone, type Catalog } from "@/lib/shop";
import { CartPill } from "./cart";
import { ShopFloor, type FloorSection } from "./floor";
import { CancelOrder } from "./orders";
import { PassesSection } from "./passes";
import "./shop.css";

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

// The Shop (handoff 5.12): SHOP sign with the item count and the cart on one line; Passes first for
// guests (members never see them); then every collection with its sticky band; the archer's orders;
// and a calm end-of-merch rule.
export default async function ShopPage() {
  const { supabase, profile } = await getSession();
  const [{ data }, { data: orders }, { data: cfg }] = await Promise.all([
    supabase.rpc("shop_catalog"),
    supabase.from("shop_orders").select("id, number, total_sen, method, status, reason, collected_at, created_at, shop_order_items(name, option_label, qty)")
      .order("created_at", { ascending: false }).limit(10).returns<Order[]>(),
    supabase.from("settings").select("*").single<{ payment_qr_path?: string | null }>(),
  ]);
  const catalog = data as Catalog | null;
  const visible = (catalog?.sections ?? []).filter((s) => s.visible).sort((a, b) => a.sort - b.sort);
  const hasPasses = !catalog?.member && (visible.some((s) => s.kind === "passes") || !catalog);
  const qrPath = cfg?.payment_qr_path ?? null;
  const links = await signedUrls([qrPath]);
  const qrUrl = qrPath ? (links[qrPath] ?? null) : null;

  const slugs = productSlugs(visible);
  const sections: FloorSection[] = visible.filter((s) => s.kind === "products").map((s, i) => {
    const items = s.products.filter((p) => p.visible).sort((a, b) => a.sort - b.sort).map((p) => ({ ...p, slug: slugs.get(p.id)! }));
    const preorder = items.some((p) => p.mode === "preorder" && p.open);
    const tone = sectionTone(s);
    return {
      id: s.id, name: s.name, cls: tone.cls, glow: tone.glow, items,
      tag: `COLLECTION ${String(i + 1).padStart(2, "0")}${preorder ? " · PRE-ORDERS OPEN" : ""} · ${items.length} ITEM${items.length === 1 ? "" : "S"}`,
    };
  });
  const count = sections.reduce((n, s) => n + s.items.length, 0) + (hasPasses ? 2 : 0);

  return (
    <div className="shop page-bleed">
      <div className="shop-head wrap-v2 gutter">
        <ShopSign as="h1" title="Shop" tag="MERCH · PICK-UP AT TRAINING" className="sign--page" />
        <span className="shop-head__count" aria-label={`${count} items`}>({count})</span>
        <CartPill studentId={profile.student_id} qrUrl={qrUrl} watch=".shop-head" />
      </div>

      {hasPasses && <PassesSection />}
      <ShopFloor sections={sections} member={Boolean(catalog?.member)} />

      {(orders ?? []).length > 0 && (
        <section className="wrap-v2 gutter shop-orders" aria-labelledby="orders-title">
          <h2 className="orders-title" id="orders-title">Your orders</h2>
          <ul role="list">
            {(orders ?? []).map((o) => {
              const st = STATUS[o.status === "paid" && o.collected_at ? "collected" : o.status];
              return (
                <li key={o.id} className="order-row">
                  <div className="row">
                    <span className="strong">Order #{o.number} · {rm(o.total_sen)}</span>
                    <span className="tag"><span className="dot" style={{ background: st.color }} />{st.label}</span>
                  </div>
                  <div className="small muted">
                    {o.shop_order_items.map((i) => `${i.qty}× ${i.name} (${i.option_label})`).join(", ")} · {shortDay(o.created_at)}, {clockLabel(o.created_at)}
                  </div>
                  {o.status === "rejected" && o.reason && <p className="small" style={{ margin: 0 }}>Reason: {o.reason}</p>}
                  {o.status === "paid" && !o.collected_at && catalog?.pickup_link && (
                    <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href={catalog.pickup_link} target="_blank" rel="noreferrer">Join the pick-up group</a>
                  )}
                  {o.status === "pending" && <CancelOrder orderId={o.id} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="merch-end" role="separator" aria-label="End of merch">
        <span className="merch-end__rule" aria-hidden="true" />
        <span className="merch-end__text" aria-hidden="true">[ END OF MERCH · SEE YOU ON THE LINE ]<b>█</b></span>
        <span className="merch-end__rule" aria-hidden="true" />
      </div>
    </div>
  );
}
