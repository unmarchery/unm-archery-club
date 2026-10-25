import { SetPasswordForm } from "../forms";

export default function SetPasswordPage() {
  return (
    <>
      <div>
        <h1 className="h1">Set your password</h1>
        <p className="sub">From now on you&apos;ll log in with your student ID and this password.</p>
      </div>
      <SetPasswordForm />
    </>
  );
}
