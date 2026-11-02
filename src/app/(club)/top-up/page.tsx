import { redirect } from "next/navigation";

// Top up moved into the Shop, as its Passes section.
export default function TopUpPage() {
  redirect("/shop");
}
