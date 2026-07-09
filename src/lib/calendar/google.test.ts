import { describe, expect, it, vi } from "vitest";
import { fetchEvents, normalizeEvent, fetchCalendarList } from "./google";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("fetchEvents", () => {
  it("requests the given calendar's events endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    await fetchEvents(
      "tok",
      "work@group.calendar.google.com",
      "2026-07-01T00:00:00Z",
      "2026-07-31T00:00:00Z",
      fetchImpl,
    );

    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain(
      "/calendars/work%40group.calendar.google.com/events",
    );
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    await expect(
      fetchEvents("tok", "primary", "a", "b", fetchImpl),
    ).rejects.toThrow("events fetch failed: 500");
  });
});

describe("normalizeEvent", () => {
  it("tags the row with the given calendar_id", () => {
    const result = normalizeEvent(
      {
        id: "evt-1",
        summary: "Meeting",
        start: { dateTime: "2026-07-08T09:00:00+02:00" },
        end: { dateTime: "2026-07-08T10:00:00+02:00" },
      },
      "work@group.calendar.google.com",
    );
    expect(result?.calendar_id).toBe("work@group.calendar.google.com");
  });
});

describe("fetchCalendarList", () => {
  it("maps Google calendarList entries to id/summary/primary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          { id: "primary", summary: "Dominic", primary: true },
          { id: "work@group.calendar.google.com", summary: "Arbeit" },
        ],
      }),
    );
    const result = await fetchCalendarList("tok", fetchImpl);
    expect(result).toEqual([
      { id: "primary", summary: "Dominic", primary: true },
      {
        id: "work@group.calendar.google.com",
        summary: "Arbeit",
        primary: undefined,
      },
    ]);
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    await expect(fetchCalendarList("tok", fetchImpl)).rejects.toThrow(
      "calendar list fetch failed: 401",
    );
  });
});
