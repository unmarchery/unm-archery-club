"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CrtBand } from "@/components/crt-band";
import { CloseIcon } from "@/components/icons";
import { dayLabel } from "@/lib/format";
import { itemTag, rm, shopImage, type ShopProduct } from "@/lib/shop";
import { useCart } from "./cart";

export type FloorItem = ShopProduct & { slug: string };
export type FloorSection = { id: string; name: string; tag: string; cls: string; glow: string; items: FloorItem[] };

const PHONE = "(max-width: 540px)";

// Collections (handoff 5.12): a sticky CRT band each, then a ruled 4/3/2/1 grid of cards showing only the
// picture, the name and the price. A card is one button: on tablets and laptops it opens the item pop-up,
// which grows out of the card; on phones it is a link to the item's own page.
export function ShopFloor({ sections, member }: { sections: FloorSection[]; member: boolean }) {
  const cart = useCart();
  const [open, setOpen] = useState<{ item: FloorItem; glow: string; from: DOMRect } | null>(null);
  const all = sections.flatMap((s) => s.items);
  const allKey = all.map((p) => p.id + p.your_price_sen).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check the saved cart when the catalog changes
  useEffect(() => cart.prune(all), [allKey]);

  return (
    <>
      {sections.map((s) => (
        <section key={s.id} className={`merch-sec ${s.cls}`} aria-label={s.name}>
          <CrtBand title={s.name} tag={s.tag} className="crt-band" />
          {s.items.length === 0 ? (
            <p className="merch-empty wrap-v2 gutter">Nothing here yet. Check back soon.</p>
          ) : (
            <div className="wrap-v2 gutter">
              <ul className="merch" role="list">
                {s.items.map((p) => (
                  <li key={p.id} className="item" data-glow>
                    <Link
                      href={`/shop/${p.slug}`}
                      className="item__btn"
                      onClick={(e) => {
                        if (matchMedia(PHONE).matches || e.metaKey || e.ctrlKey || e.shiftKey) return;
                        e.preventDefault();
                        setOpen({ item: p, glow: s.glow, from: e.currentTarget.getBoundingClientRect() });
                      }}
                    >
                      <span className="item__tile">
                        {itemTag(p) && <span className="item__tag">{itemTag(p)}</span>}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.images[0] ? <img src={shopImage(p.images[0])} alt="" loading="lazy" /> : <span className="item__ph" aria-hidden="true" />}
                      </span>
                      <span className="item__name">{p.name}</span>
                      <span className="item__price">{rm(p.your_price_sen)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
      {open && <ItemPop {...open} member={member} onClose={() => setOpen(null)} />}
    </>
  );
}

// The item pop-up: a page-level dialog that grows out of the clicked card, backdrop blurred. Picture left
// (never cropped, a blurred copy fills the panel), details right, price and Add to cart bottom right.
function ItemPop({ item, glow, from, member, onClose }: { item: FloorItem; glow: string; from: DOMRect; member: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useLayoutEffect(() => {
    const d = ref.current!, c = card.current!;
    const back = document.activeElement as HTMLElement | null;
    d.showModal();
    const r = c.getBoundingClientRect();
    c.style.setProperty("--ox", `${from.left + from.width / 2 - r.left}px`);
    c.style.setProperty("--oy", `${from.top + from.height / 2 - r.top}px`);
    const onCancel = (e: Event) => { e.preventDefault(); close.current(); };
    d.addEventListener("cancel", onCancel);
    return () => { d.removeEventListener("cancel", onCancel); back?.focus?.(); };
  }, [from]);

  return (
    <dialog ref={ref} className="pop" style={{ "--glow": glow } as React.CSSProperties} aria-labelledby={`pop-${item.id}`}
      onClick={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div className="pop__card" ref={card}>
        <Gallery item={item} />
        <div className="pop__body">
          <ItemDetails item={item} glow={glow} member={member} titleId={`pop-${item.id}`} onAdded={() => close.current()} autoFocusAdd />
        </div>
        <button type="button" className="pop__close" aria-label="Close" onClick={() => close.current()}><CloseIcon /></button>
      </div>
    </dialog>
  );
}

// Photos (and the size chart) with a blurred copy behind, plus thumbnails when there is more than one.
export function Gallery({ item }: { item: ShopProduct }) {
  const photos = [...item.images, ...(item.size_chart ? [item.size_chart] : [])];
  const [i, setI] = useState(0);
  const src = photos[i] ? shopImage(photos[i]) : null;
  return (
    <div className="pop__media" style={src ? ({ "--img": `url("${src}")` } as React.CSSProperties) : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={i >= item.images.length ? `${item.name}, size chart` : item.name} /> : <span className="item__ph" aria-hidden="true" />}
      {photos.length > 1 && (
        <div className="pop__thumbs">
          {photos.map((p, k) => (
            <button key={p} type="button" className={k === i ? "on" : ""} aria-label={k >= item.images.length ? "Size chart" : `Photo ${k + 1}`} aria-pressed={k === i} onClick={() => setI(k)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shopImage(p)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function stockNote(p: ShopProduct) {
  if (p.mode === "preorder") return p.open ? `Pre-order${p.preorder_until ? ` until ${dayLabel(p.preorder_until)}` : ""}` : "Pre-orders closed";
  const left = p.options.filter((o) => o.active).reduce((n, o) => n + (o.stock ?? 0), 0);
  return left === 0 ? "Sold out" : left <= 5 ? `Only ${left} left` : "In stock";
}

// Tag, name, description, a short spec list, the option chips, then the price, the quantity stepper and
// Add to cart. Shared by the pop-up and the phone item page.
export function ItemDetails({ item, glow, member, titleId, onAdded, autoFocusAdd, sticky }: {
  item: ShopProduct; glow: string; member: boolean; titleId: string; onAdded?: () => void; autoFocusAdd?: boolean; sticky?: boolean;
}) {
  const cart = useCart();
  const options = item.options.filter((o) => o.active);
  const [optionId, setOptionId] = useState(options.find((o) => item.mode === "preorder" || (o.stock ?? 0) > 0)?.id ?? "");
  const [qty, setQty] = useState(1);
  const chosen = options.find((o) => o.id === optionId);
  const max = item.mode === "preorder" ? 20 : Math.min(20, chosen?.stock ?? 0);
  const canAdd = Boolean(chosen) && item.open && max >= 1;
  const showOptions = options.length > 1 || (options[0] && options[0].label !== "One size");
  const tag = itemTag(item);
  const specs = [
    stockNote(item),
    showOptions ? `${options.length > 1 ? "Options" : "Option"}: ${options.map((o) => o.label).join(" · ")}` : null,
    item.member_price_sen != null ? (member ? `Member price (others pay ${rm(item.price_sen)})` : `Members pay ${rm(item.member_price_sen)}`) : null,
    "Pick up at training",
  ].filter(Boolean) as string[];

  return (
    <>
      {tag && <span className="pop__tag">{tag}</span>}
      <h2 className="pop__name" id={titleId}>{item.name}</h2>
      {item.description && <p className="pop__desc">{item.description}</p>}
      <ul className="pop__specs" role="list">{specs.map((s) => <li key={s}>{s}</li>)}</ul>
      {showOptions && (
        <div className="pop__opts" role="group" aria-label="Option">
          {options.map((o) => {
            const out = item.mode === "stock" && (o.stock ?? 0) === 0;
            return (
              <button key={o.id} type="button" className="opt-chip" aria-pressed={o.id === optionId} disabled={out}
                onClick={() => { setOptionId(o.id); setQty(1); }}>
                {o.label}{out ? " · sold out" : item.mode === "stock" && (o.stock ?? 0) <= 3 ? ` · ${o.stock} left` : ""}
              </button>
            );
          })}
        </div>
      )}
      <div className={`pop__foot${sticky ? " is-sticky" : ""}`}>
        <span className="pop__price">{rm(item.your_price_sen)}</span>
        <span className="qty" role="group" aria-label="Quantity">
          <button type="button" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
          <output aria-live="polite">{qty}</output>
          <button type="button" aria-label="One more" disabled={qty >= max} onClick={() => setQty(qty + 1)}>+</button>
        </span>
        <button
          type="button"
          className="btn btn--order"
          disabled={!canAdd}
          autoFocus={autoFocusAdd}
          onClick={(e) => {
            const from = e.currentTarget.getBoundingClientRect();
            cart.add({ option_id: chosen!.id, product_id: item.id, name: item.name, option: chosen!.label, unit_sen: item.your_price_sen, qty, image: item.images[0] ?? null }, from, glow);
            onAdded?.();
          }}
        >
          <span className="btn__label">{canAdd ? "Add to cart" : item.open ? "Sold out" : "Closed"}</span>
          {canAdd && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>}
        </button>
      </div>
    </>
  );
}
