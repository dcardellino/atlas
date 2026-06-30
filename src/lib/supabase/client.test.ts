import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "./client";

// TASK-002 verify: the client constructs from env and exposes an auth API
// without crashing (no session required).
describe("supabase browser client", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  });

  it("constructs and exposes auth.getUser", () => {
    const supabase = createClient();
    expect(typeof supabase.auth.getUser).toBe("function");
  });
});
