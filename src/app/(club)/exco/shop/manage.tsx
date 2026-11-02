"use client";

import { useState, useTransition } from "react";
import { CloseIcon } from "@/components/icons";
import { useShot } from "@/components/shot-provider";
import { compressImage } from "@/lib/compress-image";
import { rm, shopImage, type ShopProduct, type ShopSection } from "@/lib/shop";
import { decideOrder, markCollected, saveProduct, saveSection, saveShopLink } from "./actions";

function usePending() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (job: () => Promise<{ ok: boolean; message?: string }>, done?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await job();
      if (!res.ok) setError(res.message ?? "Something went wrong.");
      else done?.();
    });
  };
  return { error, pending, run };
}

export function OrderActions({ orderId, name }: { orderId: string; name: string }) {
  const shoot = useShot();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { error, pending, run } = usePending();
  if (rejecting) {
    return (
      <div className="field">
        <label className="field">
          <span className="field-label">Reason (the buyer sees this)</span>
          <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount doesn't match" autoFocus />
        </label>
        <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-danger btn-sm" disabled={pending || !reason.trim()} onClick={() => run(() => decideOrder(orderId, false, reason))}>Reject order</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(false)}>Back</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="field">
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(() => decideOrder(orderId, true, ""), () => shoot("Payment confirmed", `${name} will get an email with the pick-up group`))}>
          {pending && <span className="spinner" aria-hidden="true" />}Confirm payment
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(true)}>Reject</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function CollectButton({ orderId }: { orderId: string }) {
  const { error, pending, run } = usePending();
  return (
    <span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => markCollected(orderId, true))}>
        {pending && <span className="spinner" aria-hidden="true" />}Collected
      </button>
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}

type Draft = {
  id?: string;
  section_id: string;
  name: string;
  description: string;
  price: string;
  member_price: string;
  mode: "stock" | "preorder";
  preorder_until: string;
  visible: boolean;
  images: string[];
  size_chart: string | null;
  options: { id?: string; label: string; stock: string }[];
};

const toDraft = (p: ShopProduct | null, sectionId: string): Draft =>
  p
    ? {
        id: p.id, section_id: sectionId, name: p.name, description: p.description ?? "",
        price: String(p.price_sen / 100), member_price: p.member_price_sen == null ? "" : String(p.member_price_sen / 100),
        mode: p.mode, preorder_until: p.preorder_until ?? "", visible: p.visible, images: p.images, size_chart: p.size_chart,
        options: p.options.filter((o) => o.active).map((o) => ({ id: o.id, label: o.label, stock: String(o.stock ?? 0) })),
      }
    : { section_id: sectionId, name: "", description: "", price: "", member_price: "", mode: "stock", preorder_until: "", visible: true, images: [], size_chart: null, options: [{ label: "One size", stock: "0" }] };

const sen = (rmText: string) => Math.round(Number(rmText) * 100);

function ItemEditor({ product, sections, sectionId, onClose }: { product: ShopProduct | null; sections: ShopSection[]; sectionId: string; onClose: () => void }) {
  const shoot = useShot();
  const [d, setD] = useState<Draft>(toDraft(product, sectionId));
  const [photos, setPhotos] = useState<File[]>([]);
  const [chart, setChart] = useState<File | null>(null);
  const [sizes, setSizes] = useState("");
  const [colours, setColours] = useState("");
  const [busy, setBusy] = useState(false);
  const { error, pending, run } = usePending();
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });

  // "S, M, L" × "Black, White" → "S / Black", "S / White", …, keeping stock already typed.
  function makeOptions() {
    const a = sizes.split(",").map((x) => x.trim()).filter(Boolean);
    const b = colours.split(",").map((x) => x.trim()).filter(Boolean);
    const labels = a.length && b.length ? a.flatMap((x) => b.map((y) => `${x} / ${y}`)) : a.length ? a : b;
    if (labels.length === 0) return;
    set({ options: labels.map((label) => d.options.find((o) => o.label === label) ?? { label, stock: "0" }) });
  }

  function save() {
    const fd = new FormData();
    fd.set("item", JSON.stringify({
      id: d.id, section_id: d.section_id, name: d.name, description: d.description,
      price_sen: sen(d.price), member_price_sen: d.member_price.trim() ? sen(d.member_price) : "",
      mode: d.mode, preorder_until: d.mode === "preorder" ? d.preorder_until : "", visible: d.visible,
      images: d.images, size_chart: d.size_chart,
      options: d.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label, stock: Number(o.stock) || 0 })),
    }));
    photos.forEach((f) => fd.append("photos", f));
    if (chart) fd.set("size_chart", chart);
    run(() => saveProduct(fd), () => { shoot("Saved", `${d.name} is updated in the shop`); onClose(); });
  }

  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="item-title" style={{ maxWidth: 640 }}>
        <div className="row">
          <h2 className="h2" id="item-title">{product ? `Edit ${product.name}` : "Add an item"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus><CloseIcon /></button>
        </div>
        <div className="filters">
          <label className="field" style={{ flex: "2 1 220px" }}><span className="field-label">Name</span><input className="input" value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field">
            <span className="field-label">Section</span>
            <select className="input" value={d.section_id} onChange={(e) => set({ section_id: e.target.value })}>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span className="field-label">Description</span><textarea className="input" maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} style={{ minHeight: 70 }} /></label>
        <div className="filters">
          <label className="field"><span className="field-label">Price (RM)</span><input className="input" inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} /></label>
          <label className="field"><span className="field-label">Member price (RM, optional)</span><input className="input" inputMode="decimal" value={d.member_price} onChange={(e) => set({ member_price: e.target.value })} /></label>
        </div>
        <div className="seg" role="group" aria-label="Stock or pre-order">
          <button type="button" className={d.mode === "stock" ? "on" : ""} onClick={() => set({ mode: "stock" })}>In stock</button>
          <button type="button" className={d.mode === "preorder" ? "on" : ""} onClick={() => set({ mode: "preorder" })}>Pre-order</button>
        </div>
        {d.mode === "preorder" && (
          <label className="field"><span className="field-label">Take pre-orders until (empty = no end)</span><input className="input" type="date" value={d.preorder_until} onChange={(e) => set({ preorder_until: e.target.value })} /></label>
        )}

        <div className="field">
          <span className="field-label">Photos (the first is the main one)</span>
          <div className="thumbs">
            {d.images.map((path) => (
              <span key={path} className="thumb" style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shopImage(path)} alt="" />
                <button type="button" className="pill-x" style={{ position: "absolute", top: 2, right: 2, background: "var(--surface)" }} aria-label="Remove photo" onClick={() => set({ images: d.images.filter((x) => x !== path) })}><CloseIcon /></button>
              </span>
            ))}
            {photos.map((f, i) => <span key={i} className="thumb small" style={{ display: "grid", placeItems: "center", fontSize: 11 }}>new</span>)}
          </div>
          <label className="btn btn-ghost btn-sm file-btn">
            {busy && <span className="spinner" aria-hidden="true" />}Add photos
            <input type="file" accept="image/*" multiple onChange={async (e) => {
              const files = [...(e.target.files ?? [])].slice(0, 8);
              setBusy(true);
              const ready = await Promise.all(files.map((f) => compressImage(f)));
              setPhotos([...photos, ...ready]);
              setBusy(false);
            }} />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Size chart (optional)</span>
          <label className="btn btn-ghost btn-sm file-btn">
            {chart ? chart.name : d.size_chart ? "Replace size chart" : "Add size chart"}
            <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setChart(await compressImage(f, 2000, 0.9)); }} />
          </label>
        </div>

        <div className="field">
          <span className="field-label">Options</span>
          <div className="filters">
            <label className="field"><span className="field-label">Sizes</span><input className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" /></label>
            <label className="field"><span className="field-label">Colours</span><input className="input" value={colours} onChange={(e) => setColours(e.target.value)} placeholder="Black, White" /></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={makeOptions}>Make options</button>
          </div>
          {d.options.map((o, i) => (
            <div key={i} className="filters">
              <label className="field" style={{ flex: "2 1 160px" }}><span className="field-label">Option</span><input className="input" value={o.label} maxLength={60} onChange={(e) => set({ options: d.options.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></label>
              {d.mode === "stock" && (
                <label className="field"><span className="field-label">Stock</span><input className="input" type="number" min={0} value={o.stock} onChange={(e) => set({ options: d.options.map((x, k) => (k === i ? { ...x, stock: e.target.value } : x)) })} /></label>
              )}
              <button type="button" className="link-btn" onClick={() => set({ options: d.options.filter((_, k) => k !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => set({ options: [...d.options, { label: "", stock: "0" }] })}>+ Add an option</button>
        </div>

        <label className="check"><input type="checkbox" checked={d.visible} onChange={(e) => set({ visible: e.target.checked })} /><span>Show in the shop</span></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn" onClick={save} disabled={pending || busy || !d.name.trim() || !d.price}>
          {pending && <span className="spinner" aria-hidden="true" />}{pending ? "Saving…" : "Save item"}
        </button>
      </div>
    </div>
  );
}

export function ItemsManager({ sections }: { sections: ShopSection[] }) {
  const [editing, setEditing] = useState<{ product: ShopProduct | null; sectionId: string } | null>(null);
  if (sections.length === 0) return <div className="card"><p className="small muted" style={{ margin: 0 }}>Add a section first, on the Sections tab.</p></div>;
  return (
    <>
      {sections.map((s) => (
        <section key={s.id} className="card">
          <div className="row">
            <div className="h2">{s.name}{s.visible ? "" : " (hidden)"}</div>
            <button type="button" className="btn btn-sm" onClick={() => setEditing({ product: null, sectionId: s.id })}>Add an item</button>
          </div>
          {s.products.length === 0 && <p className="small muted" style={{ margin: 0 }}>No items yet.</p>}
          {s.products.map((p) => (
            <div key={p.id} className="row" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shopImage(p.images[0])} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
                ) : <span className="product-photo empty" style={{ width: 48, height: 48 }} />}
                <div>
                  <div className="strong" style={{ fontSize: 14 }}>{p.name}{p.visible ? "" : " (hidden)"}</div>
                  <div className="small muted">
                    {rm(p.price_sen)}{p.member_price_sen != null ? ` · members ${rm(p.member_price_sen)}` : ""} ·{" "}
                    {p.mode === "preorder" ? "pre-order" : `${p.options.filter((o) => o.active).reduce((n, o) => n + (o.stock ?? 0), 0)} in stock`}
                  </div>
                </div>
              </div>
              <button type="button" className="link-btn" onClick={() => setEditing({ product: p, sectionId: s.id })}>Edit</button>
            </div>
          ))}
        </section>
      ))}
      {editing && <ItemEditor product={editing.product} sectionId={editing.sectionId} sections={sections} onClose={() => setEditing(null)} />}
    </>
  );
}

function SectionRow({ section }: { section: ShopSection }) {
  const [name, setName] = useState(section.name);
  const [sort, setSort] = useState(String(section.sort));
  const { error, pending, run } = usePending();
  return (
    <div className="filters" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <label className="field" style={{ flex: "2 1 180px" }}><span className="field-label">{section.kind === "passes" ? "Name (the passes section)" : "Name"}</span><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field" style={{ flex: "0 1 90px" }}><span className="field-label">Order</span><input className="input" type="number" value={sort} onChange={(e) => setSort(e.target.value)} /></label>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => saveSection(section.id, name, Number(sort), section.visible))}>Save</button>
      <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => saveSection(section.id, name, Number(sort), !section.visible))}>{section.visible ? "Hide" : "Show"}</button>
      {error && <p className="error" role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
    </div>
  );
}

export function SectionsManager({ sections }: { sections: ShopSection[] }) {
  const [name, setName] = useState("");
  const { error, pending, run } = usePending();
  return (
    <section className="card">
      <div className="eyebrow">Sections</div>
      <p className="small muted" style={{ margin: 0 }}>The tabs at the top of the shop, in order (lowest number first). Hidden sections are only visible to shop managers.</p>
      {sections.map((s) => <SectionRow key={s.id} section={s} />)}
      <div className="filters" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <label className="field" style={{ flex: "2 1 180px" }}><span className="field-label">New section</span><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Equipment, Events" /></label>
        <button type="button" className="btn btn-sm" disabled={pending || !name.trim()} onClick={() => run(() => saveSection(null, name, sections.length, true), () => setName(""))}>Add section</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

export function PickupLink({ link }: { link: string }) {
  const [value, setValue] = useState(link);
  const { error, pending, run } = usePending();
  const [saved, setSaved] = useState(false);
  return (
    <section className="card">
      <div className="eyebrow">Pick-up group</div>
      <p className="small muted" style={{ margin: 0 }}>Buyers see a button to this WhatsApp group once their payment is confirmed, to arrange where and when to collect.</p>
      <div className="filters">
        <label className="field" style={{ flex: "2 1 260px" }}><span className="field-label">WhatsApp group link</span><input className="input" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} placeholder="https://chat.whatsapp.com/…" inputMode="url" /></label>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(() => saveShopLink(value), () => setSaved(true))}>Save</button>
      </div>
      {saved && <p className="ok" role="status">Saved.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
