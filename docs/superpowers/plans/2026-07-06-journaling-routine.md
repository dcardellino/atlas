# Journaling Routine (Morning Setup + Evening Close + Telegram Reminders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured Morning Setup / Evening Close journaling flow to Atlas, wired into the existing Top-3 task system and journal feed, with configurable Telegram reminders that link straight to each form.

**Architecture:** Two new Next.js pages (`/journal/morning`, `/journal/evening`) render forms that call the *existing* `create()` journal action (tagged with a new `source` value) and the *existing* `setTop3()` task action — no new journal schema. A new `journal_reminder_settings` table (one row per user: enabled + time per reminder, plus a dedup date) backs a new Settings section and a new `/api/cron/journal-reminders` route that Supabase pg_cron hits every 15 minutes, exactly like the three existing cron routes.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Supabase (Postgres + RLS), Vitest, Tailwind (existing design tokens only — no new UI library).

## Global Constraints

- All UI copy, toast messages, and Telegram message text: German, terse (matches existing `Vision § Voice & Tone`, e.g. "Speichere…", "Eintrag gespeichert").
- All code comments and identifiers: English (matches every existing file read during planning — `telegram.ts`, `journal/actions.ts`, `tasks/actions.ts`, `day.ts` all use English docstrings).
- `npm run typecheck && npm run lint && npm test` must stay green after every task (existing CI gate, `.github/workflows/ci.yml`).
- No new npm dependencies — everything is achievable with `date-fns-tz`, `@supabase/supabase-js`, and existing app code.
- Every new table gets RLS with the project's standard 4 policies (`auth.uid() = user_id` for select/insert, plus matching update/delete) — mirrors `supabase/migrations/0002_rls.sql` / `0014_workouts.sql`.
- New migrations use the current (lowercase, idempotent) SQL style from `0014_workouts.sql`, not the older uppercase style from `0001_init.sql`.
- Styling: reuse the existing Tailwind design tokens/classes verbatim (`font-mono text-label uppercase tracking-label text-on-surface-muted` for field labels, `rounded-sm bg-on-surface ... text-surface` for primary buttons, etc.) — no new component library.
- Test mocking: match the existing `vi.hoisted` + `vi.mock("@/lib/supabase/server", ...)` pattern from `src/__tests__/journal.test.ts` for any session-client code; inject the client directly (like `syncCalendarForUser`) for any admin/cron code.

---

### Task 1: `journal_reminder_settings` migration (table + RLS + pg_cron schedule)

**Files:**
- Create: `supabase/migrations/0016_journal_reminder_settings.sql`

**Interfaces:**
- Produces: table `journal_reminder_settings` with columns `user_id uuid primary key`, `morning_enabled boolean`, `morning_time time`, `morning_last_sent_on date`, `evening_enabled boolean`, `evening_time time`, `evening_last_sent_on date`, `updated_at timestamptz`. Tasks 3 and 4 query this table by name.
- Produces: pg_cron job `atlas-journal-reminders` hitting `/api/cron/journal-reminders` every 15 minutes (Task 5 must exist before this job will do anything useful, but the schedule can land now).

- [ ] **Step 1: Write the migration file**

```sql
-- Atlas — Journal-Reminder-Settings (configurable morning/evening journal pushes).
-- One row per user: enabled + time for both reminders, plus *_last_sent_on as a
-- dedup marker (same role as tasks.reminder_sent_at from 0006, just day-grained
-- since this can fire at most once per day per threshold). Style mirrors
-- 0014_workouts.sql; cron wiring mirrors 0009_supabase_cron.sql.

create table if not exists journal_reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_enabled boolean not null default true,
  morning_time time not null default '07:00',
  morning_last_sent_on date,
  evening_enabled boolean not null default true,
  evening_time time not null default '21:00',
  evening_last_sent_on date,
  updated_at timestamptz not null default now()
);

alter table journal_reminder_settings enable row level security;
drop policy if exists "journal_reminder_settings_select" on journal_reminder_settings;
create policy "journal_reminder_settings_select" on journal_reminder_settings for select using (auth.uid() = user_id);
drop policy if exists "journal_reminder_settings_insert" on journal_reminder_settings;
create policy "journal_reminder_settings_insert" on journal_reminder_settings for insert with check (auth.uid() = user_id);
drop policy if exists "journal_reminder_settings_update" on journal_reminder_settings;
create policy "journal_reminder_settings_update" on journal_reminder_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "journal_reminder_settings_delete" on journal_reminder_settings;
create policy "journal_reminder_settings_delete" on journal_reminder_settings for delete using (auth.uid() = user_id);

-- --- pg_cron: new route, every 15 minutes (mirrors 0009_supabase_cron.sql) ---
do $$
begin
  perform cron.unschedule('atlas-journal-reminders');
exception when others then null;
end $$;

select cron.schedule('atlas-journal-reminders', '*/15 * * * *', $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_base_url') || '/api/cron/journal-reminders',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration**

⚠️ This writes to the real Supabase project — confirm with Dominic before running this, or have him run it himself.

Run (Supabase CLI, if the project is linked locally): `supabase db push`

Or via the Supabase MCP `apply_migration` tool with this file's contents.

- [ ] **Step 3: Verify the table and policies exist**

Run (read-only, via the Supabase MCP `execute_sql` tool or `psql`):
```sql
select column_name, data_type from information_schema.columns
where table_name = 'journal_reminder_settings' order by ordinal_position;
```
Expected: 8 rows (`user_id`, `morning_enabled`, `morning_time`, `morning_last_sent_on`, `evening_enabled`, `evening_time`, `evening_last_sent_on`, `updated_at`).

Also run the Supabase MCP `get_advisors` (type: `security`) tool and confirm no new RLS warning appears for `journal_reminder_settings`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0016_journal_reminder_settings.sql
git commit -m "feat(db): add journal_reminder_settings table + cron schedule"
```

---

### Task 2: Journal check-in template helpers

**Files:**
- Create: `src/lib/journal/checkins.ts`
- Test: `src/__tests__/journal-checkins.test.ts`

**Interfaces:**
- Produces: `composeMorningBody(input: MorningAnswers): string`, `composeEveningBody(input: EveningAnswers): string`, `computeTasksDone(tasks: {status: "open" | "done"}[]): boolean`, and the `MorningAnswers`/`EveningAnswers` types. Tasks 7 and 8 import all three.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/journal-checkins.test.ts
import { describe, expect, it } from "vitest";
import {
  composeMorningBody,
  composeEveningBody,
  computeTasksDone,
} from "@/lib/journal/checkins";

describe("composeMorningBody", () => {
  it("renders feeling, numbered top3, avoiding and non-empty gratitude lines", () => {
    const body = composeMorningBody({
      feeling: "Fokussiert",
      top3Titles: ["Steuererklärung", "Sport"],
      avoiding: "Die Steuererklärung",
      gratitude: ["Kaffee", "", "Sonne"],
    });
    expect(body).toBe(
      [
        "Gefühl: Fokussiert",
        "Top 3:",
        "1. Steuererklärung",
        "2. Sport",
        "Vermeide ich: Die Steuererklärung",
        "Dankbar für:",
        "1. Kaffee",
        "2. Sonne",
      ].join("\n"),
    );
  });

  it("trims surrounding whitespace on free-text fields", () => {
    const body = composeMorningBody({
      feeling: "  Ruhig  ",
      top3Titles: [],
      avoiding: "  Anrufe  ",
      gratitude: ["", "", ""],
    });
    expect(body).toContain("Gefühl: Ruhig");
    expect(body).toContain("Vermeide ich: Anrufe");
  });
});

describe("composeEveningBody", () => {
  it("renders all five fields with Ja/Nein for tasksDone", () => {
    const body = composeEveningBody({
      tasksDone: true,
      movedToday: "Projekt X vorangebracht",
      carriesToTomorrow: "Rückruf Kunde Y",
      remembering: "Ruhiger Abendspaziergang",
      tomorrowFirstTask: "E-Mails checken",
    });
    expect(body).toBe(
      [
        "3 Aufgaben geschafft: Ja",
        "Bewegt hat sich: Projekt X vorangebracht",
        "Für morgen: Rückruf Kunde Y",
        "Nicht vergessen: Ruhiger Abendspaziergang",
        "Erste Aufgabe morgen: E-Mails checken",
      ].join("\n"),
    );
  });

  it("renders Nein when tasksDone is false", () => {
    const body = composeEveningBody({
      tasksDone: false,
      movedToday: "",
      carriesToTomorrow: "",
      remembering: "",
      tomorrowFirstTask: "",
    });
    expect(body.startsWith("3 Aufgaben geschafft: Nein")).toBe(true);
  });
});

describe("computeTasksDone", () => {
  it("is true when every top-3 task is done", () => {
    expect(computeTasksDone([{ status: "done" }, { status: "done" }])).toBe(true);
  });

  it("is false when any top-3 task is still open", () => {
    expect(computeTasksDone([{ status: "done" }, { status: "open" }])).toBe(false);
  });

  it("is false when there are no top-3 tasks (nothing to confirm)", () => {
    expect(computeTasksDone([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/journal-checkins.test.ts`
Expected: FAIL — `Cannot find module '@/lib/journal/checkins'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/journal/checkins.ts

/**
 * Pure formatting/derivation helpers for the Morning Setup and Evening Close
 * check-ins. Each check-in is saved through the existing journal `create()`
 * action as one composed `body` string, so these functions have no I/O and no
 * dependency on Supabase — they only shape strings and booleans.
 */

export type MorningAnswers = {
  feeling: string;
  top3Titles: string[];
  avoiding: string;
  gratitude: string[];
};

export function composeMorningBody(a: MorningAnswers): string {
  const gratitudeLines = a.gratitude
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .map((g, i) => `${i + 1}. ${g}`);

  return [
    `Gefühl: ${a.feeling.trim()}`,
    "Top 3:",
    ...a.top3Titles.map((t, i) => `${i + 1}. ${t}`),
    `Vermeide ich: ${a.avoiding.trim()}`,
    "Dankbar für:",
    ...gratitudeLines,
  ].join("\n");
}

export type EveningAnswers = {
  tasksDone: boolean;
  movedToday: string;
  carriesToTomorrow: string;
  remembering: string;
  tomorrowFirstTask: string;
};

export function composeEveningBody(a: EveningAnswers): string {
  return [
    `3 Aufgaben geschafft: ${a.tasksDone ? "Ja" : "Nein"}`,
    `Bewegt hat sich: ${a.movedToday.trim()}`,
    `Für morgen: ${a.carriesToTomorrow.trim()}`,
    `Nicht vergessen: ${a.remembering.trim()}`,
    `Erste Aufgabe morgen: ${a.tomorrowFirstTask.trim()}`,
  ].join("\n");
}

/** True only when there is at least one Top-3 task and all of them are done. */
export function computeTasksDone(tasks: { status: "open" | "done" }[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.status === "done");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/journal-checkins.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/checkins.ts src/__tests__/journal-checkins.test.ts
git commit -m "feat(journal): add morning/evening check-in template helpers"
```

---

### Task 3: Reminder-settings data layer (Settings UI backend)

**Files:**
- Create: `src/lib/journal/reminder-settings.ts`
- Test: `src/__tests__/journal-reminder-settings.test.ts`

**Interfaces:**
- Consumes: table `journal_reminder_settings` (Task 1).
- Produces: `getReminderSettings(): Promise<ReminderSettings>`, `updateReminderSettings(patch: Partial<ReminderSettings>): Promise<void>`, and the `ReminderSettings` type (`{morning_enabled: boolean; morning_time: string; evening_enabled: boolean; evening_time: string}`, times as `"HH:MM"`). Task 6 imports all three.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/journal-reminder-settings.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getReminderSettings,
  updateReminderSettings,
} from "@/lib/journal/reminder-settings";

function makeClient(opts: { row?: Record<string, unknown> | null } = {}) {
  const upserts: { table: string; values: unknown; options: unknown }[] = [];
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.maybeSingle = async () => ({ data: opts.row ?? null, error: null });
    b.upsert = (values: unknown, options: unknown) => {
      upserts.push({ table, values, options });
      return Promise.resolve({ data: null, error: null });
    };
    return b;
  }
  return {
    upserts,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => builder(table),
    },
  };
}

describe("getReminderSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns defaults when no row exists yet", async () => {
    const { client } = makeClient({ row: null });
    mocks.createClient.mockResolvedValue(client);

    const settings = await getReminderSettings();

    expect(settings).toEqual({
      morning_enabled: true,
      morning_time: "07:00",
      evening_enabled: true,
      evening_time: "21:00",
    });
  });

  it("maps a stored row, trimming seconds off the time columns", async () => {
    const { client } = makeClient({
      row: {
        morning_enabled: false,
        morning_time: "07:30:00",
        evening_enabled: true,
        evening_time: "22:00:00",
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const settings = await getReminderSettings();

    expect(settings).toEqual({
      morning_enabled: false,
      morning_time: "07:30",
      evening_enabled: true,
      evening_time: "22:00",
    });
  });
});

describe("updateReminderSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts the given patch scoped to the current user", async () => {
    const { client, upserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await updateReminderSettings({ morning_time: "07:45" });

    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe("journal_reminder_settings");
    expect(upserts[0].values).toMatchObject({
      user_id: "u1",
      morning_time: "07:45",
    });
    expect(upserts[0].options).toMatchObject({ onConflict: "user_id" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/journal-reminder-settings.test.ts`
Expected: FAIL — `Cannot find module '@/lib/journal/reminder-settings'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/journal/reminder-settings.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Journal reminder settings — one row per user, read/written under the session
 * client (RLS). Powers the Settings UI. The cron route reads the same table
 * through the admin client instead (see reminder-cron.ts), so it isn't scoped
 * to a logged-in session.
 */

export type ReminderSettings = {
  morning_enabled: boolean;
  morning_time: string;
  evening_enabled: boolean;
  evening_time: string;
};

const DEFAULTS: ReminderSettings = {
  morning_enabled: true,
  morning_time: "07:00",
  evening_enabled: true,
  evening_time: "21:00",
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("journal_reminder_settings")
    .select("morning_enabled, morning_time, evening_enabled, evening_time")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return DEFAULTS;
  return {
    morning_enabled: data.morning_enabled as boolean,
    morning_time: (data.morning_time as string).slice(0, 5),
    evening_enabled: data.evening_enabled as boolean,
    evening_time: (data.evening_time as string).slice(0, 5),
  };
}

export async function updateReminderSettings(
  patch: Partial<ReminderSettings>,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("journal_reminder_settings").upsert(
    { user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  revalidatePath("/settings");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/journal-reminder-settings.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/reminder-settings.ts src/__tests__/journal-reminder-settings.test.ts
git commit -m "feat(journal): add reminder-settings get/update actions"
```

---

### Task 4: Reminder-cron core logic + app URL env var

**Files:**
- Create: `src/lib/journal/reminder-cron.ts`
- Test: `src/__tests__/journal-reminder-cron.test.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: table `journal_reminder_settings` (Task 1, via an injected admin-client-shaped object); `sendTelegram` from `src/lib/notify/telegram.ts` (existing).
- Produces: `isDue(enabled, configuredTime, lastSentOn, nowTime, today): boolean`, `runJournalReminders(db, now: Date): Promise<{sent: number}>`. Task 5's route calls `runJournalReminders`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/journal-reminder-cron.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendTelegram: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendTelegram: mocks.sendTelegram }));

import { isDue, runJournalReminders } from "@/lib/journal/reminder-cron";

describe("isDue", () => {
  it("is false when disabled", () => {
    expect(isDue(false, "07:00", null, "08:00", "2026-07-06")).toBe(false);
  });

  it("is false before the configured time", () => {
    expect(isDue(true, "07:00", null, "06:59", "2026-07-06")).toBe(false);
  });

  it("is true at/after the configured time when not yet sent today", () => {
    expect(isDue(true, "07:00", null, "07:00", "2026-07-06")).toBe(true);
    expect(isDue(true, "07:00", "2026-07-05", "08:00", "2026-07-06")).toBe(true);
  });

  it("is false once already sent today", () => {
    expect(isDue(true, "07:00", "2026-07-06", "08:00", "2026-07-06")).toBe(false);
  });
});

type FakeRow = {
  user_id: string;
  morning_enabled: boolean;
  morning_time: string;
  morning_last_sent_on: string | null;
  evening_enabled: boolean;
  evening_time: string;
  evening_last_sent_on: string | null;
};

function makeSettingsClient(rows: FakeRow[]) {
  const updates: { table: string; values: unknown; col: string; val: string }[] = [];
  return {
    updates,
    client: {
      from: (table: string) => ({
        select: () => Promise.resolve({ data: rows, error: null }),
        update: (values: Record<string, unknown>) => ({
          eq: (col: string, val: string) => {
            updates.push({ table, values, col, val });
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    },
  };
}

describe("runJournalReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the morning push and stamps last_sent_on when due", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    const { client, updates } = makeSettingsClient([
      {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        morning_last_sent_on: null,
        evening_enabled: false,
        evening_time: "21:00",
        evening_last_sent_on: null,
      },
    ]);

    // 05:30 UTC = 07:30 CEST (Europe/Berlin, July → DST) — past the 07:00 threshold.
    const result = await runJournalReminders(client, new Date("2026-07-06T05:30:00Z"));

    expect(result.sent).toBe(1);
    expect(mocks.sendTelegram).toHaveBeenCalledTimes(1);
    expect(updates).toContainEqual(
      expect.objectContaining({
        col: "user_id",
        val: "u1",
        values: { morning_last_sent_on: "2026-07-06" },
      }),
    );
  });

  it("skips a user whose reminder already fired today", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    const { client, updates } = makeSettingsClient([
      {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        morning_last_sent_on: "2026-07-06",
        evening_enabled: false,
        evening_time: "21:00",
        evening_last_sent_on: null,
      },
    ]);

    const result = await runJournalReminders(client, new Date("2026-07-06T05:30:00Z"));

    expect(result.sent).toBe(0);
    expect(mocks.sendTelegram).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("does not stamp last_sent_on when the Telegram push fails", async () => {
    mocks.sendTelegram.mockResolvedValue(false);
    const { client, updates } = makeSettingsClient([
      {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        morning_last_sent_on: null,
        evening_enabled: false,
        evening_time: "21:00",
        evening_last_sent_on: null,
      },
    ]);

    const result = await runJournalReminders(client, new Date("2026-07-06T05:30:00Z"));

    expect(result.sent).toBe(0);
    expect(updates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/journal-reminder-cron.test.ts`
Expected: FAIL — `Cannot find module '@/lib/journal/reminder-cron'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/journal/reminder-cron.ts
import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { sendTelegram } from "@/lib/notify/telegram";

/**
 * Journal-reminder scheduling core. The route (journal-reminders/route.ts) is a
 * thin wrapper around runJournalReminders, mirroring how the calendar-sync route
 * wraps syncCalendarForUser — keeping the logic testable without a live request.
 * *_last_sent_on dedups so a 15-min poll fires at most once a day per threshold.
 */

const TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";

type SettingsRow = {
  user_id: string;
  morning_enabled: boolean;
  morning_time: string;
  morning_last_sent_on: string | null;
  evening_enabled: boolean;
  evening_time: string;
  evening_last_sent_on: string | null;
};

type ReminderDb = {
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: unknown; error: unknown }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

export function isDue(
  enabled: boolean,
  configuredTime: string,
  lastSentOn: string | null,
  nowTime: string,
  today: string,
): boolean {
  if (!enabled) return false;
  if (lastSentOn === today) return false;
  return nowTime >= configuredTime.slice(0, 5);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export async function runJournalReminders(
  db: ReminderDb,
  now: Date,
): Promise<{ sent: number }> {
  const today = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const nowTime = formatInTimeZone(now, TZ, "HH:mm");

  const { data } = await db.from("journal_reminder_settings").select("*");
  const rows = (data as SettingsRow[]) ?? [];

  let sent = 0;
  for (const row of rows) {
    if (
      isDue(row.morning_enabled, row.morning_time, row.morning_last_sent_on, nowTime, today)
    ) {
      const ok = await sendTelegram({
        title: "📝 Morning Journal",
        body: `Zeit fürs Morning Setup.\n${appUrl()}/journal/morning`,
      });
      if (ok) {
        await db
          .from("journal_reminder_settings")
          .update({ morning_last_sent_on: today })
          .eq("user_id", row.user_id);
        sent++;
      }
    }

    if (
      isDue(row.evening_enabled, row.evening_time, row.evening_last_sent_on, nowTime, today)
    ) {
      const ok = await sendTelegram({
        title: "🌙 Evening Close",
        body: `Zeit für deinen Rückblick.\n${appUrl()}/journal/evening`,
      });
      if (ok) {
        await db
          .from("journal_reminder_settings")
          .update({ evening_last_sent_on: today })
          .eq("user_id", row.user_id);
        sent++;
      }
    }
  }

  return { sent };
}
```

Also append to `.env.local.example` (after the `# --- Push notifications (Telegram) ---` block):

```
# --- Public app URL (used to build links inside Telegram pushes) ---
NEXT_PUBLIC_APP_URL=              # e.g. https://atlas.vercel.app — no trailing slash
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/journal-reminder-cron.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal/reminder-cron.ts src/__tests__/journal-reminder-cron.test.ts .env.local.example
git commit -m "feat(journal): add reminder-due logic + NEXT_PUBLIC_APP_URL"
```

---

### Task 5: Cron route

**Files:**
- Create: `src/app/api/cron/journal-reminders/route.ts`

**Interfaces:**
- Consumes: `runJournalReminders` (Task 4), `createAdminClient` (`src/lib/supabase/admin.ts`, existing), `isAuthorizedCron` (`src/lib/cron/auth.ts`, existing).

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/cron/journal-reminders/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runJournalReminders } from "@/lib/journal/reminder-cron";

/**
 * Journal-reminder cron. Same shape as reminders/daily-summary/calendar-sync:
 * triggered every 15 min by Supabase pg_cron (0016_journal_reminder_settings.sql),
 * secured by CRON_SECRET. All due/dedup logic lives in reminder-cron.ts, already
 * covered by its own unit tests — this route is a thin, untested wrapper, same as
 * the three existing cron routes.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const result = await runJournalReminders(db, new Date());
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify it typechecks and starts cleanly**

Run: `npm run typecheck`
Expected: no errors.

Run (dev server started separately): `curl "http://localhost:3000/api/cron/journal-reminders?secret=$CRON_SECRET"`
Expected: `{"sent":0}` (or more, if a settings row is already due) — no 401, no 500.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/journal-reminders/route.ts
git commit -m "feat(cron): add journal-reminders route"
```

---

### Task 6: Settings UI for reminder preferences

**Files:**
- Create: `src/components/features/settings/JournalReminderSettings.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `getReminderSettings`, `updateReminderSettings`, `ReminderSettings` (Task 3); `useToast` (`src/components/ui/Toast.tsx`, existing).

- [ ] **Step 1: Write the component**

No new unit test here — this is a thin form over Task 3's already-tested actions, matching the existing precedent that `IntegrationStatus.tsx` / `MetricsPanel.tsx` / `TokenManager.tsx` have no dedicated component tests either. Verified manually in Step 3.

```typescript
// src/components/features/settings/JournalReminderSettings.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateReminderSettings,
  type ReminderSettings,
} from "@/lib/journal/reminder-settings";
import { useToast } from "@/components/ui/Toast";

/**
 * Settings section for the Morning Setup / Evening Close Telegram reminders —
 * on/off + time per reminder. First editable settings form in the app (the
 * existing sections are read-only status displays).
 */

function Row({
  label,
  enabled,
  onToggle,
  time,
  onTimeChange,
}: {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  time: string;
  onTimeChange: (value: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <label className="flex flex-1 items-center gap-2 text-body text-on-surface">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {label}
      </label>
      <input
        type="time"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        className="h-9 rounded-sm border border-border bg-surface px-2 text-body text-on-surface outline-none focus:border-accent"
      />
    </li>
  );
}

export default function JournalReminderSettings({
  initial,
}: {
  initial: ReminderSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function save() {
    if (pending) return;
    startTransition(async () => {
      await updateReminderSettings(settings);
      router.refresh();
      showToast("Erinnerungen gespeichert");
    });
  }

  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Journal-Erinnerungen
      </p>

      <ul className="mt-3">
        <Row
          label="Morning Setup"
          enabled={settings.morning_enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, morning_enabled: v }))}
          time={settings.morning_time}
          onTimeChange={(v) => setSettings((s) => ({ ...s, morning_time: v }))}
        />
        <Row
          label="Evening Close"
          enabled={settings.evening_enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, evening_enabled: v }))}
          time={settings.evening_time}
          onTimeChange={(v) => setSettings((s) => ({ ...s, evening_time: v }))}
        />
      </ul>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-4 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
      >
        {pending ? "Speichere…" : "Speichern"}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the Settings page**

Read `src/app/(app)/settings/page.tsx` first (it currently fetches `tokens`/`syncState`/`metrics` in one `Promise.all`). Add `getReminderSettings()` to that same `Promise.all`, and mount the new component after `<IntegrationStatus .../>`:

```typescript
// src/app/(app)/settings/page.tsx
import TokenManager from "@/components/features/settings/TokenManager";
import IntegrationStatus from "@/components/features/settings/IntegrationStatus";
import MetricsPanel from "@/components/features/settings/MetricsPanel";
import JournalReminderSettings from "@/components/features/settings/JournalReminderSettings";
import { listTokens } from "@/lib/auth/actions";
import { getSyncState } from "@/lib/calendar/actions";
import { metricsSummary } from "@/lib/metrics/summary";
import { getReminderSettings } from "@/lib/journal/reminder-settings";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tokens, syncState, metrics, reminderSettings] = await Promise.all([
    listTokens(),
    getSyncState(),
    metricsSummary(),
    getReminderSettings(),
  ]);

  return (
    <section>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Einstellungen
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">Settings</h1>
      <MetricsPanel data={metrics} />
      <TokenManager initialTokens={tokens} />
      <IntegrationStatus
        data={{
          supabaseConnected: Boolean(user),
          calendar: {
            connected: syncState?.last_synced_at != null,
            lastSyncedAt: syncState?.last_synced_at ?? null,
            error: syncState?.last_error ?? null,
          },
          telegramConfigured: Boolean(
            process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
          ),
          timezone: process.env.CAPTURE_TZ ?? "Europe/Berlin",
        }}
      />
      <JournalReminderSettings initial={reminderSettings} />
    </section>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Start the dev server, open `/settings`, confirm the new "Journal-Erinnerungen" section renders with two rows (Morning Setup, Evening Close), change a time, click "Speichern", reload the page and confirm the new time persisted.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/settings/JournalReminderSettings.tsx src/app/\(app\)/settings/page.tsx
git commit -m "feat(settings): add journal reminder on/off + time controls"
```

---

### Task 7: Morning Setup form + page

**Files:**
- Create: `src/components/features/journal/MorningJournalForm.tsx`
- Create: `src/app/(app)/journal/morning/page.tsx`

**Interfaces:**
- Consumes: `composeMorningBody` (Task 2); `create` (`src/lib/journal/actions.ts`, existing); `list`, `setTop3`, `type Task` (`src/lib/tasks/actions.ts`, existing).

- [ ] **Step 1: Write the component**

No new unit test — the hard logic (`composeMorningBody`) is already covered in Task 2; this is UI wiring, matching the existing precedent that `JournalFeed.tsx` has no dedicated component test. Verified manually in Step 3.

```typescript
// src/components/features/journal/MorningJournalForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTop3, type Task } from "@/lib/tasks/actions";
import { create } from "@/lib/journal/actions";
import { composeMorningBody } from "@/lib/journal/checkins";
import { useToast } from "@/components/ui/Toast";

/**
 * Morning Setup (TASK-<next>). Top 3 is not free text — it reuses the app's
 * existing is_top3 flag on tasks (setTop3), so this form is the same source of
 * truth as the Tasks screen and Today view, not a parallel list.
 */

const MAX_TOP3 = 3;
const FIELD_LABEL =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";

export default function MorningJournalForm({
  openTasks,
}: {
  openTasks: Task[];
}) {
  const router = useRouter();
  const [feeling, setFeeling] = useState("");
  const [selected, setSelected] = useState<string[]>(
    openTasks.filter((t) => t.is_top3).map((t) => t.id),
  );
  const [avoiding, setAvoiding] = useState("");
  const [gratitude, setGratitude] = useState(["", "", ""]);
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function toggleTask(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= MAX_TOP3) return prev;
      return [...prev, id];
    });
  }

  function save() {
    if (pending || !feeling.trim() || !avoiding.trim()) return;
    startTransition(async () => {
      await Promise.all(
        openTasks
          .filter((t) => selected.includes(t.id) !== t.is_top3)
          .map((t) => setTop3(t.id, selected.includes(t.id))),
      );

      const top3Titles = openTasks
        .filter((t) => selected.includes(t.id))
        .map((t) => t.title);

      await create({
        body: composeMorningBody({ feeling, top3Titles, avoiding, gratitude }),
        source: "pwa_morning",
      });

      showToast("Morning Setup gespeichert");
      router.push("/journal");
    });
  }

  return (
    <section>
      <p className={FIELD_LABEL}>The Morning Setup</p>
      <h1 className="mt-1 font-serif text-display text-on-surface">
        Morning Setup
      </h1>

      <div className="mt-6 space-y-6">
        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Wie will ich mich heute fühlen? (ein Wort)
          </span>
          <input
            type="text"
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <div>
          <span className={`block ${FIELD_LABEL}`}>
            Top 3 Tasks heute ({selected.length}/{MAX_TOP3})
          </span>
          {openTasks.length === 0 ? (
            <p className="mt-2 text-body-sm text-on-surface-muted">
              Keine offenen Aufgaben — leg zuerst eine an.
            </p>
          ) : (
            <ul className="mt-2">
              {openTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-border py-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    disabled={
                      !selected.includes(t.id) && selected.length >= MAX_TOP3
                    }
                    onChange={() => toggleTask(t.id)}
                  />
                  <span className="text-body text-on-surface">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Das Eine, was ich immer wieder vermeide
          </span>
          <input
            type="text"
            value={avoiding}
            onChange={(e) => setAvoiding(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <div>
          <span className={`block ${FIELD_LABEL}`}>
            3 Dinge, für die ich dankbar bin
          </span>
          {gratitude.map((g, i) => (
            <input
              key={i}
              type="text"
              value={g}
              onChange={(e) =>
                setGratitude((prev) =>
                  prev.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
              className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={pending || !feeling.trim() || !avoiding.trim()}
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          {pending ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the page**

```typescript
// src/app/(app)/journal/morning/page.tsx
import MorningJournalForm from "@/components/features/journal/MorningJournalForm";
import { list } from "@/lib/tasks/actions";

export default async function MorningJournalPage() {
  const openTasks = await list({ status: "open" });
  return <MorningJournalForm openTasks={openTasks} />;
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Start the dev server, open `/journal/morning`, pick 2-3 open tasks as Top-3, fill the other fields, save. Confirm: (a) you land back on `/journal` with a new entry showing the composed text, (b) `/tasks` shows the same tasks now starred (is_top3), (c) unchecking a previously-starred task in this form and saving un-stars it there too.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/journal/MorningJournalForm.tsx "src/app/(app)/journal/morning/page.tsx"
git commit -m "feat(journal): add Morning Setup form"
```

---

### Task 8: Evening Close form + page

**Files:**
- Create: `src/components/features/journal/EveningJournalForm.tsx`
- Create: `src/app/(app)/journal/evening/page.tsx`

**Interfaces:**
- Consumes: `composeEveningBody`, `computeTasksDone` (Task 2); `create` (`src/lib/journal/actions.ts`, existing); `list` (`src/lib/tasks/actions.ts`, existing).

- [ ] **Step 1: Write the component**

No new unit test — `computeTasksDone`/`composeEveningBody` are already covered in Task 2; this is UI wiring. Verified manually in Step 3.

```typescript
// src/components/features/journal/EveningJournalForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { create } from "@/lib/journal/actions";
import { composeEveningBody, computeTasksDone } from "@/lib/journal/checkins";
import { useToast } from "@/components/ui/Toast";

/**
 * Evening Close (TASK-<next>). "3 tasks done?" is pre-filled from the current
 * Top-3 tasks' completion status (is_top3 isn't day-scoped, so this is a live
 * snapshot at open-time, not tied to a specific morning entry) but stays a
 * manual toggle the user can override before saving.
 */

type Top3Task = { id: string; title: string; status: "open" | "done" };

const FIELD_LABEL =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";

function toggleClass(active: boolean) {
  return `h-9 rounded-sm border border-border px-4 font-mono text-label uppercase tracking-label ${
    active ? "bg-on-surface text-surface" : "bg-surface text-on-surface"
  }`;
}

export default function EveningJournalForm({
  top3Tasks,
}: {
  top3Tasks: Top3Task[];
}) {
  const router = useRouter();
  const [tasksDone, setTasksDone] = useState(() => computeTasksDone(top3Tasks));
  const [movedToday, setMovedToday] = useState("");
  const [carriesToTomorrow, setCarriesToTomorrow] = useState("");
  const [remembering, setRemembering] = useState("");
  const [tomorrowFirstTask, setTomorrowFirstTask] = useState("");
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function save() {
    if (pending) return;
    startTransition(async () => {
      await create({
        body: composeEveningBody({
          tasksDone,
          movedToday,
          carriesToTomorrow,
          remembering,
          tomorrowFirstTask,
        }),
        source: "pwa_evening",
      });
      showToast("Evening Close gespeichert");
      router.push("/journal");
    });
  }

  return (
    <section>
      <p className={FIELD_LABEL}>The Evening Close</p>
      <h1 className="mt-1 font-serif text-display text-on-surface">
        Evening Close
      </h1>

      <div className="mt-6 space-y-6">
        <div>
          <span className={`block ${FIELD_LABEL}`}>3 Aufgaben geschafft?</span>
          {top3Tasks.length > 0 && (
            <ul className="mt-2">
              {top3Tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted"
                >
                  <span>{t.status === "done" ? "✓" : "○"}</span>
                  <span>{t.title}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              aria-pressed={tasksDone}
              onClick={() => setTasksDone(true)}
              className={toggleClass(tasksDone)}
            >
              Ja
            </button>
            <button
              type="button"
              aria-pressed={!tasksDone}
              onClick={() => setTasksDone(false)}
              className={toggleClass(!tasksDone)}
            >
              Nein
            </button>
          </div>
        </div>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>Was hat sich heute bewegt?</span>
          <input
            type="text"
            value={movedToday}
            onChange={(e) => setMovedToday(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>Was geht auf morgen über?</span>
          <input
            type="text"
            value={carriesToTomorrow}
            onChange={(e) => setCarriesToTomorrow(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Eine Sache, die es wert ist, sich zu merken
          </span>
          <input
            type="text"
            value={remembering}
            onChange={(e) => setRemembering(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>Erste Aufgabe morgen</span>
          <input
            type="text"
            value={tomorrowFirstTask}
            onChange={(e) => setTomorrowFirstTask(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          {pending ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the page**

```typescript
// src/app/(app)/journal/evening/page.tsx
import EveningJournalForm from "@/components/features/journal/EveningJournalForm";
import { list } from "@/lib/tasks/actions";

export default async function EveningJournalPage() {
  const allTasks = await list({ status: "all" });
  const top3Tasks = allTasks
    .filter((t) => t.is_top3)
    .map((t) => ({ id: t.id, title: t.title, status: t.status }));
  return <EveningJournalForm top3Tasks={top3Tasks} />;
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Start the dev server. With at least one Top-3 task still open, open `/journal/evening` and confirm the Ja/Nein toggle pre-fills to "Nein" and lists that task with `○`. Mark all Top-3 tasks done in `/tasks`, reopen `/journal/evening`, confirm it now pre-fills to "Ja" with all `✓`. Fill the remaining fields, save, confirm the entry appears in `/journal`.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/journal/EveningJournalForm.tsx "src/app/(app)/journal/evening/page.tsx"
git commit -m "feat(journal): add Evening Close form"
```

---

### Task 9: Journal feed nav links + full verification pass

**Files:**
- Modify: `src/components/features/journal/JournalFeed.tsx`

**Interfaces:**
- None new — this only adds two links; `JournalFeed`'s existing props/rendering of entries stays untouched.

- [ ] **Step 1: Add the two links**

Read `src/components/features/journal/JournalFeed.tsx` first. Add a `Link` import and insert a small nav row between the `<h1>` and `<Composer .../>` in the default export:

```typescript
import Link from "next/link";
```

```typescript
      <h1 className="mt-1 font-serif text-display text-on-surface">Journal</h1>

      <div className="mt-4 flex gap-3">
        <Link
          href="/journal/morning"
          className="h-9 rounded-sm border border-border px-4 py-2 font-mono text-label uppercase tracking-label text-on-surface"
        >
          Morning Setup
        </Link>
        <Link
          href="/journal/evening"
          className="h-9 rounded-sm border border-border px-4 py-2 font-mono text-label uppercase tracking-label text-on-surface"
        >
          Evening Close
        </Link>
      </div>

      <Composer areas={areas} userId={userId} />
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green, including every test added in Tasks 2-4.

- [ ] **Step 3: Full manual walkthrough**

1. Start the dev server, open `/journal` — confirm the two new links are visible and navigate correctly.
2. Complete a Morning Setup and an Evening Close as described in Tasks 7-8; confirm both entries render correctly (multi-line, readable) in the `/journal` feed alongside a normal free-text entry.
3. Open `/settings`, confirm the reminder times/toggles from Task 6 are visible and editable.
4. Manually trigger the cron: `curl "http://localhost:3000/api/cron/journal-reminders?secret=$CRON_SECRET"` and confirm a Telegram message arrives with a working `/journal/morning` or `/journal/evening` link (requires `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`/`NEXT_PUBLIC_APP_URL` set locally).

- [ ] **Step 4: Commit**

```bash
git add src/components/features/journal/JournalFeed.tsx
git commit -m "feat(journal): link Morning Setup / Evening Close from the journal feed"
```

---

## Self-Review Notes

- **Spec coverage:** all 4 bullets from the approved design (feeling, linked Top-3, avoiding, 3 gratitudes for morning; all 5 evening fields; unified feed; configurable separate Telegram reminders with link) map to Tasks 2/6/7/8/9. No gaps found.
- **Placeholders:** none — every step has complete, runnable code; no TBD/TODO markers.
- **Type consistency:** `ReminderSettings` (Task 3) and the `SettingsRow`/`ReminderDb` shapes (Task 4) agree on field names (`morning_enabled`, `morning_time`, `evening_enabled`, `evening_time`); `MorningAnswers`/`EveningAnswers` (Task 2) match the object shapes passed by `MorningJournalForm`/`EveningJournalForm` (Tasks 7/8) field-for-field.
