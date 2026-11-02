import { notFound } from "next/navigation";
import { clockLabel, shortDay } from "@/lib/format";
import { isJuco } from "@/lib/people";
import { getSession } from "@/lib/session";
import { AddPerson, PersonCard, type Person, type Powers } from "./people";

type Overview = Powers & {
  people: Person[];
  log: { at: string; actor: string | null; target: string | null; action: string }[];
};

// Exco only: who is on the committee, their access switches and notes. The President and
// VP switch access here instead of in the SQL editor; every change is logged.
export default async function PeoplePage() {
  const { supabase, status } = await getSession();
  if (!status.is_exco) notFound();

  const { data } = await supabase.rpc("people_overview");
  if (!data) notFound();
  const o = data as Overview;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Exco & JUCO</h1>
          <p className="sub">
            {o.can_access
              ? "Switch each exco's access on or off. It takes effect straight away, and every change is logged below."
              : "Who's on the exco and what they can open."}
          </p>
        </div>
        <span className="tag">{o.people.filter((p) => !isJuco(p.position)).length} exco · {o.people.filter((p) => isJuco(p.position)).length} JUCO</span>
      </div>

      {o.can_positions && <AddPerson powers={o} />}

      {[
        { title: "Exco", people: o.people.filter((p) => !isJuco(p.position)) },
        { title: "JUCO (junior committee)", people: o.people.filter((p) => isJuco(p.position)) },
      ].map((g) => g.people.length > 0 && (
        <div key={g.title} className="field" style={{ gap: 10 }}>
          <div className="eyebrow">{g.title}</div>
          {g.people.map((p) => (
            <PersonCard key={p.id} person={p} powers={o} />
          ))}
        </div>
      ))}

      {o.can_access && (
        <section className="card">
          <div className="eyebrow">Recent changes</div>
          {o.log.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing changed yet.</p>}
          {o.log.map((l, i) => (
            <div key={i} className="small" style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <strong>{l.actor ?? "Someone"}</strong> {l.action}
              {l.target ? ` for ${l.target}` : ""}
              <span className="muted"> · {shortDay(l.at)}, {clockLabel(l.at)}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
