import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Anthropic SDK so no network call happens.
const createMock = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { classify, ClassificationError } from "./classify";

const AREAS = [
  { slug: "haus", name: "Haus" },
  { slug: "fitness", name: "Fitness" },
];

function reply(text: string) {
  createMock.mockResolvedValueOnce({ content: [{ type: "text", text }] });
}

describe("classify (TASK-013)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("parses a clean task classification", async () => {
    reply(
      '{"type":"task","title":"Öl checken","due_at":"2026-07-01T17:00:00+02:00","area_slug":"haus"}',
    );
    const out = await classify("erinnere mich morgen 17 Uhr ans Öl checken", AREAS);
    expect(out.type).toBe("task");
    expect(out.area_slug).toBe("haus");
    expect(out.due_at).toBe("2026-07-01T17:00:00+02:00");
  });

  it("strips markdown fences before parsing", async () => {
    reply(
      '```json\n{"type":"routine","title":"Mobility","due_at":null,"area_slug":"fitness"}\n```',
    );
    const out = await classify("jeden Morgen Mobility", AREAS);
    expect(out.type).toBe("routine");
    expect(out.area_slug).toBe("fitness");
  });

  it("nulls an area_slug the user does not have", async () => {
    reply('{"type":"note","title":"X","due_at":null,"area_slug":"erfundenes"}');
    const out = await classify("irgendwas", AREAS);
    expect(out.area_slug).toBeNull();
  });

  it("throws ClassificationError on non-JSON output", async () => {
    reply("Tut mir leid, das kann ich nicht.");
    await expect(classify("x", AREAS)).rejects.toBeInstanceOf(
      ClassificationError,
    );
  });

  it("throws ClassificationError on schema-invalid output", async () => {
    reply('{"type":"reminder","title":"X"}');
    await expect(classify("x", AREAS)).rejects.toBeInstanceOf(
      ClassificationError,
    );
  });
});
