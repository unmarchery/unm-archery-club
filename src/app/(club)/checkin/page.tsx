import { getSession } from "@/lib/session";
import { CheckinForm } from "./form";

// Opened by scanning the QR code at the range. Signing in first is handled by the proxy.
export default async function CheckinPage({ searchParams }: PageProps<"/checkin">) {
  await getSession();
  const q = await searchParams;
  return (
    <section className="card" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <h1 className="h1">Check in</h1>
      <p className="muted" style={{ margin: 0 }}>Tap the button to mark your bookings today as present.</p>
      <CheckinForm d={String(q.d ?? "")} k={String(q.k ?? "")} />
    </section>
  );
}
