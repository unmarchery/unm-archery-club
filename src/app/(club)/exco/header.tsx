"use client";

import { usePathname } from "next/navigation";
import { CrtBand } from "@/components/crt-band";

const TOOLS: [string, string][] = [
  ["/exco/duty/", "Attendance"], ["/exco/duty", "Duty"], ["/exco/approvals", "Approvals"], ["/exco/members", "Members"],
  ["/exco/accounts", "Accounts"], ["/exco/sessions", "Sessions"], ["/exco/events", "Events"], ["/exco/ranking", "Ranking"],
  ["/exco/shop", "Shop orders"], ["/exco/finance", "Finance"], ["/exco/people", "Exco & roles"], ["/exco/settings", "Settings"],
];

// The page header band: "Exco", with the tool's name in its tag. Decorative: each page keeps its own h1.
export function ExcoHeader() {
  const path = usePathname();
  const tool = TOOLS.find(([p]) => path.startsWith(p))?.[1] ?? "Exco & JUCO";
  return (
    <div className="exco-band" aria-hidden="true">
      <CrtBand title="Exco" tag={`EXCO · ${tool.toUpperCase()}`} font="slim" className="crt-band crt-band--small" />
    </div>
  );
}
