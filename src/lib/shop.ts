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
