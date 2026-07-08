import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  fetchEvents: vi.fn(),
  normalizeEvent: vi.fn(),
}));

vi.mock("./google", () => ({
  getAccessToken: mocks.getAccessToken,
  fetchEvents: mocks.fetchEvents,
  normalizeEvent: mocks.normalizeEvent,
}));

import { syncCalendarForUser } from "./sync";

function fakeDb(selectedCalendarIds: string[] | null) {
  const upserts: {
    table: string;
    values: unknown;
    options?: { onConflict?: string };
  }[] = [];
  return {
    upserts,
    from(table: string) {
      if (table === "calendar_sync_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { selected_calendar_ids: selectedCalendarIds },
                error: null,
              }),
            }),
          }),
          upsert: async (
            values: Record<string, unknown>,
            options?: { onConflict?: string },
          ) => {
            upserts.push({ table, values, options });
            return { error: null };
          },
        };
      }
      return {
        upsert: async (values: unknown, options?: { onConflict?: string }) => {
          upserts.push({ table, values, options });
          return { error: null };
        },
        delete: () => ({ eq: () => ({ lt: async () => ({ error: null }) }) }),
      };
    },
  };
}

describe("syncCalendarForUser — multi-calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockResolvedValue("tok");
    mocks.normalizeEvent.mockImplementation(
      (e: { id: string }, calendarId: string) => ({
        external_id: e.id,
        calendar_id: calendarId,
        summary: "Test",
        description: null,
        location: null,
        start_at: "2026-07-08T09:00:00.000Z",
        end_at: "2026-07-08T10:00:00.000Z",
        all_day: false,
        html_link: null,
        updated_at: null,
      }),
    );
  });

  it("defaults to ['primary'] when no selection is stored", async () => {
    const db = fakeDb(null);
    mocks.fetchEvents.mockResolvedValue([]);

    await syncCalendarForUser(db as never, "user-1");

    expect(mocks.fetchEvents).toHaveBeenCalledTimes(1);
    expect(mocks.fetchEvents.mock.calls[0][1]).toBe("primary");
  });

  it("fetches every selected calendar, tags rows with their calendar_id, and upserts with the 3-column conflict target", async () => {
    const db = fakeDb(["primary", "work@group.calendar.google.com"]);
    mocks.fetchEvents.mockImplementation(
      async (_token: string, calendarId: string) => [{ id: `evt-${calendarId}` }],
    );

    const result = await syncCalendarForUser(db as never, "user-1");

    expect(result.synced).toBe(2);
    expect(mocks.fetchEvents).toHaveBeenCalledTimes(2);
    const eventsUpsert = db.upserts.find((u) => u.table === "calendar_events");
    const rows = eventsUpsert?.values as { calendar_id: string }[];
    expect(rows.map((r) => r.calendar_id).sort()).toEqual(
      ["primary", "work@group.calendar.google.com"].sort(),
    );
    expect(eventsUpsert?.options?.onConflict).toBe(
      "user_id,calendar_id,external_id",
    );
  });
});
