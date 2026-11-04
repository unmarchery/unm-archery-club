import { notFound } from "next/navigation";
import { dayLabel } from "@/lib/format";
import { can, getSession } from "@/lib/session";
import { AutoTierForm, MatchForm, ScoresForm, TierForm } from "./forms";

type Cfg = { auto_tier_on?: boolean; auto_tier_intermediate?: number; auto_tier_pro?: number; auto_tier_matches?: number };

// Rank matches, scores, skill tiers and the automatic tier-up setting (Ranking and tiers switch).
export default async function RankingToolPage() {
  const { supabase, status } = await getSession();
  if (!can(status, "manage_ranking")) notFound();
  const [{ data: o }, { data: cfg }] = await Promise.all([
    supabase.rpc("rank_overview"),
    supabase.from("settings").select("*").single<Cfg>(),
  ]);
  const upcoming = ((o as { upcoming?: { id: string; title: string; held_on: string; taken: number }[] } | null)?.upcoming ?? [])
    .map((m) => ({ id: m.id, label: `${m.title} · ${dayLabel(m.held_on)} · ${m.taken} registered` }));
  return (
    <>
      <div className="page-head"><div><h1 className="h1">Ranking</h1><p className="sub">Plan rank matches, enter scores and move archers between skill tiers.</p></div></div>
      <div className="grid">
        <MatchForm />
        <ScoresForm matches={upcoming} />
        <TierForm />
        <AutoTierForm on={cfg?.auto_tier_on ?? false} intermediate={cfg?.auto_tier_intermediate ?? 450} pro={cfg?.auto_tier_pro ?? 540} matches={cfg?.auto_tier_matches ?? 2} />
      </div>
    </>
  );
}
