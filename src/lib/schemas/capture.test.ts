import { describe, expect, it } from "vitest";
import { CaptureInputSchema } from "./capture";

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
