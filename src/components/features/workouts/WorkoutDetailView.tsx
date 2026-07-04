import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import {
  WORKOUT_TYPE_LABEL,
  WORKOUT_MODE_LABEL,
  type BlockWithSets,
  type WorkoutDetail,
  type WorkoutSet,
} from "@/lib/workouts/types";

/**
 * Read-only Detailansicht eines protokollierten Workouts: Kopf, dann je Block
 * der Modus + Ergebnis + die Sätze mit ihren Metriken. Bearbeiten führt zur
 * Editier-Route. Rein präsentational.
 */

const TZ = "Europe/Berlin";

function formatDate(isoDate: string): string {
  return formatInTimeZone(`${isoDate}T12:00:00Z`, TZ, "EEEE, d. MMMM yyyy");
}

function formatTime(sec: number | null): string | null {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setSummary(s: WorkoutSet): string {
  const parts: string[] = [];
  if (s.reps != null) parts.push(`${s.reps} Wdh.`);
  if (s.weight_kg != null) parts.push(`${s.weight_kg} kg`);
  if (s.distance_m != null) parts.push(`${s.distance_m} m`);
  if (s.duration_seconds != null) parts.push(`${formatTime(s.duration_seconds)} min`);
  if (s.calories != null) parts.push(`${s.calories} kcal`);
  return parts.join(" · ") || "—";
}

function blockResult(block: BlockWithSets): string | null {
  const parts: string[] = [];
  if (block.result_rounds != null)
    parts.push(`${block.result_rounds} Runden`);
  if (block.result_reps != null) parts.push(`+ ${block.result_reps} Wdh.`);
  const t = formatTime(block.result_seconds);
  if (t) parts.push(t);
  return parts.length ? parts.join(" ") : null;
}

function blockConfig(block: BlockWithSets): string | null {
  const parts: string[] = [];
  if (block.mode === "emom" && block.interval_seconds)
    parts.push(`alle ${block.interval_seconds}s`);
  if (block.mode === "tabata")
    parts.push(
      `${block.interval_seconds ?? 20}/${block.rest_seconds ?? 10} × ${block.rounds ?? 8}`,
    );
  if ((block.mode === "amrap" || block.mode === "for_time") && block.duration_seconds)
    parts.push(`Cap ${formatTime(block.duration_seconds)}`);
  if (block.mode === "interval" && block.interval_seconds)
    parts.push(`${block.interval_seconds}/${block.rest_seconds ?? 0}s × ${block.rounds ?? "?"}`);
  return parts.length ? parts.join(" · ") : null;
}

const label =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const meta =
  "font-mono text-meta uppercase tracking-label text-on-surface-muted";

export default function WorkoutDetailView({
  workout,
}: {
  workout: WorkoutDetail;
}) {
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={label}>Training</p>
          <h1 className="mt-1 font-serif text-display text-on-surface">
            {workout.title || WORKOUT_TYPE_LABEL[workout.type]}
          </h1>
          <p className={`mt-1 ${meta}`}>{formatDate(workout.performed_on)}</p>
        </div>
        <Link
          href={`/workouts/${workout.id}/edit`}
          className="h-11 shrink-0 rounded-sm border border-border bg-surface-raised px-4 font-mono text-label uppercase leading-[44px] tracking-label text-on-surface transition-colors hover:border-accent hover:text-accent"
        >
          Bearbeiten
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <span className={meta}>{WORKOUT_TYPE_LABEL[workout.type]}</span>
        {workout.perceived_effort != null && (
          <span className={meta}>RPE {workout.perceived_effort}</span>
        )}
      </div>

      {workout.notes && (
        <p className="mt-3 text-body text-on-surface-muted">{workout.notes}</p>
      )}

      <div className="mt-6 space-y-5">
        {workout.blocks.map((block, i) => {
          const cfg = blockConfig(block);
          const result = blockResult(block);
          return (
            <div key={block.id} className="border-t border-border pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-subtitle font-serif text-on-surface">
                  {block.name || `Block ${i + 1}`}
                </p>
                <span className={meta}>{WORKOUT_MODE_LABEL[block.mode]}</span>
              </div>
              {(cfg || result) && (
                <p className={`mt-1 ${meta}`}>
                  {[cfg, result].filter(Boolean).join("  ·  ")}
                </p>
              )}
              <ul className="mt-2">
                {block.sets.map((s, si) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between gap-3 border-b border-border py-1.5"
                  >
                    <span className="min-w-0 truncate text-body-sm text-on-surface">
                      <span className="mr-2 font-mono text-meta text-on-surface-muted">
                        {si + 1}
                      </span>
                      {s.exercise_name}
                      {s.is_warmup && (
                        <span className="ml-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
                          Aufw.
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-body-sm text-on-surface-muted">
                      {setSummary(s)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
