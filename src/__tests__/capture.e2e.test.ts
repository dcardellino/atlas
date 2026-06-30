import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * End-to-end magic-moment test (TASK-025).
 *
 * Token → POST "erinnere mich morgen 17 Uhr ans Öl checken" → a task in the
 * "haus" area with the correct due_at. The Anthropic and Supabase boundaries are
 * mocked; everything in between (auth → inbox → classify → target row → inbox
 * update → response) runs for real. Cross-check manually via the real iOS
 * shortcut (ios-shortcut/README.md).
 */

const mocks = vi.hoisted(() => ({
  serverCreateClient: vi.fn(),
  resolveToken: vi.fn(),
  classify: vi.fn(),
  inserted: [] as { table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.serverCreateClient,
}));

vi.mock("@/lib/auth/token", () => ({
  resolveToken: mocks.resolveToken,
  bearerFromHeader: (h: string | null) =>
    h ? (/^Bearer\s+(.+)$/i.exec(h.trim())?.[1] ?? null) : null,
}));

vi.mock("@/lib/ai/classify", () => ({
  classify: mocks.classify,
  CLASSIFY_MODEL: "claude-haiku-4-5",
  ClassificationError: class extends Error {},
}));

const AREAS = [{ id: "area-haus", slug: "haus", name: "Haus" }];
const INSERT_RETURNS: Record<string, { id: string }> = {
  inbox_items: { id: "inbox-1" },
  tasks: { id: "task-1" },
  routines: { id: "routine-1" },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          mocks.inserted.push({ table, values });
          return {
            select: () => ({
              single: async () => ({
                data: INSERT_RETURNS[table] ?? null,
                error: null,
              }),
            }),
          };
        },
        select() {
          const r = {
            eq: () => r,
            then: (res: (v: unknown) => void) =>
              res({ data: table === "areas" ? AREAS : [], error: null }),
          };
          return r;
        },
        update(values: Record<string, unknown>) {
          mocks.inserted.push({ table: `${table}:update`, values });
          const r = {
            eq: () => r,
            then: (res: (v: unknown) => void) =>
              res({ data: null, error: null }),
          };
          return r;
        },
      };
    },
  }),
}));

import { POST } from "@/app/api/capture/route";

function request(body: unknown, auth?: string): NextRequest {
  return new Request("http://localhost/api/capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/capture (magic moment)", () => {
  beforeEach(() => {
    mocks.inserted.length = 0;
    mocks.serverCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    mocks.resolveToken.mockResolvedValue("user-1");
    mocks.classify.mockResolvedValue({
      type: "task",
      title: "Öl checken",
      due_at: "2026-07-01T17:00:00+02:00",
      area_slug: "haus",
    });
  });

  it("token + spoken sentence → task in Haus with due_at", async () => {
    const res = await POST(
      request(
        {
          text: "erinnere mich morgen 17 Uhr ans Öl checken",
          source: "ios_shortcut",
        },
        "Bearer atls_test",
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("task");
    expect(body.title).toBe("Öl checken");
    expect(body.area).toEqual({ id: "area-haus", name: "Haus" });
    expect(body.due_at).toBe("2026-07-01T17:00:00+02:00");

    const taskInsert = mocks.inserted.find((i) => i.table === "tasks");
    expect(taskInsert?.values).toMatchObject({
      user_id: "user-1",
      area_id: "area-haus",
      title: "Öl checken",
      due_at: "2026-07-01T17:00:00+02:00",
    });
  });

  it("classifies a recurring habit into a routine, not a task (TASK-035)", async () => {
    mocks.classify.mockResolvedValue({
      type: "routine",
      title: "5 Minuten Mobility",
      due_at: null,
      area_slug: "haus",
    });

    const res = await POST(
      request(
        {
          text: "jeden Morgen 5 Minuten Mobility machen",
          source: "ios_shortcut",
        },
        "Bearer atls_test",
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("routine");

    // A routine row was created; no task row.
    const routineInsert = mocks.inserted.find((i) => i.table === "routines");
    expect(routineInsert?.values).toMatchObject({
      user_id: "user-1",
      area_id: "area-haus",
      name: "5 Minuten Mobility",
      time_of_day: "anytime",
    });
    expect(mocks.inserted.some((i) => i.table === "tasks")).toBe(false);
  });

  it("rejects a missing token with 401", async () => {
    mocks.resolveToken.mockResolvedValue(null);
    const res = await POST(request({ text: "x", source: "ios_shortcut" }));
    expect(res.status).toBe(401);
  });

  it("falls back to a 207 inbox note when classification fails", async () => {
    mocks.classify.mockRejectedValue(new Error("ai down"));
    const res = await POST(
      request(
        { text: "irgendwas", source: "ios_shortcut" },
        "Bearer atls_test",
      ),
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.type).toBe("note");
    // The raw capture was still persisted (no data loss).
    expect(mocks.inserted.some((i) => i.table === "inbox_items")).toBe(true);
  });
});
