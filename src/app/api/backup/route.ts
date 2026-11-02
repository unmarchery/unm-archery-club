import { cronAuthorized } from "@/lib/secret";
import { createAdminClient } from "@/lib/supabase/admin";

// The weekly backup: the club's data as JSON, fetched by the Apps Script in the club
// Gmail (scripts/backup.gs) and saved to Google Drive. Needs the CRON_SECRET.
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("backup_export");
  if (error) return Response.json({ error: "could not export" }, { status: 500 });
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
