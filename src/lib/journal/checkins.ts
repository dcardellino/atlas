/**
 * Pure formatting/derivation helpers for the Morning Setup and Evening Close
 * check-ins. Each check-in is saved through the existing journal `create()`
 * action as one composed `body` string, so these functions have no I/O and no
 * dependency on Supabase — they only shape strings and booleans.
 */

export type MorningAnswers = {
  feeling: string;
  top3Titles: string[];
  avoiding: string;
  gratitude: string[];
};

export function composeMorningBody(a: MorningAnswers): string {
  const gratitudeLines = a.gratitude
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .map((g, i) => `${i + 1}. ${g}`);

  return [
    `Gefühl: ${a.feeling.trim()}`,
    "Top 3:",
    ...a.top3Titles.map((t, i) => `${i + 1}. ${t}`),
    `Vermeide ich: ${a.avoiding.trim()}`,
    "Dankbar für:",
    ...gratitudeLines,
  ].join("\n");
}

export type EveningAnswers = {
  tasksDone: boolean;
  movedToday: string;
  carriesToTomorrow: string;
  remembering: string;
  tomorrowFirstTask: string;
};

export function composeEveningBody(a: EveningAnswers): string {
  return [
    `3 Aufgaben geschafft: ${a.tasksDone ? "Ja" : "Nein"}`,
    `Bewegt hat sich: ${a.movedToday.trim()}`,
    `Für morgen: ${a.carriesToTomorrow.trim()}`,
    `Nicht vergessen: ${a.remembering.trim()}`,
    `Erste Aufgabe morgen: ${a.tomorrowFirstTask.trim()}`,
  ].join("\n");
}

/** True only when there is at least one Top-3 task and all of them are done. */
export function computeTasksDone(tasks: { status: "open" | "done" }[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.status === "done");
}
