import { ShopSign } from "@/components/shop-sign";
import { LoginForm } from "../forms";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { e } = await searchParams;
  return (
    <>
      <div>
        <ShopSign as="h1" title="Sign in" className="sign--page" />
        <p className="auth-lead">Let&apos;s get you into the Archery Range!!</p>
        <p className="sub">Only for UNM Students. Use your student ID and password.</p>
      </div>
      {e === "no-profile" && (
        <p className="error" role="alert">
          Your account has no student profile. Please ask the exco to check it.
        </p>
      )}
      <LoginForm />
    </>
  );
}
