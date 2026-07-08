import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * End-to-end capture test (TASK-025).
 *
 * Token → POST "some text" → an inbox note with raw_text preserved. AI
 * classification was removed (TASK-014 refactor) — every capture is now a
 * plain inbox note. This covers auth, validation and rate-limiting around
 * the insert. Cross-check manually via the real iOS shortcut
 * (ios-shortcut/README.md).
 */

const mocks = vi.hoisted(() => ({
  serverCreateClient: vi.fn(),
  resolveToken: vi.fn(),
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

const INSERT_RETURNS: Record<string, { id: string }> = {
  inbox_items: { id: "inbox-1" },
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
    mocks.resolveToken.mockResolvedValue({ ok: true, userId: "user-1" });
  });

  it("creates an inbox note from the raw text (no classification)", async () => {
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
    expect(body.type).toBe("note");
    expect(body.title).toBe("erinnere mich morgen 17 Uhr ans Öl checken");

    const inboxInsert = mocks.inserted.find((i) => i.table === "inbox_items");
    expect(inboxInsert?.values).toMatchObject({
      user_id: "user-1",
      raw_text: "erinnere mich morgen 17 Uhr ans Öl checken",
      source: "ios_shortcut",
      status: "classified",
      classified_type: "note",
    });
  });

  it("rejects a missing token with 401", async () => {
    mocks.resolveToken.mockResolvedValue({ ok: false, reason: "invalid" });
    const res = await POST(request({ text: "x", source: "ios_shortcut" }));
    expect(res.status).toBe(401);
  });

  it("rejects an expired token with a specific 401 (TASK-056)", async () => {
    mocks.resolveToken.mockResolvedValue({ ok: false, reason: "expired" });
    const res = await POST(
      request({ text: "x", source: "ios_shortcut" }, "Bearer atls_old"),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token expired");
  });

  it("rejects a revoked token with a specific 401 (TASK-056)", async () => {
    mocks.resolveToken.mockResolvedValue({ ok: false, reason: "revoked" });
    const res = await POST(
      request({ text: "x", source: "ios_shortcut" }, "Bearer atls_gone"),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token revoked");
  });

  it("rejects an oversized capture with 400 (TASK-056)", async () => {
    const res = await POST(
      request(
        { text: "x".repeat(5001), source: "ios_shortcut" },
        "Bearer atls_test",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed body with 400 (TASK-056)", async () => {
    const req = new Request("http://localhost/api/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer atls_test",
      },
      body: "not json{",
    }) as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 with a Retry-After header past the rate limit (TASK-056)", async () => {
    mocks.resolveToken.mockResolvedValue({ ok: true, userId: "rate-user" });
    let last!: Response;
    for (let i = 0; i < 61; i++) {
      last = (await POST(
        request({ text: "spam", source: "ios_shortcut" }, "Bearer atls_test"),
      )) as unknown as Response;
    }
    expect(last.status).toBe(429);
    expect(last.headers.get("Retry-After")).toBe("60");
  });
});
