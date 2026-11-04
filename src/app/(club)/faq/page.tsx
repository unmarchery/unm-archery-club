import type { Metadata } from "next";
import { getPublicInfo } from "@/lib/public-info";
import { OpenFromHash } from "./open-from-hash";

export const metadata: Metadata = { title: "FAQ · UNM Archery Club" };

// Answers for first-timers and members. Public, so visitors can read it before signing up.
export default async function FaqPage() {
  const p = await getPublicInfo();
  const faq: [string, string, string][] = [
    ["wear", "What should I wear?", "Closed-toe shoes and a fitted top. Avoid loose sleeves, scarves and dangling jewellery, and tie back long hair. The club lends arm guards and finger tabs."],
    ["where", "Where is the range?", "At the Sports Complex on campus. Follow the signs to the archery range; a coach meets first-timers at the shooting line."],
    ["equipment", "Do I need my own bow?", "No. The club provides all the equipment. If you have your own bow, choose \"Own bow\" when you book."],
    ["beginner", "I've never shot before. Is that OK?", "Yes. Most members started at the club. A coach takes you through range safety and your first arrows."],
    ["attendance", "Do I have to come every week?", "No. It's flexible, with no forced attendance. Book the hours that suit you."],
    ["booking", "When can I book?", "The exco opens each session for booking 1–2 weeks ahead. Days that aren't open yet show when they open, and you can add the opening time to your calendar."],
    ["noshow", "What if I can't make it?", `Cancel from your bookings before the session. If you book and don't come, it counts as a no-show: ${p.noshow_warn_after} bring a warning and ${p.noshow_ban_after} mean no bookings for ${p.ban_days} days.`],
    ["passes", "How do passes work for guests?", `An hour pass (RM${p.single_price}) covers one hour; a day pass (RM${p.fullday_price}) covers 4–7pm on one day. Buy them in the Shop and pay by DuitNow QR or in cash at the range.`],
    ["tiers", "How do skill tiers work?", "Every member starts as Beginner. The exco moves archers up to Intermediate or Pro as they progress. Each tier has its own leaderboard, so you compete with archers at your level. Scores from a lower tier stay in that tier's history."],
    ["staff", "Can staff or alumni join?", "Training sessions are for UNM students. Staff or alumni? Message the club on Instagram."],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">FAQ</h1>
          <p className="sub">Answers for first-timers and members.</p>
        </div>
      </div>
      <OpenFromHash />
      <div className="faq">
        {faq.map(([id, q, a]) => (
          <details key={id} id={`q-${id}`} className="card faq-item">
            <summary>{q}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
