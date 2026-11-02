import Link from "next/link";
import { notFound } from "next/navigation";
import { clockLabel, shortDay } from "@/lib/format";
import { signedUrls } from "@/lib/receipts";
import { can, getSession } from "@/lib/session";
import { rm, type Catalog } from "@/lib/shop";
import { ItemsManager, OrderActions, CollectButton, SectionsManager, PickupLink } from "./manage";

type Order = {
  id: string;
  number: number;
  created_at: string;
  status: "pending" | "paid" | "rejected";
  student_id: string;
  full_name: string;
  total_sen: number;
  method: "qr" | "cash";
  bank_ref: string | null;
  receipt_path: string | null;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  collected_at: string | null;
  mine: boolean;
  items: { name: string; option: string; qty: number; unit_sen: number; preorder: boolean }[];
};

const TABS = [
  { key: "orders", label: "Orders" },
  { key: "items", label: "Items" },
  { key: "sections", label: "Sections" },
];

// Running the shop: check payments, hand orders over, and edit items and sections.
export default async function ShopManagerPage({ searchParams }: PageProps<"/exco/shop">) {
  const { supabase, status } = await getSession();
  if (!can(status, "manage_shop")) notFound();
  const q = await searchParams;
  const tab = TABS.some((t) => t.key === q.tab) ? String(q.tab) : "orders";

  const [{ data: orderData }, { data: catalog }] = await Promise.all([
    supabase.rpc("shop_orders_for_review"),
    supabase.rpc("shop_catalog"),
  ]);
  const orders = (orderData ?? []) as Order[];
  const cat = catalog as Catalog;
  const waiting = orders.filter((o) => o.status === "pending");
  const toHand = orders.filter((o) => o.status === "paid" && !o.collected_at);
  const done = orders.filter((o) => o.status !== "pending" && !(o.status === "paid" && !o.collected_at)).reverse();
  const links = tab === "orders" ? await signedUrls(waiting.map((o) => o.receipt_path)) : {};

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Shop</h1>
          <p className="sub">Check payments, hand orders over, and edit what&apos;s for sale.</p>
        </div>
        <Link href="/shop" className="btn btn-ghost btn-sm">See the shop</Link>
      </div>
      <div className="chips" role="tablist">
        {TABS.map((t) => (
          <Link key={t.key} href={`/exco/shop?tab=${t.key}`} role="tab" aria-selected={tab === t.key} className={`chip${tab === t.key ? " on" : ""}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            {t.label}{t.key === "orders" && waiting.length > 0 ? ` (${waiting.length})` : ""}
          </Link>
        ))}
      </div>

      {tab === "orders" && (
        <>
          <div className="eyebrow">Waiting for a payment check ({waiting.length})</div>
          {waiting.length === 0 && <div className="card"><p className="small muted" style={{ margin: 0 }}>Nothing waiting.</p></div>}
          <div className="grid">
            {waiting.map((o) => {
              const receipt = o.receipt_path ? links[o.receipt_path] : undefined;
              return (
                <section className="card" key={o.id}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div><div className="h2">{o.full_name}</div><div className="small muted">{o.student_id} · Order #{o.number}</div></div>
                    <div className="amount">{rm(o.total_sen)}</div>
                  </div>
                  <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                    {o.items.map((i, k) => <li key={k}>{i.qty}× {i.name} ({i.option}) · {rm(i.unit_sen * i.qty)}{i.preorder ? " · pre-order" : ""}</li>)}
                  </ul>
                  <span className={`pill${o.method === "cash" ? " warn" : ""}`} style={{ alignSelf: "flex-start" }}>{o.method === "qr" ? `DuitNow QR · ${o.bank_ref}` : "Cash"}</span>
                  {receipt && (
                    <a href={receipt} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>
                      {o.receipt_path?.endsWith(".pdf") ? "Open the receipt (PDF)" : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="receipt" src={receipt} alt={`Receipt for order #${o.number}`} />
                      )}
                    </a>
                  )}
                  <p className="small muted" style={{ margin: 0 }}>Sent {shortDay(o.created_at)}, {clockLabel(o.created_at)}</p>
                  {o.mine ? <p className="small muted" style={{ margin: 0 }}>Your own order: another shop manager needs to check it.</p> : <OrderActions orderId={o.id} name={o.full_name.split(/\s+/)[0]} />}
                </section>
              );
            })}
          </div>

          <section className="card">
            <div className="eyebrow">Paid, to hand over ({toHand.length})</div>
            {toHand.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing to hand over.</p>}
            {toHand.map((o) => (
              <div key={o.id} className="row" style={{ paddingTop: 10, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                <div>
                  <div className="strong" style={{ fontSize: 14 }}>#{o.number} {o.full_name} · {rm(o.total_sen)}</div>
                  <div className="small muted">{o.items.map((i) => `${i.qty}× ${i.name} (${i.option})${i.preorder ? " [pre-order]" : ""}`).join(", ")}</div>
                </div>
                <CollectButton orderId={o.id} />
              </div>
            ))}
          </section>

          <section className="card">
            <div className="eyebrow">Last 30 days</div>
            {done.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing yet.</p>}
            {done.map((o) => (
              <div key={o.id} className="small" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                <strong>#{o.number} {o.full_name} · {rm(o.total_sen)}</strong>{" "}
                {o.status === "paid" ? `paid, collected ${o.collected_at ? shortDay(o.collected_at) : ""}` : `rejected: ${o.reason ?? ""}`}
                <span className="muted"> · checked by {o.decided_by ?? "someone"}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {tab === "items" && <ItemsManager sections={cat.sections.filter((s) => s.kind === "products")} />}
      {tab === "sections" && (
        <>
          <SectionsManager sections={cat.sections} />
          <PickupLink link={cat.pickup_link ?? ""} />
        </>
      )}
    </>
  );
}
