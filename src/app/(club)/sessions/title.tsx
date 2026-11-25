import { ShopSign } from "@/components/shop-sign";

// The page title and the schedule rail: three stops on one lit line, like a route map.
export function BookTitle() {
  return (
    <div className="book-head__text">
      <ShopSign as="h1" title="Book a session" tag="TUE & THU · 4–7PM" className="sign--page" />
      <p className="schedule" aria-label="Every Tuesday and Thursday, 4pm to 7pm, at the Sports Complex">
        <span className="schedule__live" aria-hidden="true" />
        <span className="stop"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg><span><small>every</small> Tue &amp; Thu</span></span>
        <span className="schedule__rail" aria-hidden="true" />
        <span className="stop"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg><span>4pm–7pm</span></span>
        <span className="schedule__rail" aria-hidden="true" />
        <span className="stop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg><span><small>at</small> Sports Complex</span></span>
      </p>
    </div>
  );
}
