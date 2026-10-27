import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uses the secret key and bypasses Row Level Security. Server code only, and only for
// the few jobs a signed-out visitor needs (finding a student's email at login) or the
// member sync. Never return what it reads to the browser unfiltered.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
