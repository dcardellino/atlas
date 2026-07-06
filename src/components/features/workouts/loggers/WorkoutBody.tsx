"use client";

import type { WorkoutDraft } from "../useWorkoutDraft";
import { StrengthLogger } from "./StrengthLogger";
import { HyroxLogger } from "./HyroxLogger";
import { CardioLogger } from "./CardioLogger";
import { BlockListLogger } from "./BlockListLogger";

/**
 * Dispatcht basierend auf draft.type an den passenden Body-Logger.
 * WOD → BlockListLogger(amrap), other → BlockListLogger(straight).
 * Jeder Body bringt seinen eigenen oberen Abstand mit (mt-8).
 */
export function WorkoutBody({ draft }: { draft: WorkoutDraft }) {
  switch (draft.type) {
    case "strength":
      return <StrengthLogger draft={draft} />;
    case "hyrox":
      return <HyroxLogger draft={draft} />;
    case "cardio":
      return <CardioLogger draft={draft} />;
    case "wod":
      return <BlockListLogger draft={draft} defaultMode="amrap" />;
    default:
      // "other" und künftige Typen: generische Block-Liste
      return <BlockListLogger draft={draft} defaultMode="straight" />;
  }
}
