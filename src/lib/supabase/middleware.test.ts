import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the Supabase SSR client so getUser is controllable and no network runs.
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

import { updateSession } from "./middleware";

function locationOf(res: Response): string | null {
  return res.headers.get("location");
}

describe("updateSession auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  });

  it("does not redirect self-authenticating API routes when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest("https://atlas.app/api/cron/reminders");
    const res = await updateSession(req);
    // Cron routes carry a Bearer token, not a session cookie; the middleware
    // must let them through so the route's own auth can run.
    expect(locationOf(res)).toBeNull();
  });

  it("still redirects unauthenticated users on private page routes", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest("https://atlas.app/today");
    const res = await updateSession(req);
    expect(locationOf(res)).toContain("/login");
  });

  it("lets authenticated users through on private routes", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = new NextRequest("https://atlas.app/today");
    const res = await updateSession(req);
    expect(locationOf(res)).toBeNull();
  });
});
