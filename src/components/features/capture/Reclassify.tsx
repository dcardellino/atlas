"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reclassify } from "@/lib/inbox/reclassify";
import { useToast } from "@/components/ui/Toast";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import type { ClassificationType } from "@/lib/schemas/capture";
import type { AreaOption } from "@/components/features/tasks/TaskEditor";

/**
 * Reclassification control (TASK-053, FR-012). Lets the user re-file a capture
 * the AI got wrong — pick a new type and area from the recently-captured list.
 * The correction is logged server-side for the correction-rate metric. Tone stays
 * sachlich (Vision § Voice & Tone); the rust accent marks only the active choice.
 */

const TYPE_OPTIONS: { value: ClassificationType; label: string }[] = [
  { value: "task", label: "Aufgabe" },
  { value: "note", label: "Notiz" },
  { value: "journal", label: "Journal" },
  { value: "routine", label: "Routine" },
];

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const fieldInput =
  "mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-accent";

export default function Reclassify({
  item,
  areas,
}: {
  item: { id: string; raw_text: string; classified_type: string | null };
  areas: AreaOption[];
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ClassificationType>(
    (item.classified_type as ClassificationType) ?? "note",
  );
  const [areaId, setAreaId] = useState("");
  const [pending, startTransition] = useTransition();
  useEscapeKey(() => setOpen(false));

  function save() {
    startTransition(async () => {
      await reclassify({ inboxId: item.id, toType: type, areaId: areaId || null });
      setOpen(false);
      router.refresh();
      showToast("Umsortiert");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Umsortieren"
        className="font-mono text-meta uppercase tracking-label text-on-surface-muted transition-colors hover:text-accent"
      >
        Umsortieren
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-on-surface/30 px-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Eintrag umsortieren"
            className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={fieldLabel}>Umsortieren</p>
            <p className="mt-2 line-clamp-2 text-body-sm text-on-surface-muted">
              {item.raw_text}
            </p>

            <div className="mt-4">
              <span className={fieldLabel}>Typ</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={type === o.value}
                    onClick={() => setType(o.value)}
                    className={`rounded-sm px-3 py-1 font-mono text-meta uppercase tracking-label ${
                      type === o.value
                        ? "bg-on-surface text-surface"
                        : "bg-surface text-on-surface-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block">
              <span className={fieldLabel}>Bereich</span>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className={fieldInput}
              >
                <option value="">Unzugeordnet</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 rounded-sm bg-surface px-4 font-mono text-label uppercase tracking-label text-on-surface"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
              >
                {pending ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
