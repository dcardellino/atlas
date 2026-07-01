import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/journal/media", () => ({
  signedUrlMap: vi.fn(
    async (paths: string[]) => new Map(paths.map((p) => [p, `url:${p}`])),
  ),
}));

import { create, attachMedia, listFeed, remove } from "@/lib/journal/actions";

/**
 * Journal actions (TASK-037/039, FR-008): the entry is persisted independently
 * of media (so a photo failure can't lose text), the feed groups media under
 * entries with resolved URLs, and delete cleans up Storage.
 */

type ClientOpts = {
  tableData?: Record<string, unknown[]>;
  singleData?: unknown;
};

function makeClient(opts: ClientOpts = {}) {
  const inserts: { table: string; values: unknown }[] = [];
  const deletes: { table: string }[] = [];
  const removed: { bucket: string; paths: string[] }[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.in = chain;
    b.order = chain;
    b.insert = (values: unknown) => {
      inserts.push({ table, values });
      return b;
    };
    b.delete = () => {
      deletes.push({ table });
      return b;
    };
    b.single = async () => ({ data: opts.singleData ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: opts.tableData?.[table] ?? null, error: null });
    return b;
  }

  return {
    inserts,
    deletes,
    removed,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => builder(table),
      storage: {
        from: (bucket: string) => ({
          remove: async (paths: string[]) => {
            removed.push({ bucket, paths });
            return { data: null, error: null };
          },
        }),
      },
    },
  };
}

describe("journal actions (TASK-037/039)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create persists the entry with trimmed body + user_id", async () => {
    const { client, inserts } = makeClient({
      singleData: {
        id: "j1",
        area_id: null,
        body: "Guter Tag",
        entry_date: "2026-07-01",
        source: "pwa_text",
        created_at: "2026-07-01T10:00:00Z",
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const entry = await create({ body: "  Guter Tag  ", source: "pwa_voice" });

    expect(entry.id).toBe("j1");
    const ins = inserts.find((i) => i.table === "journal_entries");
    expect(ins?.values).toMatchObject({
      user_id: "u1",
      body: "Guter Tag",
      area_id: null,
      source: "pwa_voice",
    });
  });

  it("attachMedia is a no-op for an empty list (photo failure ≠ broken entry)", async () => {
    const { client, inserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await attachMedia("j1", []);

    expect(inserts).toHaveLength(0);
  });

  it("attachMedia records media rows with the owner + default type", async () => {
    const { client, inserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await attachMedia("j1", [{ storage_path: "u1/j1/a.jpg" }]);

    const ins = inserts.find((i) => i.table === "journal_media");
    expect(ins?.values).toMatchObject([
      {
        user_id: "u1",
        journal_entry_id: "j1",
        storage_path: "u1/j1/a.jpg",
        media_type: "image",
      },
    ]);
  });

  it("listFeed groups media under entries with resolved URLs + area name", async () => {
    const { client } = makeClient({
      tableData: {
        journal_entries: [
          {
            id: "j1",
            area_id: "a1",
            body: "Eintrag 1",
            entry_date: "2026-07-01",
            source: "pwa_text",
            created_at: "2026-07-01T10:00:00Z",
          },
          {
            id: "j2",
            area_id: null,
            body: "Eintrag 2",
            entry_date: "2026-06-30",
            source: "pwa_text",
            created_at: "2026-06-30T10:00:00Z",
          },
        ],
        areas: [{ id: "a1", name: "Fitness" }],
        journal_media: [
          {
            id: "m1",
            journal_entry_id: "j1",
            storage_path: "u1/j1/a.jpg",
            media_type: "image",
            created_at: "2026-07-01T10:01:00Z",
          },
        ],
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const feed = await listFeed();

    expect(feed).toHaveLength(2);
    const first = feed.find((f) => f.id === "j1");
    expect(first?.area_name).toBe("Fitness");
    expect(first?.media).toEqual([
      { id: "m1", url: "url:u1/j1/a.jpg", media_type: "image" },
    ]);
    // Entry without an area / media stays clean.
    const second = feed.find((f) => f.id === "j2");
    expect(second?.area_name).toBeNull();
    expect(second?.media).toEqual([]);
  });

  it("remove deletes Storage objects then the entry", async () => {
    const { client, deletes, removed } = makeClient({
      tableData: { journal_media: [{ storage_path: "u1/j1/a.jpg" }] },
    });
    mocks.createClient.mockResolvedValue(client);

    await remove("j1");

    expect(removed).toEqual([{ bucket: "journal-media", paths: ["u1/j1/a.jpg"] }]);
    expect(deletes).toContainEqual({ table: "journal_entries" });
  });
});
