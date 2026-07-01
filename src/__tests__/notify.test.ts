import { afterEach, describe, expect, it, vi } from "vitest";

import { sendNtfy } from "@/lib/notify/ntfy";
import { normalizeEvent } from "@/lib/calendar/google";
import { syncCalendarForUser } from "@/lib/calendar/sync";

/**
 * Notifications + calendar sync (TASK-041/044, FR-009/FR-010): ntfy pushes,
 * Google event normalisation, and the sync's success/failure contract — a
 * failed sync must record last_error and leave the cache untouched.
 */

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("sendNtfy (TASK-041)", () => {
  it("POSTs the body with Title/Tags headers and returns true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    const ok = await sendNtfy(
      { title: "Erinnerung", body: "Öl checken", tags: ["bell"] },
      "https://ntfy.sh/atlas-test",
      fetchMock,
    );

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/atlas-test");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("Öl checken");
    expect(init.headers).toMatchObject({ Title: "Erinnerung", Tags: "bell" });
  });

  it("no-ops (returns false, no fetch) when the topic URL is unset", async () => {
    const fetchMock = vi.fn();
    const ok = await sendNtfy({ body: "x" }, undefined, fetchMock);
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false on a non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const ok = await sendNtfy({ body: "x" }, "https://ntfy.sh/t", fetchMock);
    expect(ok).toBe(false);
  });
});

describe("normalizeEvent (TASK-044)", () => {
  it("maps a timed event", () => {
    const n = normalizeEvent({
      id: "e1",
      summary: "Meeting",
      start: { dateTime: "2026-07-01T09:00:00Z" },
      end: { dateTime: "2026-07-01T10:00:00Z" },
    });
    expect(n).toMatchObject({
      external_id: "e1",
      summary: "Meeting",
      all_day: false,
      start_at: "2026-07-01T09:00:00.000Z",
    });
  });

  it("flags an all-day (date-only) event", () => {
    const n = normalizeEvent({ id: "e2", start: { date: "2026-07-02" }, end: { date: "2026-07-03" } });
    expect(n?.all_day).toBe(true);
    expect(n?.start_at).toBe("2026-07-02T00:00:00.000Z");
  });

  it("drops cancelled events", () => {
    expect(
      normalizeEvent({ id: "e3", status: "cancelled", start: { dateTime: "2026-07-01T11:00:00Z" } }),
    ).toBeNull();
  });
});

function makeCalendarDb() {
  const upserts: { table: string; values: unknown; options: unknown }[] = [];
  const deleteCalls: string[] = [];
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.lt = chain;
    b.upsert = (values: unknown, options: unknown) => {
      upserts.push({ table, values, options });
      return b;
    };
    b.delete = () => {
      deleteCalls.push(table);
      return b;
    };
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });
    return b;
  }
  return { upserts, deleteCalls, client: { from: builder } };
}

describe("syncCalendarForUser (TASK-044)", () => {
  const NOW = new Date("2026-07-01T08:00:00Z");

  afterEach(() => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  });

  it("upserts normalized events, prunes stale rows, and clears last_error", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "secret";
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "refresh";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: "e1", summary: "Meeting", start: { dateTime: "2026-07-01T09:00:00Z" }, end: { dateTime: "2026-07-01T10:00:00Z" } },
            { id: "e2", summary: "Urlaub", start: { date: "2026-07-02" }, end: { date: "2026-07-03" } },
            { id: "e3", status: "cancelled", start: { dateTime: "2026-07-01T11:00:00Z" } },
          ],
        }),
      );

    const { client, upserts, deleteCalls } = makeCalendarDb();
    const result = await syncCalendarForUser(
      client as never,
      "u1",
      NOW,
      fetchMock,
    );

    expect(result).toEqual({ synced: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const eventsUpsert = upserts.find((u) => u.table === "calendar_events");
    expect((eventsUpsert?.values as unknown[]).length).toBe(2);
    expect(eventsUpsert?.options).toMatchObject({ onConflict: "user_id,external_id" });
    expect(deleteCalls).toContain("calendar_events");

    const stateUpsert = upserts.find((u) => u.table === "calendar_sync_state");
    expect(stateUpsert?.values).toMatchObject({ user_id: "u1", last_error: null });
  });

  it("records last_error and preserves the cache when the sync fails", async () => {
    // No Google env → token exchange throws before any cache write.
    const fetchMock = vi.fn();
    const { client, upserts } = makeCalendarDb();

    await expect(
      syncCalendarForUser(client as never, "u1", NOW, fetchMock),
    ).rejects.toThrow();

    expect(upserts.some((u) => u.table === "calendar_events")).toBe(false);
    const stateUpsert = upserts.find((u) => u.table === "calendar_sync_state");
    expect(stateUpsert?.values).toMatchObject({ user_id: "u1" });
    expect((stateUpsert?.values as { last_error: string }).last_error).toBeTruthy();
  });
});
