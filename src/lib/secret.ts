import "server-only";
import { timingSafeEqual } from "node:crypto";

// Checks an "Authorization: Bearer <secret>" header against CRON_SECRET in constant time.
export function cronAuthorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
