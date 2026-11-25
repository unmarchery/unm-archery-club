import Link from "next/link";
import { ShopSign } from "./shop-sign";

// The 404 page in the site's own look (the built-in one is plain white).
export function NotFoundView() {
  return (
    <section className="nf" aria-labelledby="nf-title">
      <ShopSign as="h1" id="nf-title" title="404" tag="OFF THE TARGET" className="sign--page" />
      <p className="nf__text">This page isn&apos;t on the range. It may have moved, or it&apos;s only for some exco.</p>
      <div className="nf__acts">
        <Link className="btn btn--primary btn--lg" href="/"><span className="btn__label">Back to the club</span></Link>
        <Link className="btn btn--glass btn--lg" href="/sessions"><span className="btn__label">Book a session</span></Link>
      </div>
    </section>
  );
}
