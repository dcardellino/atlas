"use client";

import type { BlockDraft } from "@/lib/workouts/draft";

/**
 * Rendert die Modus-spezifischen Konfigurations-Felder eines Blocks.
 * Gibt null zurück wenn mode === "straight" (keine Konfiguration nötig).
 */
export function ModeConfig({
  block,
  onPatch,
}: {
  block: BlockDraft;
  onPatch: (patch: Partial<BlockDraft>) => void;
}) {
  const cfg =
    "w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-body-sm text-on-surface outline-none focus:border-accent";
  const lbl = "font-mono text-meta uppercase tracking-label text-on-surface-muted";

  if (block.mode === "straight") return null;

  return (
    <div className="mt-3 rounded-sm bg-surface p-2">
      {block.mode === "emom" && (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={lbl}>Intervall (Sek.)</span>
            <input inputMode="numeric" value={block.interval_seconds} onChange={(e) => onPatch({ interval_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.rounds} onChange={(e) => onPatch({ rounds: e.target.value })} className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "amrap" && (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={lbl}>Cap (Sek.)</span>
            <input inputMode="numeric" value={block.duration_seconds} onChange={(e) => onPatch({ duration_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.result_rounds} onChange={(e) => onPatch({ result_rounds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>+ Wdh.</span>
            <input inputMode="numeric" value={block.result_reps} onChange={(e) => onPatch({ result_reps: e.target.value })} className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "tabata" && (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={lbl}>Work (Sek.)</span>
            <input inputMode="numeric" value={block.interval_seconds} onChange={(e) => onPatch({ interval_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Rest (Sek.)</span>
            <input inputMode="numeric" value={block.rest_seconds} onChange={(e) => onPatch({ rest_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.rounds} onChange={(e) => onPatch({ rounds: e.target.value })} className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "for_time" && (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={lbl}>Cap (Sek., opt.)</span>
            <input inputMode="numeric" value={block.duration_seconds} onChange={(e) => onPatch({ duration_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Zeit (mm:ss)</span>
            <input value={block.result_seconds} onChange={(e) => onPatch({ result_seconds: e.target.value })} placeholder="z. B. 12:30" className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "interval" && (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={lbl}>Work (Sek.)</span>
            <input inputMode="numeric" value={block.interval_seconds} onChange={(e) => onPatch({ interval_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Rest (Sek.)</span>
            <input inputMode="numeric" value={block.rest_seconds} onChange={(e) => onPatch({ rest_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.rounds} onChange={(e) => onPatch({ rounds: e.target.value })} className={cfg} />
          </label>
        </div>
      )}
    </div>
  );
}
