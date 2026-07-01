import "server-only";

/**
 * Google Calendar read-only access via native fetch (TASK-044, FR-010). No SDK:
 * a long-lived refresh token (server-side env) is exchanged for a short-lived
 * access token, then the primary calendar's events are listed. Token exchange,
 * event fetch and normalisation are separated so they can be unit-tested with a
 * stub fetch.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export type NormalizedEvent = {
  external_id: string;
  calendar_id: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  html_link: string | null;
  updated_at: string | null;
};

/** Exchange the long-lived refresh token for a short-lived access token. */
export async function getAccessToken(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar not configured");
  }

  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("no access_token in token response");
  return json.access_token;
}

/** List primary-calendar events within [timeMin, timeMax), expanded to instances. */
export async function fetchEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleEvent[]> {
  const url = new URL(EVENTS_URL);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const res = await fetchImpl(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`events fetch failed: ${res.status}`);
  const json = (await res.json()) as { items?: GoogleEvent[] };
  return json.items ?? [];
}

/** Normalise a Google event to a cache row. Returns null if unusable/cancelled. */
export function normalizeEvent(e: GoogleEvent): NormalizedEvent | null {
  if (e.status === "cancelled" || !e.id) return null;

  const allDay = Boolean(e.start?.date && !e.start?.dateTime);
  const startRaw = e.start?.dateTime ?? e.start?.date;
  if (!startRaw) return null;

  const toIso = (value: string, isDate: boolean) =>
    isDate ? new Date(`${value}T00:00:00Z`).toISOString() : new Date(value).toISOString();

  const endRaw = e.end?.dateTime ?? e.end?.date ?? null;

  return {
    external_id: e.id,
    calendar_id: "primary",
    summary: e.summary ?? null,
    description: e.description ?? null,
    location: e.location ?? null,
    start_at: toIso(startRaw, allDay),
    end_at: endRaw ? toIso(endRaw, allDay) : null,
    all_day: allDay,
    html_link: e.htmlLink ?? null,
    updated_at: e.updated ?? null,
  };
}
