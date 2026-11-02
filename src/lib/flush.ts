import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { flushOutbox, siteFrom } from "./email";

// After an action that may have queued emails (a cancelled booking that gave someone a
// waitlist spot, a cancelled session), send them once the response has gone out.
export async function flushSoon() {
  const site = siteFrom(await headers());
  after(() => flushOutbox(site));
}
