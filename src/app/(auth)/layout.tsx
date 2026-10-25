export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.png" alt="UNM Archery Club logo" width={360} height={260} />
        {children}
      </div>
    </main>
  );
}
