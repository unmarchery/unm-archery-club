"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error?: string; message?: string };

const DOMAIN = "@nottingham.edu.my";
const UNI_EMAIL = /^[a-z0-9._%+-]+@nottingham\.edu\.my$/;

function field(fd: FormData, name: string) {
  return String(fd.get(name) ?? "").trim();
}

// Accepts a full uni email or just the OWA username ("abcde1").
function normalizeEmail(raw: string) {
  const v = raw.trim().toLowerCase();
  return v.includes("@") ? v : `${v}${DOMAIN}`;
}

// Looks up a student's email on the server. The email is never sent to the browser.
async function emailForStudent(studentId: string) {
  if (!/^\d{8}$/.test(studentId)) return null;
  const { data } = await createAdminClient().from("profiles").select("email").eq("student_id", studentId).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

function otpError(message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) {
    return "Too many codes were sent. Please wait a few minutes and try again.";
  }
  return "We couldn't send the code. Please try again.";
}

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const studentId = field(fd, "student_id");
  const fullName = field(fd, "full_name");
  const phone = field(fd, "phone");
  const email = normalizeEmail(field(fd, "email"));

  if (!/^\d{8}$/.test(studentId)) return { error: "Student ID must be 8 digits." };
  if (fullName.length < 2) return { error: "Enter your full name as it appears on your student ID." };
  if (!/^\+?[0-9 -]{8,16}$/.test(phone)) return { error: "Enter a valid phone number." };
  if (!UNI_EMAIL.test(email)) return { error: "Use your uni email, ending in @nottingham.edu.my." };
  if (fd.get("safety") !== "on") return { error: "Please agree to follow the range safety rules." };

  const admin = createAdminClient();
  const [byId, byEmail] = await Promise.all([
    admin.from("profiles").select("id, student_id, email").eq("student_id", studentId).maybeSingle(),
    admin.from("profiles").select("id, student_id, email").eq("email", email).maybeSingle(),
  ]);
  const existing = [byId.data, byEmail.data].filter(
    (row, i, all): row is { id: string; student_id: string; email: string } =>
      Boolean(row) && all.findIndex((r) => r?.id === row?.id) === i,
  );

  for (const row of existing) {
    const { data } = await admin.auth.admin.getUserById(row.id);
    if (data.user?.email_confirmed_at) {
      return {
        error:
          row.student_id === studentId
            ? "This student ID already has an account. Log in instead, or tell the exco if it isn't yours."
            : "This email already has an account. Log in instead.",
      };
    }
    // An unfinished signup. Same details: just send a new code. Different details: clear it.
    if (!(row.student_id === studentId && row.email === email)) {
      await admin.auth.admin.deleteUser(row.id);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { student_id: studentId, full_name: fullName, phone } },
  });
  if (error) return { error: otpError(error.message) };

  redirect(`/verify?email=${encodeURIComponent(email)}&next=password`);
}

export async function verify(_: FormState, fd: FormData): Promise<FormState> {
  const token = field(fd, "code").replace(/\s/g, "");
  const next = field(fd, "next") === "password" ? "/set-password" : "/";
  const sid = field(fd, "sid");
  const email = field(fd, "email") || (sid ? ((await emailForStudent(sid)) ?? "") : "");

  if (!/^\d{6,10}$/.test(token)) return { error: "Enter the code from the email." };
  if (!email) return { error: "That code is wrong or has expired." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "That code is wrong or has expired." };

  redirect(next);
}

export async function resendCode(_: FormState, fd: FormData): Promise<FormState> {
  const sid = field(fd, "sid");
  const email = field(fd, "email") || (sid ? ((await emailForStudent(sid)) ?? "") : "");
  if (email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error && /rate limit|too many|security purposes/i.test(error.message)) return { error: otpError(error.message) };
  }
  return { message: "If the account exists, a new code is on its way." };
}

export async function setPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error: /different/i.test(error.message)
        ? "Choose a password different from your old one."
        : "We couldn't save the password. Please try again.",
    };
  }
  await supabase.rpc("password_changed");
  redirect("/");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const studentId = field(fd, "student_id");
  const password = String(fd.get("password") ?? "");
  const email = await emailForStudent(studentId);
  if (!email || !password) return { error: "Student ID or password is incorrect." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: /not confirmed/i.test(error.message)
        ? "Finish signing up first: enter the code we emailed you."
        : "Student ID or password is incorrect.",
    };
  }
  if (await starterPasswordExpired(studentId)) {
    await supabase.auth.signOut();
    return { error: "Your starter password has expired. Tap “Forgot password?” to set a new one." };
  }
  redirect("/");
}

// A starter password (first name + student ID) is easy to guess, so it only works for
// starter_password_days after the exco created the account.
async function starterPasswordExpired(studentId: string) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin.from("profiles").select("*").eq("student_id", studentId).maybeSingle(),
    admin.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (!profile?.must_change_password) return false;
  const days = Number(settings?.starter_password_days ?? 14);
  return Date.parse(profile.created_at) + days * 86_400_000 < Date.now();
}

export async function forgot(_: FormState, fd: FormData): Promise<FormState> {
  const studentId = field(fd, "student_id");
  if (!/^\d{8}$/.test(studentId)) return { error: "Student ID must be 8 digits." };

  const email = await emailForStudent(studentId);
  if (email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error && /rate limit|too many|security purposes/i.test(error.message)) return { error: otpError(error.message) };
  }
  // Same next step whether or not the ID exists, so the page doesn't reveal who has an account.
  redirect(`/verify?sid=${studentId}&next=password`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
