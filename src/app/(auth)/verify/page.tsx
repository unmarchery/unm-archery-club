import { ShopSign } from "@/components/shop-sign";
import { VerifyForm } from "../forms";

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { email, sid, next } = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const to = one(email);
  return (
    <>
      <div>
        <ShopSign as="h1" title="Verify" className="sign--page" />
        <p className="auth-lead">Check your email</p>
        <p className="sub">
          We sent a code to {to ? <strong>{to}</strong> : "your uni email"}. It can take a minute, and may land in Junk.
        </p>
      </div>
      <VerifyForm email={to} sid={one(sid)} next={one(next)} />
    </>
  );
}
