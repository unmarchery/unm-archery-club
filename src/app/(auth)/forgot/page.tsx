import { ShopSign } from "@/components/shop-sign";
import { ForgotForm } from "../forms";

export default function ForgotPage() {
  return (
    <>
      <div>
        <ShopSign as="h1" title="Reset" className="sign--page" />
        <p className="auth-lead">Reset your password</p>
        <p className="sub">We&apos;ll email a code to the uni email on your account.</p>
      </div>
      <ForgotForm />
    </>
  );
}
