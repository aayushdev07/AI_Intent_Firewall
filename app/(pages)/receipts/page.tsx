import { PageHeader } from "@/components/layout/page-header";
import { ReceiptsExplorer } from "@/components/receipts/receipts-explorer";
import { defaultSettings, getSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({ searchParams }: { searchParams: { q?: string } }) {
  const { experience } = await getSettings().catch(() => defaultSettings());
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Action receipts"
        description="A record of every step the assistant tried: what it was, whether it happened, and why. Blocked steps are recorded too."
      />
      <ReceiptsExplorer initialQuery={searchParams.q ?? ""} showWorking={experience.showWorking} />
    </div>
  );
}
