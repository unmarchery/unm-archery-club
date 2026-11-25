import { ShopSign } from "@/components/shop-sign";
import { SetPasswordForm } from "../forms";

export default async function SetPasswordPage({ searchParams }: PageProps<"/set-password">) {
  const { first } = await searchParams;
  return (
    <>
      <div>
        <ShopSign as="h1" title="Password" className="sign--page" />
        <p className="auth-lead">{first ? "Welcome! Choose your password" : "Set your password"}</p>
        <p className="sub">
          {first
            ? "Your starter password only works once. Pick your own; from now on you'll log in with your student ID and this password."
            : "From now on you'll log in with your student ID and this password."}
        </p>
      </div>
      <SetPasswordForm />
    </>
  );
}
