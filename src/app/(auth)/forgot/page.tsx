import { ForgotForm } from "../forms";

export default function ForgotPage() {
  return (
    <>
      <div>
        <h1 className="h1">Reset your password</h1>
        <p className="sub">We&apos;ll email a code to the uni email on your account.</p>
      </div>
      <ForgotForm />
    </>
  );
}
