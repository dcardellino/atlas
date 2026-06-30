import { describe, expect, it } from "vitest";
import { CaptureInputSchema, ClassificationSchema } from "./capture";

// TASK-012 verify: valid inputs pass, invalid inputs are rejected.
describe("CaptureInputSchema", () => {
  it("accepts a valid capture", () => {
    const parsed = CaptureInputSchema.parse({
      text: "  Öl checken  ",
      source: "ios_shortcut",
    });
    expect(parsed.text).toBe("Öl checken"); // trimmed
    expect(parsed.source).toBe("ios_shortcut");
  });

  it("rejects empty / whitespace-only text", () => {
    expect(() =>
      CaptureInputSchema.parse({ text: "   ", source: "pwa_text" }),
    ).toThrow();
  });

  it("rejects an unknown source", () => {
    expect(() =>
      CaptureInputSchema.parse({ text: "hi", source: "carrier_pigeon" }),
    ).toThrow();
  });
});

describe("ClassificationSchema", () => {
  it("accepts a full classification", () => {
    const parsed = ClassificationSchema.parse({
      type: "task",
      title: "Öl beim Auto checken",
      due_at: "2026-07-01T15:00:00.000Z",
      area_slug: "haus",
    });
    expect(parsed.type).toBe("task");
    expect(parsed.area_slug).toBe("haus");
  });

  it("accepts a classification without due_at / area_slug", () => {
    const parsed = ClassificationSchema.parse({
      type: "note",
      title: "Idee festhalten",
      due_at: null,
      area_slug: null,
    });
    expect(parsed.due_at).toBeNull();
    expect(parsed.area_slug).toBeNull();
  });

  it("rejects an invalid type", () => {
    expect(() =>
      ClassificationSchema.parse({ type: "reminder", title: "x" }),
    ).toThrow();
  });

  it("rejects a non-ISO due_at", () => {
    expect(() =>
      ClassificationSchema.parse({
        type: "task",
        title: "x",
        due_at: "morgen 17 Uhr",
      }),
    ).toThrow();
  });
});
