import { redirect } from "next/navigation";
import { ShotProvider } from "@/components/shot-provider";
import { Sidebar } from "@/components/sidebar";
import { can, getSession } from "@/lib/session";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const { profile, status } = await getSession();
  // Starter accounts choose their own password before anything else.
  if (profile.must_change_password) redirect("/set-password?first=1");
  return (
    <ShotProvider>
      <div className="site">
        <Sidebar
          name={profile.full_name}
          membership={status.membership}
          position={status.position}
          isExco={status.is_exco}
          memberRequests={can(status, "manage_members") ? status.pending_member_requests : null}
          topupRequests={can(status, "approve_topups") ? status.pending_topups : null}
          finance={can(status, "export_finance") || can(status, "approve_topups")}
        />
        <main className="main">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </ShotProvider>
  );
}
