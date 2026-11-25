import type { Metadata } from "next";
import Link from "next/link";
import { dayLabel } from "@/lib/format";
import { getOptionalSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CrtBand } from "@/components/crt-band";
import { ShopSign } from "@/components/shop-sign";
import { Board, type Standing } from "./board";
import "./rank.css";
import { RegisterButton } from "./register";

export const metadata: Metadata = { title: "Ranking · UNM Archery Club" };

type Overview = {
  upcoming: { id: string; title: string; held_on: string; time_label: string | null; format: string | null; capacity: number; taken: number; registered: boolean }[];
  history: { id: string; title: string; held_on: string; archers: number; top: Record<string, { username: string; score: number }[]> }[];
};
const TIERS = [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["pro", "Pro"]] as const;
// Each tier's band colour: Beginner green, Intermediate visor cyan, Pro target gold.
const TIER_TONE: Record<string, string> = { beginner: "crt--robin", intermediate: "crt--visor", pro: "crt--gold" };
const VIEWS = [["upcoming", "Upcoming Rank Matches", "Upcoming"], ["leaderboard", "Leaderboard", "Leaderboard"], ["history", "Rank Matches History", "History"]] as const;

export default async function RankingPage({ searchParams }: PageProps<"/ranking">) {
  const q = await searchParams;
  const view = VIEWS.some(([v]) => v === q.view) ? String(q.view) : "leaderboard";
  const session = await getOptionalSession();
  const member = session?.status.membership === "member";
  const myTier = session?.profile.tier ?? "beginner";
  const tier = TIERS.some(([t]) => t === q.tier) ? String(q.tier) : member ? myTier : "pro";
  const tierLabel = TIERS.find(([t]) => t === tier)![1];
  const supabase = await createClient();

  const tabs = (
    <nav className="subtabs-wrap" aria-label="Ranking">
      <div className="subtabs">
        {VIEWS.map(([v, long, short]) => (
          <Link key={v} href={`/ranking?view=${v}`} aria-current={v === view ? "page" : undefined} aria-label={long}>
            <span className="long">{long}</span><span className="short">{short}</span>
          </Link>
        ))}
      </div>
    </nav>
  );

  const head = (
    <div className="rank-head">
      <ShopSign as="h1" title="Ranking" tag="RANK MATCHES · BY TIER" className="sign--page" />
    </div>
  );

  if (view === "leaderboard") {
    const { data } = await supabase.rpc("leaderboard", { p_tier: tier });
    return (
      <div className="rank">
        {head}
        {tabs}
        <div className="panel-head">
          <h2 className="rank-title">Leaderboard</h2>
          <p className="muted">Each skill tier has its own leaderboard, so archers compete with others at their level. Ranked by best rank-match score. <Link href="/faq#q-tiers">How tiers work</Link></p>
        </div>
        <div className="tier-switch" role="group" aria-label="Skill tier">
          {TIERS.map(([t, l]) => <Link key={t} href={`/ranking?tier=${t}`} className={`chip${t === tier ? " on" : ""}`} aria-current={t === tier ? "true" : undefined}>{l}</Link>)}
        </div>
        {session && !member && <p className="callout">Guests can follow the standings. <Link href="/me">Join the club</Link> to enter rank matches.</p>}
        <div className={`rank-band ${TIER_TONE[tier] ?? ""}`}>
          <CrtBand title={tierLabel} tag={`${tierLabel.toUpperCase()} · BEST RANK-MATCH SCORE`} className="crt-band crt-band--small" />
        </div>
        <Board rows={(data ?? []) as Standing[]} tier={tierLabel} />
        <Link href="/ranking?view=upcoming" className="btn btn--primary btn--lg rank-more" data-magnetic><span className="btn__label">See upcoming rank matches</span></Link>
      </div>
    );
  }

  const { data } = await supabase.rpc("rank_overview");
  const o = (data ?? { upcoming: [], history: [] }) as Overview;
  return (
    <div className="rank">
      {head}
      {tabs}
      <div className="panel-head">
        <h2 className="rank-title">{view === "upcoming" ? "Upcoming rank matches" : "Rank matches history"}</h2>
        <p className="muted">{view === "upcoming" ? "Scores count toward your tier's leaderboard. Beginner, Intermediate and Pro each have their own category." : "Past matches, newest first, with the top three in each tier."}</p>
      </div>
      {view === "upcoming" && session && !member && <p className="callout">Rank matches are for members. <Link href="/me">Join the club</Link> to compete.</p>}
      <ol className="match-list">
        {view === "upcoming" && o.upcoming.map((m) => (
          <li key={m.id} className="match">
            <div><h3>{m.title}</h3><p className="muted small">{dayLabel(m.held_on)}{m.time_label ? ` · ${m.time_label}` : ""}{m.format ? ` · ${m.format}` : ""}</p></div>
            <div className="match-act">
              {member ? <RegisterButton match={m.id} registered={m.registered} /> : !session ? <Link href="/login" className="btn btn-ghost btn-sm">Sign in to register</Link> : <span className="pill">Members only</span>}
              <span className="muted small">{m.taken} of {m.capacity} places taken</span>
            </div>
          </li>
        ))}
        {view === "history" && o.history.map((m) => (
          <li key={m.id} className="match">
            <div><h3>{m.title}</h3><p className="muted small">{dayLabel(m.held_on)} · {m.archers} archers</p></div>
            <details className="results">
              <summary>Top 3 per tier</summary>
              {TIERS.filter(([t]) => m.top[t]?.length).map(([t, l]) => (
                <div key={t}><strong className="small">{l}</strong><ol>{m.top[t].map((x, i) => <li key={i}><Link href={`/u/${x.username}`}>@{x.username}</Link><span>{x.score}</span></li>)}</ol></div>
              ))}
            </details>
          </li>
        ))}
        {(view === "upcoming" ? o.upcoming : o.history).length === 0 && <li className="muted">{view === "upcoming" ? "No rank matches planned yet." : "No results yet."}</li>}
      </ol>
    </div>
  );
}
