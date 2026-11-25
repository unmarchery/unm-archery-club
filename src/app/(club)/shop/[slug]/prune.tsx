"use client";

import { useEffect } from "react";
import type { ShopProduct } from "@/lib/shop";
import { useCart } from "../cart";

// Checks the saved cart against the live shop (drops items no longer sold, refreshes prices).
export function PruneCart({ products }: { products: ShopProduct[] }) {
  const cart = useCart();
  const key = products.map((p) => p.id + p.your_price_sen).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the catalog changes
  useEffect(() => cart.prune(products), [key]);
  return null;
}
