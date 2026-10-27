import { VerifyForm } from "../forms";

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { email, sid, next } = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const to = one(email);
  return (
    <>
      <div>
        <h1 className="h1">Check your email</h1>
        <p className="sub">
          We sent a code to {to ? <strong>{to}</strong> : "your uni email"}. It can take a minute, and may land in Junk.
        </p>
      </div>
      <VerifyForm email={to} sid={one(sid)} next={one(next)} />
    </>
  );
}
