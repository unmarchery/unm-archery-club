import Link from "next/link";
import { redirect } from "next/navigation";
import { ExcoRail, type RailTool } from "@/components/exco-rail";
import { Ribbon } from "@/components/ribbon-footer";
import { ShotProvider } from "@/components/shot-provider";
import { TopBar } from "@/components/top-bar";
import { can, getOptionalSession } from "@/lib/session";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const session = await getOptionalSession();
  // Starter accounts choose their own password before anything else.
  if (session?.profile.must_change_password) redirect("/set-password?first=1");

  const status = session?.status;
  const user = session && status
    ? { name: session.profile.full_name, member: status.membership === "member", isExco: status.is_exco, single: status.single, full: status.full }
    : null;

  // The exco sidebar shows only the tools this person's permissions allow.
  const tools: RailTool[] = [];
  if (status?.is_exco) {
    const add = (on: boolean, t: RailTool) => { if (on) tools.push(t); };
    add(true, { href: "/exco", label: "Overview", icon: "home" });
    add(true, { href: "/exco/duty", label: "Duty & attendance", icon: "clipboard" });
    add(can(status, "approve_topups"), { href: "/exco/approvals", label: "Approvals", icon: "check", badge: status.pending_topups });
    add(can(status, "manage_members"), { href: "/exco/members", label: "Members", icon: "users", badge: status.pending_member_requests });
    add(can(status, "manage_members"), { href: "/exco/accounts", label: "Accounts", icon: "key" });
    add(true, { href: "/exco/sessions", label: "Sessions", icon: "calendar" });
    add(can(status, "manage_events"), { href: "/exco/events", label: "Events", icon: "star" });
    add(can(status, "manage_ranking"), { href: "/exco/ranking", label: "Ranking", icon: "trophy" });
    add(can(status, "manage_shop"), { href: "/exco/shop", label: "Shop orders", icon: "wallet" });
    add(can(status, "export_finance") || can(status, "approve_topups"), { href: "/exco/finance", label: "Finance", icon: "chart" });
    add(true, { href: "/exco/people", label: "Exco & roles", icon: "shield" });
    add(can(status, "edit_settings"), { href: "/exco/settings", label: "Settings", icon: "gear" });
  }

  return (
    <ShotProvider>
      <a className="skip" href="#content">Skip to content</a>
      {/* Drifting colour fields behind the glass sections ("liquid" layer) */}
      <div className="liquid" aria-hidden="true"><span className="blob blob--a" /><span className="blob blob--b" /><span className="blob blob--c" /></div>
      <div className="site-v2">
        <TopBar user={user} />
        {tools.length > 0 && <ExcoRail tools={tools} />}
        <main className="main-v2 gutter" id="content">
          <div className="wrap wrap-v2">{children}</div>
        </main>
        <footer className="footer">
          <Ribbon />
          <div className="footer__inner wrap-v2 gutter">
            <div>
              <Link className="brand brand--foot" href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" width={40} height={40} />
                <span>UNM Archery Club</span>
              </Link>
              <p>University of Nottingham Malaysia. Training every Tuesday and Thursday, 4–7pm, at the Sports Complex.</p>
            </div>
            <nav className="footer__nav" aria-label="Footer">
              <Link className="link" href="/sessions">Book a session</Link>
              <Link className="link" href="/shop">Shop</Link>
              <Link className="link" href="/ranking">Ranking</Link>
              <Link className="link" href="/faq">FAQ</Link>
              <Link className="link" href={user ? "/me" : "/signup"}>Join Club</Link>
            </nav>
          </div>
        </footer>
      </div>
    </ShotProvider>
  );
}
