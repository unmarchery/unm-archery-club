import "server-only";
import nodemailer from "nodemailer";
import { passesLabel } from "./format";
import { createAdminClient } from "./supabase/admin";

// Top-up emails go out through the club Gmail (an app password, like the Supabase login
// emails). Without GMAIL_USER and GMAIL_APP_PASSWORD set, nothing is sent and the site
// works as before. Callers run these inside after(), so a slow or failed email never
// holds up or breaks the button that triggered it.
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

// Names come from the signup form, so keep them to one plain line in subjects.
const oneLine = (text: string) => text.replace(/[\r\n\t]+/g, " ").trim();

async function send(message: { to?: string; bcc?: string[]; subject: string; text: string }) {
  if (!user || !pass) return;
  try {
    const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    await transport.sendMail({ from: { name: "UNM Archery Club", address: user }, ...message });
  } catch (e) {
    console.error("Email failed:", (e as Error).message);
  }
}

type NewTopup = {
  number: number;
  amount: number;
  full_name: string;
  student_id: string;
  single: number;
  full: number;
  method: "qr" | "cash";
  bankRef: string | null;
};

// "New top-up waiting" to everyone who can approve, except the archer themselves.
export async function emailApprovers(t: NewTopup, archerId: string, site: string) {
  if (!user || !pass) return;
  const { data, error } = await createAdminClient().rpc("topup_alert_emails", { p_exclude: archerId });
  if (error) return console.error("Approver list failed:", error.message);
  const to = ((data ?? []) as { email: string }[]).map((r) => r.email);
  if (to.length === 0) return;
  const how = t.method === "qr" ? `DuitNow QR, bank reference ${t.bankRef}` : "cash";
  await send({
    to: user,
    bcc: to,
    subject: `New top-up #${t.number}: RM${t.amount} from ${oneLine(t.full_name)}`,
    text:
      `${t.full_name} (${t.student_id}) sent a top-up:\n` +
      `${passesLabel(t.single, t.full)}, RM${t.amount}, ${how}.\n\n` +
      `Check the payment, then approve or reject it:\n${site}/exco/approvals\n`,
  });
}

type Decision = {
  email: string;
  full_name: string;
  number: number;
  amount: number;
  single_qty: number;
  full_qty: number;
  approved: boolean;
  reason: string | null;
};

// "Passes added" or "Not approved: reason" to the archer.
export async function emailArcher(d: Decision, site: string) {
  const first = oneLine(d.full_name).split(" ")[0] || "there";
  await send(
    d.approved
      ? {
          to: d.email,
          subject: `Your top-up #${d.number} is approved`,
          text:
            `Hi ${first},\n\nYour payment of RM${d.amount} was checked, and ${passesLabel(d.single_qty, d.full_qty)} ` +
            `pass${d.single_qty + d.full_qty === 1 ? " is" : "es are"} now in your account.\n\nBook a session: ${site}/sessions\n`,
        }
      : {
          to: d.email,
          subject: `Your top-up #${d.number} wasn't approved`,
          text:
            `Hi ${first},\n\nYour top-up of RM${d.amount} wasn't approved.\nReason: ${d.reason ?? "none given"}\n\n` +
            `If you think this is a mistake, ask in the finance WhatsApp group, or send it again with the right details:\n${site}/top-up\n`,
        },
  );
}

// The site's address for links in emails, from the request.
export function siteFrom(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `https://${host}` : "";
}

type NoShow = { email: string; full_name: string; noshows: number; warned: boolean; banned_until: string | null; ban_after: number };

const ordinal = (k: number) => (k % 10 === 1 && k !== 11 ? `${k}st` : k % 10 === 2 && k !== 12 ? `${k}nd` : k % 10 === 3 && k !== 13 ? `${k}rd` : `${k}th`);

// The 2nd no-show is a warning; the one that brings a ban says until when.
export async function emailNoShow(n: NoShow, site: string) {
  const first = oneLine(n.full_name).split(" ")[0] || "there";
  const until = n.banned_until
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", weekday: "long", day: "numeric", month: "long" }).format(new Date(n.banned_until))
    : "";
  await send(
    n.banned_until
      ? {
          to: n.email,
          subject: "You're paused from booking",
          text:
            `Hi ${first},\n\nYou were marked as a no-show ${n.noshows} times, so you can't book sessions until ${until}. ` +
            `Your bookings in that time were cancelled, and any passes for them were returned.\n\n` +
            `If this is a mistake, contact the exco: ${site}/exco\n`,
        }
      : {
          to: n.email,
          subject: "No-show warning",
          text:
            `Hi ${first},\n\nYou were marked as a no-show for a session you booked. This is your ${ordinal(n.noshows)} no-show; ` +
            `at ${n.ban_after} you'll be paused from booking for a while.\n\nIf you can't come, please cancel in time so someone else can take the spot: ${site}/sessions\n`,
        },
  );
}
