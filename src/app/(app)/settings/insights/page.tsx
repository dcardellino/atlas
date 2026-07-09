import SettingsHeader from "@/components/features/settings/SettingsHeader";
import MetricsPanel from "@/components/features/settings/MetricsPanel";
import { metricsSummary } from "@/lib/metrics/summary";

export default async function SettingsInsightsPage() {
  const metrics = await metricsSummary();
  return (
    <section>
      <SettingsHeader title="Insights" />
      <MetricsPanel data={metrics} />
    </section>
  );
}
