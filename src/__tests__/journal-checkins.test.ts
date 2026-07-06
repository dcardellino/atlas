import { describe, expect, it } from "vitest";
import {
  composeMorningBody,
  composeEveningBody,
  computeTasksDone,
} from "@/lib/journal/checkins";

describe("composeMorningBody", () => {
  it("renders feeling, numbered top3, avoiding and non-empty gratitude lines", () => {
    const body = composeMorningBody({
      feeling: "Fokussiert",
      top3Titles: ["Steuererklärung", "Sport"],
      avoiding: "Die Steuererklärung",
      gratitude: ["Kaffee", "", "Sonne"],
    });
    expect(body).toBe(
      [
        "Gefühl: Fokussiert",
        "Top 3:",
        "1. Steuererklärung",
        "2. Sport",
        "Vermeide ich: Die Steuererklärung",
        "Dankbar für:",
        "1. Kaffee",
        "2. Sonne",
      ].join("\n"),
    );
  });

  it("trims surrounding whitespace on free-text fields", () => {
    const body = composeMorningBody({
      feeling: "  Ruhig  ",
      top3Titles: [],
      avoiding: "  Anrufe  ",
      gratitude: ["", "", ""],
    });
    expect(body).toContain("Gefühl: Ruhig");
    expect(body).toContain("Vermeide ich: Anrufe");
  });
});

describe("composeEveningBody", () => {
  it("renders all five fields with Ja/Nein for tasksDone", () => {
    const body = composeEveningBody({
      tasksDone: true,
      movedToday: "Projekt X vorangebracht",
      carriesToTomorrow: "Rückruf Kunde Y",
      remembering: "Ruhiger Abendspaziergang",
      tomorrowFirstTask: "E-Mails checken",
    });
    expect(body).toBe(
      [
        "3 Aufgaben geschafft: Ja",
        "Bewegt hat sich: Projekt X vorangebracht",
        "Für morgen: Rückruf Kunde Y",
        "Nicht vergessen: Ruhiger Abendspaziergang",
        "Erste Aufgabe morgen: E-Mails checken",
      ].join("\n"),
    );
  });

  it("renders Nein when tasksDone is false", () => {
    const body = composeEveningBody({
      tasksDone: false,
      movedToday: "",
      carriesToTomorrow: "",
      remembering: "",
      tomorrowFirstTask: "",
    });
    expect(body.startsWith("3 Aufgaben geschafft: Nein")).toBe(true);
  });
});

describe("computeTasksDone", () => {
  it("is true when every top-3 task is done", () => {
    expect(computeTasksDone([{ status: "done" }, { status: "done" }])).toBe(true);
  });

  it("is false when any top-3 task is still open", () => {
    expect(computeTasksDone([{ status: "done" }, { status: "open" }])).toBe(false);
  });

  it("is false when there are no top-3 tasks (nothing to confirm)", () => {
    expect(computeTasksDone([])).toBe(false);
  });
});
