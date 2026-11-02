import { notFound } from "next/navigation";
import { can, getSession } from "@/lib/session";
import { SettingsForm, type Settings } from "./form";

// Every club rule in one form, for people with edit_settings.
export default async function SettingsPage() {
  const { supabase, status } = await getSession();
  if (!can(status, "edit_settings")) notFound();
  const { data } = await supabase.from("settings").select("*").single<Settings>();
  if (!data) notFound();
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Settings</h1>
          <p className="sub">The club&apos;s rules. Changes apply straight away, except training days and times, which start from the next week that has no sessions yet.</p>
        </div>
      </div>
      <SettingsForm s={data} />
    </>
  );
}
