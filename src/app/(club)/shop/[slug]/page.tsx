import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { signedUrls } from "@/lib/receipts";
import { getSession } from "@/lib/session";
import { productSlugs, sectionTone, type Catalog } from "@/lib/shop";
import { CartPill } from "../cart";
import { Gallery, ItemDetails } from "../floor";
import { PruneCart } from "./prune";
import "../shop.css";

// An item's own page (handoff 5.12, for phones): the pop-up's layout stacked: photo, then details,
// then a sticky Add to cart. Works on any screen, so a shared link opens properly too.
export default async function ShopItemPage({ params }: PageProps<"/shop/[slug]">) {
  const { slug } = await params;
  const { supabase, profile } = await getSession();
  const [{ data }, { data: cfg }] = await Promise.all([
    supabase.rpc("shop_catalog"),
    supabase.from("settings").select("*").single<{ payment_qr_path?: string | null }>(),
  ]);
  const catalog = data as Catalog | null;
  const sections = (catalog?.sections ?? []).filter((s) => s.visible && s.kind === "products");
  const slugs = productSlugs((catalog?.sections ?? []).filter((s) => s.visible));
  const section = sections.find((s) => s.products.some((p) => p.visible && slugs.get(p.id) === slug));
  const item = section?.products.find((p) => slugs.get(p.id) === slug);
  if (!section || !item) notFound();
  const tone = sectionTone(section);
  const qrPath = cfg?.payment_qr_path ?? null;
  const links = await signedUrls([qrPath]);

  return (
    <div className={`shop shop-item page-bleed ${tone.cls}`} style={{ "--glow": tone.glow } as React.CSSProperties}>
      <PruneCart products={sections.flatMap((s) => s.products)} />
      <div className="shop-item__head wrap-v2 gutter">
        <Link href="/shop" className="shop-item__back"><ArrowIcon className="inline-icon flip" /> {section.name}</Link>
        <CartPill studentId={profile.student_id} qrUrl={qrPath ? (links[qrPath] ?? null) : null} watch=".shop-item__head" />
      </div>
      <article className="shop-item__body wrap-v2 gutter" aria-labelledby={`item-${item.id}`}>
        <Gallery item={item} />
        <div className="shop-item__details">
          <ItemDetails item={item} glow={tone.glow} member={Boolean(catalog?.member)} titleId={`item-${item.id}`} sticky />
        </div>
      </article>
    </div>
  );
}
