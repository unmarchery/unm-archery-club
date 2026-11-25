import { CartProvider } from "./cart";

// The cart is shared by the shop and its item pages, so it survives moving between them.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
