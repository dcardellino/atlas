import SettingsHeader from "@/components/features/settings/SettingsHeader";
import AreaManager from "@/components/features/areas/AreaManager";
import { list, listOrphans } from "@/lib/areas/actions";

export default async function SettingsAreasPage() {
  const [areas, orphans] = await Promise.all([list(), listOrphans()]);
  return (
    <section>
      <SettingsHeader title="Areas" />
      <AreaManager areas={areas} orphans={orphans} />
    </section>
  );
}
