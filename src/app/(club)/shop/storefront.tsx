"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CloseIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import { compressImage } from "@/lib/compress-image";
import { dayLabel } from "@/lib/format";
import { rm, shopImage, type ShopProduct, type ShopSection } from "@/lib/shop";
import { cancelOrder, placeOrder } from "./actions";

type CartLine = { option_id: string; product_id: string; name: string; option: string; unit_sen: number; qty: number; image: string | null };
const CART_KEY = "unm-shop-cart";

// The cart lives in this browser only (a convenience), and is checked against the shop on load.
function useCart(products: ShopProduct[]) {
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartLine[];
      const live = new Map(products.flatMap((p) => p.options.filter((o) => o.active).map((o) => [o.id, p] as const)));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage once after hydration
      setCart(saved.filter((l) => live.has(l.option_id)).map((l) => ({ ...l, unit_sen: live.get(l.option_id)!.your_price_sen })));
    } catch {
      /* storage blocked: start with an empty cart */
    }
  }, [products]);
  const save = (next: CartLine[]) => {
    setCart(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return [cart, save] as const;
}

function stockNote(p: ShopProduct) {
  if (p.mode === "preorder") return p.open ? `Pre-order${p.preorder_until ? ` until ${dayLabel(p.preorder_until)}` : ""}` : "Pre-orders closed";
  const left = p.options.filter((o) => o.active).reduce((n, o) => n + (o.stock ?? 0), 0);
  return left === 0 ? "Sold out" : left <= 5 ? `Only ${left} left` : "In stock";
}

function ProductDialog({ product, member, onAdd, onClose }: { product: ShopProduct; member: boolean; onAdd: (l: CartLine) => void; onClose: () => void }) {
  const options = product.options.filter((o) => o.active);
  const [optionId, setOptionId] = useState(options.find((o) => product.mode === "preorder" || (o.stock ?? 0) > 0)?.id ?? "");
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const chosen = options.find((o) => o.id === optionId);
  const max = product.mode === "preorder" ? 20 : Math.min(20, chosen?.stock ?? 0);
  const photos = [...product.images, ...(product.size_chart ? [product.size_chart] : [])];

  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`p-${product.id}`}>
        <div className="row">
          <h2 className="h2" id={`p-${product.id}`}>{product.name}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus><CloseIcon /></button>
        </div>
        {photos.length > 0 && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="product-photo large" src={shopImage(photos[photo])} alt={photo >= product.images.length ? "Size chart" : product.name} />
            {photos.length > 1 && (
              <div className="thumbs">
                {photos.map((path, i) => (
                  <button key={path} type="button" className={`thumb${i === photo ? " on" : ""}`} onClick={() => setPhoto(i)} aria-label={i >= product.images.length ? "Size chart" : `Photo ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shopImage(path)} alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="row">
          <span className="total">{rm(product.your_price_sen)}</span>
          {product.member_price_sen != null && (
            <span className="small muted">{member ? `Member price (others pay ${rm(product.price_sen)})` : `Members pay ${rm(product.member_price_sen)}`}</span>
          )}
        </div>
        {product.description && <p className="small" style={{ margin: 0, whiteSpace: "pre-line" }}>{product.description}</p>}
        <span className="small muted">{stockNote(product)}</span>
        {options.length > 1 || options[0]?.label !== "One size" ? (
          <div className="field">
            <span className="field-label">Option</span>
            <div className="chips">
              {options.map((o) => {
                const out = product.mode === "stock" && (o.stock ?? 0) === 0;
                return (
                  <button key={o.id} type="button" className={`chip${o.id === optionId ? " on" : ""}`} disabled={out} onClick={() => { setOptionId(o.id); setQty(1); }}>
                    {o.label}{out ? " (sold out)" : product.mode === "stock" && (o.stock ?? 0) <= 3 ? ` (${o.stock} left)` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="stepper">
          <span className="strong">Quantity</span>
          <div className="stepper-controls">
            <button type="button" className="icon-btn" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><MinusIcon /></button>
            <output className="stepper-value">{qty}</output>
            <button type="button" className="icon-btn" aria-label="One more" disabled={qty >= max} onClick={() => setQty(qty + 1)}><PlusIcon /></button>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          disabled={!chosen || !product.open || max < 1}
          onClick={() => {
            onAdd({ option_id: chosen!.id, product_id: product.id, name: product.name, option: chosen!.label, unit_sen: product.your_price_sen, qty, image: product.images[0] ?? null });
            onClose();
          }}
        >
          Add to cart · {rm(product.your_price_sen * qty)}
        </button>
      </div>
    </div>
  );
}

function Checkout({ cart, studentId, qrUrl, onDone, onClose }: { cart: CartLine[]; studentId: string; qrUrl: string | null; onDone: () => void; onClose: () => void }) {
  const shoot = useShot();
  const [method, setMethod] = useState<"qr" | "cash">(qrUrl ? "qr" : "cash");
  const [bankRef, setBankRef] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = cart.reduce((n, l) => n + l.unit_sen * l.qty, 0);

  function send() {
    setError(null);
    if (method === "qr" && !bankRef.trim()) return setError("Enter the transaction reference number from your banking app.");
    if (method === "qr" && !receipt) return setError("Add a screenshot of your payment receipt.");
    const fd = new FormData();
    fd.set("items", JSON.stringify(cart.map((l) => ({ option_id: l.option_id, qty: l.qty }))));
    fd.set("method", method);
    if (method === "qr" && receipt) {
      fd.set("bank_ref", bankRef);
      fd.set("receipt", receipt);
    }
    startTransition(async () => {
      const res = await placeOrder(fd);
      if (!res.ok) return setError(res.message);
      shoot("Order sent", `#${res.number} · ${rm(res.total_sen)}. You'll get an email once the payment is checked.`);
      onDone();
    });
  }

  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <div className="row">
          <h2 className="h2" id="checkout-title">Checkout · {rm(total)}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus><CloseIcon /></button>
        </div>
        <div className="seg" role="group" aria-label="Payment method">
          <button type="button" className={method === "qr" ? "on" : ""} aria-pressed={method === "qr"} onClick={() => setMethod("qr")}>DuitNow QR</button>
          <button type="button" className={method === "cash" ? "on" : ""} aria-pressed={method === "cash"} onClick={() => setMethod("cash")}>Cash</button>
        </div>
        {method === "qr" ? (
          <>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="qr" src={qrUrl} alt="Club DuitNow QR code" />
            ) : (
              <p className="small muted" style={{ margin: 0 }}>The club QR isn&apos;t set up yet. Choose cash, or ask the exco how to pay.</p>
            )}
            <ol className="steps small">
              <li>Pay exactly <strong>{rm(total)}</strong> and type your student ID <strong>{studentId}</strong> in the reference.</li>
              <li>Enter the transaction reference number and add a screenshot of the receipt.</li>
            </ol>
            <label className="field">
              <span className="field-label">Transaction reference number</span>
              <input className="input" value={bankRef} maxLength={40} onChange={(e) => setBankRef(e.target.value)} autoComplete="off" />
            </label>
            <div className="field">
              <span className="field-label">Receipt screenshot</span>
              <label className="btn btn-ghost btn-sm file-btn">
                {preparing && <span className="spinner" aria-hidden="true" />}
                {receipt ? "Change picture" : "Choose picture"}
                <input type="file" accept="image/*,application/pdf" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setPreparing(true);
                  setReceipt(await compressImage(f));
                  setPreparing(false);
                }} />
              </label>
              {receipt && <span className="small muted">{receipt.name} · {Math.max(1, Math.round(receipt.size / 1024))} KB</span>}
            </div>
          </>
        ) : (
          <p className="small" style={{ margin: 0 }}>Pay <strong>{rm(total)}</strong> in cash to the exco. Your order is confirmed once they have it.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn" onClick={send} disabled={pending || preparing}>
          {pending && <span className="spinner" aria-hidden="true" />}{pending ? "Sending…" : `Place order · ${rm(total)}`}
        </button>
      </div>
    </div>
  );
}

export function Storefront({ section, member, studentId, qrUrl }: { section: ShopSection; member: boolean; studentId: string; qrUrl: string | null }) {
  const products = useMemo(() => section.products.filter((p) => p.visible), [section]);
  const [cart, setCart] = useCart(products);
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const [checkout, setCheckout] = useState(false);
  const total = cart.reduce((n, l) => n + l.unit_sen * l.qty, 0);

  function add(line: CartLine) {
    const existing = cart.find((l) => l.option_id === line.option_id);
    setCart(existing ? cart.map((l) => (l.option_id === line.option_id ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l)) : [...cart, line]);
  }

  return (
    <>
      {products.length === 0 && <div className="card"><p className="small muted" style={{ margin: 0 }}>Nothing here yet. Check back soon.</p></div>}
      <div className="products">
        {products.map((p) => (
          <button key={p.id} type="button" className="card product" onClick={() => setOpen(p)}>
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="product-photo" src={shopImage(p.images[0])} alt="" />
            ) : (
              <div className="product-photo empty" aria-hidden="true" />
            )}
            <span className="strong">{p.name}</span>
            <span className="row" style={{ width: "100%" }}>
              <span className="strong" style={{ color: "var(--gold-text)" }}>{rm(p.your_price_sen)}</span>
              <span className="small muted">{stockNote(p)}</span>
            </span>
          </button>
        ))}
      </div>

      {cart.length > 0 && (
        <section className="card cart">
          <div className="eyebrow">Your cart</div>
          {cart.map((l) => (
            <div key={l.option_id} className="row" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <span className="small"><strong>{l.qty}×</strong> {l.name} ({l.option})</span>
              <span className="row" style={{ gap: 10 }}>
                <span className="small strong">{rm(l.unit_sen * l.qty)}</span>
                <button type="button" className="link-btn" onClick={() => setCart(cart.filter((x) => x.option_id !== l.option_id))}>Remove</button>
              </span>
            </div>
          ))}
          <div className="row total-row">
            <span className="strong">Total</span>
            <span className="total">{rm(total)}</span>
          </div>
          <button type="button" className="btn" onClick={() => setCheckout(true)}>Checkout · {rm(total)}</button>
        </section>
      )}

      {open && <ProductDialog product={open} member={member} onAdd={add} onClose={() => setOpen(null)} />}
      {checkout && <Checkout cart={cart} studentId={studentId} qrUrl={qrUrl} onClose={() => setCheckout(false)} onDone={() => { setCart([]); setCheckout(false); }} />}
    </>
  );
}

export function CancelOrder({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button type="button" className="link-btn" disabled={pending} onClick={() => startTransition(async () => {
        const res = await cancelOrder(orderId);
        if (!res.ok) setError(res.message);
      })}>Cancel order</button>
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}
