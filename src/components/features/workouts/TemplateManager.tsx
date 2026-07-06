"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { instantiateTemplate, removeTemplate } from "@/lib/workouts/actions";
import {
  WORKOUT_TYPE_LABEL,
  type WorkoutTemplate,
} from "@/lib/workouts/types";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

/**
 * Vorlagen-Verwaltung: bestehende Vorlagen auflisten, „aus Vorlage starten"
 * (instanziiert ein Workout und öffnet den Logger zum Ausfüllen) und löschen.
 * Vorlagen entstehen im Logger über „Als Vorlage speichern".
 */

const meta = "font-mono text-meta uppercase tracking-label text-on-surface-muted";

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function TemplateManager({
  templates,
}: {
  templates: WorkoutTemplate[];
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function start(id: string) {
    startTransition(async () => {
      const workoutId = await instantiateTemplate(id, todayIso());
      showToast("Workout aus Vorlage angelegt");
      router.push(`/workouts/${workoutId}/edit`);
    });
  }

  function doDelete(id: string) {
    startTransition(async () => {
      await removeTemplate(id);
      showToast("Vorlage gelöscht");
    });
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="Noch keine Vorlagen"
        hint="Speichere ein Workout im Logger über „Als Vorlage“, um es wiederzuverwenden."
      />
    );
  }

  return (
    <div className="mt-6">
      <ul>
        {templates.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 border-b border-border py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-body text-on-surface">{t.name}</p>
              <p className={meta}>
                {WORKOUT_TYPE_LABEL[t.type]} · {t.structure.length} Block
                {t.structure.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => start(t.id)}
                className="h-9 rounded-sm bg-on-surface px-3 font-mono text-meta uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
              >
                Starten
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(t.id)}
                aria-label={`${t.name} löschen`}
                className="font-mono text-meta uppercase tracking-label text-on-surface-muted transition-colors hover:text-danger"
              >
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>

      {deletingId && (
        <ConfirmDialog
          title="Vorlage löschen?"
          message="Die Vorlage wird entfernt. Bereits protokollierte Workouts bleiben erhalten."
          confirmLabel="Löschen"
          onConfirm={() => {
            doDelete(deletingId);
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
