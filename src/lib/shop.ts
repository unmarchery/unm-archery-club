// Shop helpers shared by the shop pages. Prices are stored in sen.
export function rm(sen: number) {
  return sen % 100 === 0 ? `RM${sen / 100}` : `RM${(sen / 100).toFixed(2)}`;
}

// Product photos live in the public "shop" bucket.
export function shopImage(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop/${path}`;
}

export type ShopOption = { id: string; label: string; stock: number | null; active: boolean };
export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  price_sen: number;
  member_price_sen: number | null;
  your_price_sen: number;
  mode: "stock" | "preorder";
  preorder_until: string | null;
  open: boolean;
  images: string[];
  size_chart: string | null;
  visible: boolean;
  sort: number;
  options: ShopOption[];
};
export type ShopSection = { id: string; name: string; kind: "products" | "passes"; visible: boolean; sort: number; products: ShopProduct[] };
export type Catalog = { member: boolean; manager: boolean; sections: ShopSection[]; pickup_link: string | null };

// Each collection's colour (handoff 4, event colours), chosen from its name: Robin Hood green,
// Cupid's Valentine pink, Passes gold, anything else club navy. `glow` is an RGB triple.
export function sectionTone(section: Pick<ShopSection, "name" | "kind">) {
  if (section.kind === "passes") return { cls: "crt--passes", glow: "240 196 90" };
  if (/robin|hood|sherwood/i.test(section.name)) return { cls: "crt--robin", glow: "128 228 112" };
  if (/cupid|valentine|love|heart/i.test(section.name)) return { cls: "crt--cupid", glow: "255 128 180" };
  return { cls: "crt--club", glow: "120 158 255" };
}

// The small tag in a photo's corner.
export function itemTag(p: ShopProduct) {
  if (p.mode === "preorder") return p.open ? "Pre-order" : "Pre-orders closed";
  return p.options.filter((o) => o.active).some((o) => (o.stock ?? 0) > 0) ? null : "Sold out";
}

// Addresses for the phone item pages (/shop/robin-hood-tee): the name in lower case with dashes;
// a repeated name gets -2, -3 … in catalog order, so every item has its own.
export function productSlugs(sections: ShopSection[]) {
  const seen = new Map<string, number>();
  const slugs = new Map<string, string>();
  for (const s of sections) for (const p of s.products) {
    const base = p.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    slugs.set(p.id, n === 1 ? base : `${base}-${n}`);
  }
  return slugs;
}
