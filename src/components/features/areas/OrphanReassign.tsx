"use client";

import { useTransition } from "react";
import { reassignOrphan, type Area, type Orphan } from "@/lib/areas/actions";

/**
 * Reattach heimatlose Einträge (TASK-028). After an area is deleted its tasks
 * and routines keep living with `area_id = NULL`; here they can be assigned to
 * another area. The section only renders when orphans exist.
 */

function OrphanRow({ orphan, areas }: { orphan: Orphan; areas: Area[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
        {orphan.kind === "task" ? "Task" : "Routine"}
      </span>
      <span className="flex-1 truncate text-body text-on-surface">
        {orphan.title}
      </span>
      <select
        defaultValue=""
        disabled={pending}
        aria-label={`${orphan.title} einem Bereich zuordnen`}
        onChange={(e) => {
          const areaId = e.target.value;
          if (!areaId) return;
          startTransition(() => reassignOrphan(orphan.kind, orphan.id, areaId));
        }}
        className="rounded-sm border border-border bg-surface px-2 py-1 text-body-sm text-on-surface outline-none focus:border-accent disabled:opacity-60"
      >
        <option value="" disabled>
          Bereich…
        </option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </li>
  );
}

export default function OrphanReassign({
  orphans,
  areas,
}: {
  orphans: Orphan[];
  areas: Area[];
}) {
  if (orphans.length === 0 || areas.length === 0) return null;

  return (
    <section className="mt-10">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Ohne Bereich
      </p>
      <p className="mt-1 text-body-sm text-on-surface-muted">
        Diese Einträge haben keinen Bereich mehr. Ordne sie neu zu.
      </p>
      <ul className="mt-3">
        {orphans.map((o) => (
          <OrphanRow key={`${o.kind}-${o.id}`} orphan={o} areas={areas} />
        ))}
      </ul>
    </section>
  );
}
