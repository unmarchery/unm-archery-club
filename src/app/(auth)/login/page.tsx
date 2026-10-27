import { LoginForm } from "../forms";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { e } = await searchParams;
  return (
    <>
      <div>
        <h1 className="h1">Log in</h1>
        <p className="sub">Use your student ID and password.</p>
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
