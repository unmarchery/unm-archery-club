import { ShopSign } from "@/components/shop-sign";
import { SignupForm } from "../forms";

export default function SignupPage() {
  return (
    <>
      <div>
        <ShopSign as="h1" title="Sign up" className="sign--page" />
        <p className="auth-lead">Create an account</p>
        <p className="sub">For UNM students. We&apos;ll email a code to your uni email to check it&apos;s you.</p>
      </div>
      <SignupForm />
    </>
  );
}
