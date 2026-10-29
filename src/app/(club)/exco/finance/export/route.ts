import { TIMEZONE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  number: number;
  created_at: string;
  decided_at: string;
  student_id: string;
  full_name: string;
  single_qty: number;
  full_qty: number;
  amount: number;
  method: "qr" | "cash";
  bank_ref: string | null;
  approved_by: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const stamp = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// One CSV cell. Quotes are doubled, and a leading = + - @ is defused so a name typed
// at signup can't run as a formula when the file is opened in Excel.
function cell(value: string | number | null) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Finance history as a CSV that opens in Excel, for anyone with export_finance.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_permission: "export_finance" });
  if (!allowed) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || to < from) return new Response("Choose a valid date range.", { status: 400 });

  const { data, error } = await supabase.rpc("finance_report", { p_from: from, p_to: to });
  if (error) return new Response("Couldn't load the finance history.", { status: 500 });
  const rows = ((data as { rows?: Row[] } | null)?.rows ?? []).slice().reverse(); // oldest first, like a ledger

  const header = ["Approved", "Top-up #", "Student ID", "Name", "Single passes", "Full-day passes", "Amount (RM)", "Method", "Bank reference", "Approved by", "Requested"];
  const lines = rows.map((r) =>
    [
      stamp.format(new Date(r.decided_at)).replace(",", ""),
      r.number,
      r.student_id,
      r.full_name,
      r.single_qty,
      r.full_qty,
      r.amount,
      r.method === "qr" ? "DuitNow QR" : "Cash",
      r.bank_ref,
      r.approved_by,
      stamp.format(new Date(r.created_at)).replace(",", ""),
    ].map(cell).join(","),
  );
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const csv = "﻿" + [header.map(cell).join(","), ...lines, "", [cell("Total"), "", "", "", "", "", cell(total)].join(",")].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="unm-archery-finance-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
