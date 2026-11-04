"use client";

import { useState, useTransition } from "react";
import { decideTopup } from "./actions";

// Tick the receipts you've checked, then approve them together. Each goes through the usual approval.
export function BulkApprove({ items }: { items: { id: string; label: string }[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = sel.size === items.length;
  const approve = () => start(async () => {
    let done = 0;
    for (const id of sel) {
      const r = await decideTopup(id, true, "");
      if (!r.ok) { setMsg({ ok: false, text: `${done} approved, then: ${r.message}` }); return; }
      done++;
    }
    setSel(new Set());
    setMsg({ ok: true, text: `${done} approved. Each member is told by email.` });
  });
  return (
    <section className="card">
      <div className="row" style={{ flexWrap: "wrap" }}>
        <h2 className="h2">Approve several</h2>
        <label className="check"><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(items.map((i) => i.id)))} /> Select all</label>
      </div>
      <div className="field" style={{ gap: 6 }}>
        {items.map((i) => <label key={i.id} className="check"><input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} /> {i.label}</label>)}
      </div>
      {msg && <p className={msg.ok ? "ok" : "error"} role="status" style={{ margin: 0 }}>{msg.text}</p>}
      <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={!sel.size || pending} onClick={approve}>{pending ? "Approving…" : `Approve selected${sel.size ? ` (${sel.size})` : ""}`}</button>
    </section>
  );
}
