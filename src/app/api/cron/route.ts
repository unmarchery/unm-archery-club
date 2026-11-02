import { flushOutbox, siteFrom } from "@/lib/email";
import { cronAuthorized } from "@/lib/secret";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every evening by the GitHub workflow: queues tomorrow's reminders, then sends
// everything waiting in the email queue. Needs the CRON_SECRET as a Bearer token.
export async function POST(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data: queued, error } = await createAdminClient().rpc("queue_reminders");
  if (error) return Response.json({ error: "could not queue reminders" }, { status: 500 });
  const sent = await flushOutbox(siteFrom(request.headers));
  return Response.json({ reminders_queued: queued, emails_sent: sent });
}
