import { describe, expect, it } from "vitest";
import {
  TaskFormSchema,
  AreaFormSchema,
  RoutineFormSchema,
  JournalFormSchema,
  fieldErrors,
} from "./forms";

describe("form schemas (TASK-052)", () => {
  it("rejects an empty task title with a field error", () => {
    const errs = fieldErrors(TaskFormSchema, { title: "   " });
    expect(errs).toEqual({ title: "Pflichtfeld." });
  });

  it("accepts a valid task", () => {
    expect(fieldErrors(TaskFormSchema, { title: "Öl checken" })).toBeNull();
  });

  it("requires an area name", () => {
    expect(fieldErrors(AreaFormSchema, { name: "" })).toEqual({
      name: "Pflichtfeld.",
    });
  });

  it("rejects a malformed routine time and non-positive duration", () => {
    const errs = fieldErrors(RoutineFormSchema, {
      name: "Mobility",
      time_of_day: "morning",
      specific_time: "25:99",
      duration_days: "0",
    });
    expect(errs?.specific_time).toBe("Ungültige Uhrzeit.");
    expect(errs?.duration_days).toBe("Mindestens 1 Tag.");
  });

  it("treats empty optional routine fields as valid", () => {
    expect(
      fieldErrors(RoutineFormSchema, {
        name: "Mobility",
        time_of_day: "anytime",
        specific_time: "",
        duration_days: "",
      }),
    ).toBeNull();
  });

  it("rejects an empty journal body", () => {
    expect(fieldErrors(JournalFormSchema, { body: "  " })).toEqual({
      body: "Schreib oder sprich zuerst etwas.",
    });
  });
});
