"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Dialog } from "@/components/dialog";
import { useShot } from "@/components/shot-provider";
import { compressImage } from "@/lib/compress-image";
import { rm, shopImage, type ShopProduct } from "@/lib/shop";
import { placeOrder } from "./actions";

export type CartLine = { option_id: string; product_id: string; name: string; option: string; unit_sen: number; qty: number; image: string | null };
const CART_KEY = "unm-shop-cart";

type Cart = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (line: CartLine, from?: DOMRect | null, glow?: string) => void;
  remove: (optionId: string) => void;
  clear: () => void;
  prune: (products: ShopProduct[]) => void;
  registerPill: (el: HTMLButtonElement | null) => void; // the cart button the flying dot lands on
};
const CartContext = createContext<Cart | null>(null);
export const useCart = () => useContext(CartContext)!;

// One cart for the shop and its item pages. It lives in this browser only (a convenience) and is
// checked against the live shop whenever a page with the catalog loads (prune).
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const loaded = useRef(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const registerPill = useCallback((el: HTMLButtonElement | null) => { pillRef.current = el; }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage once after hydration
      setLines(JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartLine[]);
    } catch { /* storage blocked: start empty */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines]);

  // "Order": a glowing dot in the event colour arcs from the button into the cart, which bumps.
  const fly = useCallback((from: DOMRect, n: number, glow: string) => {
    const pill = pillRef.current;
    if (!pill || matchMedia("(prefers-reduced-motion: reduce)").matches) { pill?.classList.add("is-bumped"); return; }
    const to = pill.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "cart-dot";
    dot.style.setProperty("--c", glow);
    if (n > 1) dot.dataset.n = `×${n}`;
    document.body.append(dot);
    const x0 = from.left + from.width / 2 - 8, y0 = from.top + from.height / 2 - 8;
    const x1 = to.left + to.width - 24, y1 = to.top + to.height / 2 - 8;
    const lift = Math.min(160, Math.abs(x1 - x0) * .35 + 60);
    const anim = dot.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - lift}px) scale(1.15)`, offset: .5 },
      { transform: `translate(${x1}px, ${y1}px) scale(.5)`, opacity: .4 },
    ], { duration: 720, easing: "cubic-bezier(.45,0,.25,1)" });
    anim.onfinish = () => {
      dot.remove();
      pill.classList.remove("is-bumped"); void pill.offsetWidth; pill.classList.add("is-bumped");
    };
  }, []);

  const value = useMemo<Cart>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    total: lines.reduce((n, l) => n + l.unit_sen * l.qty, 0),
    add(line, from, glow = "95 227 214") {
      setLines((cur) => {
        const existing = cur.find((l) => l.option_id === line.option_id);
        return existing ? cur.map((l) => (l.option_id === line.option_id ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l)) : [...cur, line];
      });
      if (from) fly(from, line.qty, glow);
    },
    remove: (id) => setLines((cur) => cur.filter((l) => l.option_id !== id)),
    clear: () => setLines([]),
    prune(products) {
      const live = new Map(products.flatMap((p) => p.options.filter((o) => o.active).map((o) => [o.id, p] as const)));
      setLines((cur) => {
        const next = cur.filter((l) => live.has(l.option_id)).map((l) => ({ ...l, unit_sen: live.get(l.option_id)!.your_price_sen }));
        return next.length === cur.length && next.every((l, i) => l.unit_sen === cur[i].unit_sen) ? cur : next;
      });
    },
    registerPill,
  }), [lines, fly, registerPill]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

const BagIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);

// The cart pill (handoff 5.12): vermilion with a glowing cyan count, in line with the page title. Once the
// title row (`watch`) scrolls away it floats, fixed under the nav at the right. Opens the cart and checkout.
export function CartPill({ studentId, qrUrl, watch }: { studentId: string; qrUrl: string | null; watch: string }) {
  const { count, registerPill } = useCart();
  const [floating, setFloating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = document.querySelector(watch);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFloating(!e.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  return (
    <>
      <button
        ref={registerPill}
        type="button"
        className={`btn cart${floating ? " is-floating" : ""}`}
        aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
        onClick={() => setOpen(true)}
        onAnimationEnd={(e) => { if (e.animationName === "cart-bump") e.currentTarget.classList.remove("is-bumped"); }}
      >
        <BagIcon /><span className="cart__label btn__label">Cart</span><span className="cart__count" aria-hidden="true">{count}</span>
      </button>
      {open && <CartDialog studentId={studentId} qrUrl={qrUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

function CartDialog({ studentId, qrUrl, onClose }: { studentId: string; qrUrl: string | null; onClose: () => void }) {
  const cart = useCart();
  const [step, setStep] = useState<"cart" | "pay">("cart");
  return (
    <Dialog onClose={onClose} labelledBy="cart-title" className="cart-dlg">
      {step === "cart" ? (
        <>
          <h2 className="dlg-title" id="cart-title">Your cart</h2>
          {cart.lines.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing here yet. Pick something from the shop.</p>}
          <ul className="cart-lines" role="list">
            {cart.lines.map((l) => (
              <li key={l.option_id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.image ? <img src={shopImage(l.image)} alt="" /> : <span className="cart-lines__ph" aria-hidden="true" />}
                <span className="cart-lines__what"><b>{l.name}</b><span className="muted small">{l.option} · {l.qty} × {rm(l.unit_sen)}</span></span>
                <span className="cart-lines__sum">{rm(l.unit_sen * l.qty)}</span>
                <button type="button" className="link-btn" onClick={() => cart.remove(l.option_id)} aria-label={`Remove ${l.name} (${l.option})`}>Remove</button>
              </li>
            ))}
          </ul>
          {cart.lines.length > 0 && (
            <>
              <div className="cart-total"><span>Total</span><b>{rm(cart.total)}</b></div>
              <button type="button" className="btn" onClick={() => setStep("pay")}>Checkout · {rm(cart.total)}</button>
            </>
          )}
        </>
      ) : (
        <Checkout studentId={studentId} qrUrl={qrUrl} onBack={() => setStep("cart")} onDone={() => { cart.clear(); onClose(); }} />
      )}
    </Dialog>
  );
}

// Payment for the cart (same flow as before: DuitNow QR with reference + receipt, or cash).
function Checkout({ studentId, qrUrl, onBack, onDone }: { studentId: string; qrUrl: string | null; onBack: () => void; onDone: () => void }) {
  const cart = useCart();
  const shoot = useShot();
  const [method, setMethod] = useState<"qr" | "cash">(qrUrl ? "qr" : "cash");
  const [bankRef, setBankRef] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = cart.total;

  function send() {
    setError(null);
    if (method === "qr" && !bankRef.trim()) return setError("Enter the transaction reference number from your banking app.");
    if (method === "qr" && !receipt) return setError("Add a screenshot of your payment receipt.");
    const fd = new FormData();
    fd.set("items", JSON.stringify(cart.lines.map((l) => ({ option_id: l.option_id, qty: l.qty }))));
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
    <>
      <h2 className="dlg-title" id="cart-title">Checkout · {rm(total)}</h2>
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
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} disabled={pending}>Back to cart</button>
        <button type="button" className="btn btn-sm" onClick={send} disabled={pending || preparing}>
          {pending && <span className="spinner" aria-hidden="true" />}{pending ? "Sending…" : `Place order · ${rm(total)}`}
        </button>
      </div>
    </>
  );
}
