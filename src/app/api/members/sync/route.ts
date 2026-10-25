import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Receives the membership list from the Google Apps Script on the form's sheet.
// Body: { rows: [{ student_id, full_name, email, level, experience }] }
// Header: Authorization: Bearer <MEMBERS_SYNC_SECRET>

type Incoming = { student_id?: unknown; full_name?: unknown; email?: unknown; level?: unknown; experience?: unknown };

function authorized(header: string | null) {
  const secret = process.env.MEMBERS_SYNC_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

const text = (v: unknown) => (v == null ? "" : String(v).trim());

// The form stores IDs as numbers ("20512034.0") and many people typed only their username.
function normalize(row: Incoming) {
  const studentId = text(row.student_id).replace(/\.0+$/, "");
  let email = text(row.email).toLowerCase();
  if (email && !email.includes("@")) email = `${email}@nottingham.edu.my`;
  return {
    student_id: studentId,
    full_name: text(row.full_name) || null,
    email: email || null,
    level: text(row.level) || null,
    experience: text(row.experience) || null,
    synced_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { rows?: Incoming[] } | null;
  if (!body || !Array.isArray(body.rows) || body.rows.length > 5000) {
    return Response.json({ error: "expected { rows: [...] } with at most 5000 rows" }, { status: 400 });
  }

  const valid = new Map<string, ReturnType<typeof normalize>>();
  const skipped: { row: number; reason: string }[] = [];
  body.rows.forEach((raw, i) => {
    const row = normalize(raw);
    if (!/^\d{8}$/.test(row.student_id)) skipped.push({ row: i + 2, reason: `student ID "${row.student_id}" is not 8 digits` });
    else valid.set(row.student_id, row);
  });

  const { error } = await createAdminClient().from("members").upsert([...valid.values()], { onConflict: "student_id" });
  if (error) return Response.json({ error: "could not save members" }, { status: 500 });

  return Response.json({ saved: valid.size, skipped });
}
