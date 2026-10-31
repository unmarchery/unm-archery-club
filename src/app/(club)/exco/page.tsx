import { ChatIcon } from "@/components/icons";
import { getSession } from "@/lib/session";
import { MyCard } from "./my-card";

type Exco = {
  id: string;
  full_name: string;
  position: string | null;
  handles: string | null;
  whatsapp: string | null;
  show_whatsapp: boolean;
  me: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

// Who's who in the club committee, for every member. A WhatsApp button appears only for
// exco who switched it on themselves.
export default async function ExcoPage() {
  const { supabase } = await getSession();
  const { data } = await supabase.rpc("exco_directory");
  const exco = (data ?? []) as Exco[];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Our exco</h1>
          <p className="sub">The committee running the club this year, and who to ask about what.</p>
        </div>
      </div>

      {exco.length === 0 && <div className="card"><p className="small muted" style={{ margin: 0 }}>No exco listed yet.</p></div>}

      <div className="grid">
        {exco.map((p) => (
          <section className="card" key={p.id}>
            <div className="row" style={{ justifyContent: "flex-start", gap: 14 }}>
              <div className="avatar" aria-hidden="true" style={{ width: 48, height: 48, fontSize: 15 }}>{initials(p.full_name)}</div>
              <div>
                <div className="h2">{p.full_name}</div>
                <div className="small" style={{ color: "var(--gold-text)", fontWeight: 600 }}>{p.position ?? "Exco"}</div>
              </div>
            </div>
            {p.handles && <p className="small muted" style={{ margin: 0 }}>{p.handles}</p>}
            {p.show_whatsapp && p.whatsapp && (
              <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noreferrer">
                <ChatIcon />WhatsApp {p.full_name.split(/\s+/)[0]}
              </a>
            )}
            {p.me && <MyCard whatsapp={p.whatsapp ?? ""} show={p.show_whatsapp} />}
          </section>
        ))}
      </div>
    </>
  );
}
