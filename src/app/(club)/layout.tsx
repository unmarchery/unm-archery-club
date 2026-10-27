import { ShotProvider } from "@/components/shot-provider";
import { Sidebar } from "@/components/sidebar";
import { can, getSession } from "@/lib/session";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const { profile, status } = await getSession();
  return (
    <ShotProvider>
      <div className="site">
        <Sidebar
          name={profile.full_name}
          membership={status.membership}
          isExco={status.is_exco}
          memberRequests={can(status, "manage_members") ? status.pending_member_requests : null}
        />
        <main className="main">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </ShotProvider>
  );
}
