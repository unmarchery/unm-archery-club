"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { forgot, login, resendCode, setPassword, signup, verify, type FormState } from "./actions";

const initial: FormState = {};

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="error" role="alert">{state.error}</p>;
  if (state.message) return <p className="ok" role="status">{state.message}</p>;
  return null;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { label, hint, ...input } = props;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" {...input} />
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(login, initial);
  return (
    <form action={action}>
      <Field label="Student ID" name="student_id" inputMode="numeric" autoComplete="username" pattern="\d{8}" maxLength={8} required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Feedback state={state} />
      <Submit>Log in</Submit>
      <div className="row small">
        <Link href="/forgot">Forgot password?</Link>
        <Link href="/signup">Create an account</Link>
      </div>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, initial);
  return (
    <form action={action}>
      <Field label="Student ID" name="student_id" inputMode="numeric" pattern="\d{8}" maxLength={8} required hint="8 digits, as on your student card" />
      <Field label="Full name" name="full_name" autoComplete="name" required hint="As it appears on your student ID" />
      <Field label="Phone number" name="phone" type="tel" autoComplete="tel" required />
      <Field label="Uni email" name="email" autoComplete="email" required hint="Your @nottingham.edu.my email, or just the username" />
      <label className="check">
        <input type="checkbox" name="safety" required />
        <span>I will follow the range safety rules and the exco&apos;s instructions on the range.</span>
      </label>
      <Feedback state={state} />
      <Submit>Send me a code</Submit>
      <p className="small muted">
        Already signed up? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}

export function VerifyForm({ email, sid, next }: { email?: string; sid?: string; next?: string }) {
  const [state, action] = useActionState(verify, initial);
  const [resendState, resendAction] = useActionState(resendCode, initial);
  return (
    <>
      <form action={action}>
        <input type="hidden" name="email" value={email ?? ""} />
        <input type="hidden" name="sid" value={sid ?? ""} />
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6,10}" maxLength={10} required autoFocus />
        <Feedback state={state} />
        <Submit>Continue</Submit>
      </form>
      <form action={resendAction}>
        <input type="hidden" name="email" value={email ?? ""} />
        <input type="hidden" name="sid" value={sid ?? ""} />
        <Feedback state={resendState} />
        <button className="btn btn-ghost" type="submit">Send a new code</button>
      </form>
    </>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgot, initial);
  return (
    <form action={action}>
      <Field label="Student ID" name="student_id" inputMode="numeric" pattern="\d{8}" maxLength={8} required />
      <Feedback state={state} />
      <Submit>Email me a code</Submit>
      <p className="small muted">
        Remembered it? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action] = useActionState(setPassword, initial);
  return (
    <form action={action}>
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters" />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <Feedback state={state} />
      <Submit>Save password</Submit>
    </form>
  );
}
