import { DbUnavailable, PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getSettings } from "@/lib/services/settings";
import { safeLoad } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const loaded = await safeLoad(() => getSettings());
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title="Settings" />
      {loaded.ok ? <SettingsForm initial={loaded.data} /> : <DbUnavailable message={loaded.error} />}
    </div>
  );
}
