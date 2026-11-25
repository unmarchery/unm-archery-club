"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { TopupForm } from "../top-up/form";

type Props = { studentId: string; singlePrice: number; fullPrice: number; qrUrl: string | null; whatsappLink: string | null };

// The two pass cards (handoff 5.12: ordinary item cards using the ticket art). Passes are bought through
// the top-up flow (the treasurer checks the payment), so a card opens that form, preset to its pass.
export function PassTickets(props: Props) {
  const [open, setOpen] = useState<"hour" | "day" | null>(null);
  const cards = [
    { key: "hour" as const, name: "Hour pass", price: props.singlePrice, art: "/passes/hour-pass.svg", note: "Any one hour slot" },
    { key: "day" as const, name: "Day pass", price: props.fullPrice, art: "/passes/day-pass.svg", note: "All three hours of one day" },
  ];
  return (
    <>
      <ul className="merch merch--passes" role="list">
        {cards.map((c) => (
          <li key={c.key} className="item" data-glow>
            <button type="button" className="item__btn" onClick={() => setOpen(c.key)} aria-label={`${c.name}, RM${c.price}. ${c.note}.`}>
              <span className="item__tile">
                <span className="item__tag">Guests</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.art} alt="" />
              </span>
              <span className="item__name">{c.name}</span>
              <span className="item__price">RM{c.price}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <Dialog onClose={() => setOpen(null)} labelledBy="topup-title" className="topup-dlg">
          <h2 className="dlg-title" id="topup-title">Buy passes</h2>
          <p className="muted small" style={{ margin: 0 }}>The treasurer adds them once they&apos;ve checked your payment.</p>
          <TopupForm {...props} bare start={open === "hour" ? { single: 1, full: 0 } : { single: 0, full: 1 }} onSent={() => setOpen(null)} />
        </Dialog>
      )}
    </>
  );
}
