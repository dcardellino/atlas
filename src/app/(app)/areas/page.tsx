import AreaManager from "@/components/features/areas/AreaManager";
import { list, listOrphans } from "@/lib/areas/actions";

// Areas entry point (TASK-027/028). Fetches areas + orphaned entries server-side;
// AreaManager handles drag-reorder, create/edit and orphan reassignment client-side.
export default async function AreasPage() {
  const [areas, orphans] = await Promise.all([list(), listOrphans()]);
  return <AreaManager areas={areas} orphans={orphans} />;
}
