import { SignupForm } from "../forms";

export default function SignupPage() {
  return (
    <>
      <div>
        <h1 className="h1">Create an account</h1>
        <p className="sub">For UNM students. We&apos;ll email a code to your uni email to check it&apos;s you.</p>
      </div>
      <SignupForm />
    </>
  );
}
