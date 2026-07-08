# Settings Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Settings page into tabbed subpages, move Areas into Settings, remove the unused AI capture-classification feature, and let the user pick which Google calendars sync.

**Architecture:** Settings gets an in-page tab bar (`SettingsTabs`/`SettingsHeader`), copying the existing Workout subpage pattern exactly (`WorkoutTabs`/`WorkoutHeader`, no shared `layout.tsx`). Each of the 5 subpages is its own `page.tsx` under `src/app/(app)/settings/`. AI classification is deleted wholesale from the capture pipeline — every capture becomes a plain inbox note. Calendar sync gains a `selected_calendar_ids` column and loops over it instead of hardcoding `primary`.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (Postgres + RLS), Vitest + Testing Library, Tailwind design tokens.

**Spec:** `docs/superpowers/specs/2026-07-08-settings-restructure-design.md`

## Global Constraints

- UI text throughout in German (existing repo convention — do not translate).
- Styling only via existing Tailwind design tokens (`text-on-surface-muted`, `font-mono text-label uppercase tracking-label`, etc.) — no hardcoded colors/spacing.
- Commit messages in English.
- Migration files: lowercase SQL, idempotent (`if not exists` / `if exists`), end with `notify pgrst, 'reload schema';`.
- Do NOT write a migration that drops the AI columns on `inbox_items` (`ai_meta`, `corrected_type`, `corrected_area_id`, `corrected_at`) — they stay, just unused (explicit non-goal in the spec).
- If working in a git worktree, run `supabase link` in it before any migration/db command — otherwise migration checks silently target the wrong project.

---

## Gruppe A — Settings-Scaffold

### Task 1: SettingsTabs-Komponente

**Files:**
- Create: `src/components/features/settings/SettingsTabs.tsx`
- Test: `src/components/features/settings/SettingsTabs.test.tsx`

**Interfaces:**
- Consumes: nothing (leaf component, only `next/navigation`/`next/link`)
- Produces: `SettingsTabs` (default export, no props) — a `<nav>` with 5 `Link`s to `/settings/integrations`, `/settings/tokens`, `/settings/insights`, `/settings/reminders`, `/settings/areas`. Consumed by `SettingsHeader` (Task 2).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/features/settings/SettingsTabs.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsTabs from "./SettingsTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/tokens",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("SettingsTabs", () => {
  it("renders all five settings tabs", () => {
    render(<SettingsTabs />);
    for (const label of [
      "Integrationen",
      "Tokens",
      "Insights",
      "Erinnerungen",
      "Areas",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the current route's tab with aria-current", () => {
    render(<SettingsTabs />);
    expect(screen.getByText("Tokens").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByText("Integrationen").closest("a"),
    ).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/features/settings/SettingsTabs.test.tsx`
Expected: FAIL — `Cannot find module './SettingsTabs'`

- [ ] **Step 3: Write the component**

```tsx
// src/components/features/settings/SettingsTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// In-Page-Navigation für den Settings-Bereich (analog zu WorkoutTabs). Areas
// zieht hierher um und verliert dafür seinen Eintrag in der globalen Bottom-Nav.
const TABS = [
  { href: "/settings/integrations", label: "Integrationen", exact: true },
  { href: "/settings/tokens", label: "Tokens", exact: false },
  { href: "/settings/insights", label: "Insights", exact: false },
  { href: "/settings/reminders", label: "Erinnerungen", exact: false },
  { href: "/settings/areas", label: "Areas", exact: false },
] as const;

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings-Navigation" className="mt-4 border-b border-border">
      <ul className="flex flex-wrap gap-4">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 py-2 font-mono text-label uppercase tracking-label transition-colors ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-on-surface-muted hover:text-on-surface"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/features/settings/SettingsTabs.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/features/settings/SettingsTabs.tsx src/components/features/settings/SettingsTabs.test.tsx
git commit -m "feat(settings): add SettingsTabs in-page navigation"
```

---

### Task 2: SettingsHeader-Komponente

**Files:**
- Create: `src/components/features/settings/SettingsHeader.tsx`

**Interfaces:**
- Consumes: `SettingsTabs` (default export from Task 1)
- Produces: `SettingsHeader` (default export, `{ title: string }` prop) — Mono-Eyebrow "Einstellungen" + Serif-H1 `{title}` + `SettingsTabs`. Consumed by every `settings/*/page.tsx` (Task 3 onward).

No test — purely presentational composition, same as `WorkoutHeader` (its sibling has no test file either).

- [ ] **Step 1: Write the component**

```tsx
// src/components/features/settings/SettingsHeader.tsx
import SettingsTabs from "@/components/features/settings/SettingsTabs";

/**
 * Gemeinsamer Kopf des Settings-Bereichs: Mono-Eyebrow, große Serif-Headline,
 * darunter die In-Page-Tabs (analog zu WorkoutHeader). Rein präsentational.
 */
export default function SettingsHeader({ title }: { title: string }) {
  return (
    <header>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Einstellungen
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">{title}</h1>
      <SettingsTabs />
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/features/settings/SettingsHeader.tsx
git commit -m "feat(settings): add SettingsHeader"
```

---

### Task 3: Settings-Unterseiten-Scaffold (Umzug, Redirects, Nav)

**Files:**
- Create: `src/app/(app)/settings/integrations/page.tsx`
- Create: `src/app/(app)/settings/tokens/page.tsx`
- Create: `src/app/(app)/settings/insights/page.tsx`
- Create: `src/app/(app)/settings/areas/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx` (→ redirect)
- Modify: `src/app/(app)/areas/page.tsx` (→ redirect)
- Modify: `src/components/ui/Nav.tsx` (remove Areas entry)
- Modify: `src/components/ui/Nav.test.tsx` (remove "Areas" from expected labels)
- Modify: `src/components/features/settings/MetricsPanel.tsx` (drop internal "Insights" heading — now redundant with the page H1)
- Modify: `src/components/features/settings/TokenManager.tsx` (drop internal "Shortcut-Tokens" heading)
- Modify: `src/components/features/settings/IntegrationStatus.tsx` (drop internal "Integrationen" heading)

**Interfaces:**
- Consumes: `SettingsHeader` (Task 2), existing `TokenManager`/`IntegrationStatus`/`MetricsPanel`/`AreaManager` (unchanged props)
- Produces: working routes `/settings/integrations`, `/settings/tokens`, `/settings/insights`, `/settings/areas`; `/settings` and `/areas` redirect. `/settings/reminders` is linked from the tabs (Task 1) but has no page yet — 404 until Task 5.

No automated test — Next.js `page.tsx` composition isn't unit-tested anywhere in this repo (verified: zero `page.test.tsx` files exist). Verified manually at the end of this task via the dev server.

- [ ] **Step 1: Drop the now-redundant internal headings**

Each moved section will sit under its own page's `SettingsHeader` H1, so its own small mono-label heading becomes a duplicate. Remove just that `<p>` in each — keep everything else, including the outer `className="mt-8"`.

In `src/components/features/settings/MetricsPanel.tsx`, remove:
```tsx
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Insights
      </p>
```
so the section starts directly with the `<p className="mt-1 ...">Letzte {data.windowDays} Tage</p>` line.

In `src/components/features/settings/TokenManager.tsx`, remove:
```tsx
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Shortcut-Tokens
      </p>
```
so the section starts directly with the `<div className="mt-3 flex items-end gap-3">` line.

In `src/components/features/settings/IntegrationStatus.tsx`, remove:
```tsx
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Integrationen
      </p>
```
so the section starts directly with the `<ul className="mt-3">` line.

- [ ] **Step 2: Create the Integrationen subpage**

```tsx
// src/app/(app)/settings/integrations/page.tsx
import SettingsHeader from "@/components/features/settings/SettingsHeader";
import IntegrationStatus from "@/components/features/settings/IntegrationStatus";
import { getSyncState } from "@/lib/calendar/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsIntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const syncState = await getSyncState();

  return (
    <section>
      <SettingsHeader title="Integrationen" />
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
    </section>
  );
}
```

- [ ] **Step 3: Create the Tokens subpage**

```tsx
// src/app/(app)/settings/tokens/page.tsx
import SettingsHeader from "@/components/features/settings/SettingsHeader";
import TokenManager from "@/components/features/settings/TokenManager";
import { listTokens } from "@/lib/auth/actions";

export default async function SettingsTokensPage() {
  const tokens = await listTokens();
  return (
    <section>
      <SettingsHeader title="Shortcut-Tokens" />
      <TokenManager initialTokens={tokens} />
    </section>
  );
}
```

- [ ] **Step 4: Create the Insights subpage**

```tsx
// src/app/(app)/settings/insights/page.tsx
import SettingsHeader from "@/components/features/settings/SettingsHeader";
import MetricsPanel from "@/components/features/settings/MetricsPanel";
import { metricsSummary } from "@/lib/metrics/summary";

export default async function SettingsInsightsPage() {
  const metrics = await metricsSummary();
  return (
    <section>
      <SettingsHeader title="Insights" />
      <MetricsPanel data={metrics} />
    </section>
  );
}
```

- [ ] **Step 5: Create the Areas subpage (moved from `/areas`)**

```tsx
// src/app/(app)/settings/areas/page.tsx
import SettingsHeader from "@/components/features/settings/SettingsHeader";
import AreaManager from "@/components/features/areas/AreaManager";
import { list, listOrphans } from "@/lib/areas/actions";

export default async function SettingsAreasPage() {
  const [areas, orphans] = await Promise.all([list(), listOrphans()]);
  return (
    <section>
      <SettingsHeader title="Areas" />
      <AreaManager areas={areas} orphans={orphans} />
    </section>
  );
}
```

- [ ] **Step 6: Turn `/areas` and `/settings` into redirects**

Replace the entire content of `src/app/(app)/areas/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function AreasPage() {
  redirect("/settings/areas");
}
```

Replace the entire content of `src/app/(app)/settings/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/integrations");
}
```

- [ ] **Step 7: Remove Areas from the global bottom nav**

In `src/components/ui/Nav.tsx`, remove this line from the `ITEMS` array:

```tsx
  { href: "/areas", label: "Areas" },
```

- [ ] **Step 8: Update Nav's test to match**

In `src/components/ui/Nav.test.tsx`, remove `"Areas",` from the label list in the first test, so it reads:

```tsx
    for (const label of [
      "Today",
      "Tasks",
      "Training",
      "Routines",
      "Journal",
      "Settings",
    ]) {
```

- [ ] **Step 9: Run the full test suite + typecheck**

Run: `npx vitest run src/components/ui/Nav.test.tsx src/components/features/settings/SettingsTabs.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, then in a browser:
- Visit `/settings` → redirects to `/settings/integrations`, shows Supabase/Calendar/Telegram badges, no duplicate "Integrationen" heading.
- Visit `/settings/tokens` → shows token list/create form, no duplicate heading.
- Visit `/settings/insights` → shows metrics, no duplicate heading.
- Visit `/settings/areas` → shows AreaManager, drag/create/edit still work.
- Visit `/areas` → redirects to `/settings/areas`.
- Bottom nav shows 6 items, no "Areas".
- Visit `/settings/reminders` → 404 (expected until Task 5).

- [ ] **Step 11: Commit**

```bash
git add src/app/\(app\)/settings src/app/\(app\)/areas/page.tsx src/components/ui/Nav.tsx src/components/ui/Nav.test.tsx src/components/features/settings/MetricsPanel.tsx src/components/features/settings/TokenManager.tsx src/components/features/settings/IntegrationStatus.tsx
git commit -m "feat(settings): split Settings into tabbed subpages, move Areas in"
```

---

## Gruppe B — Journal-Erinnerungen

### Task 4: `getLastReminderSentAt()` in tasks/actions.ts

**Files:**
- Modify: `src/lib/tasks/actions.ts`
- Test: `src/lib/tasks/actions.test.ts`

**Interfaces:**
- Consumes: existing `requireUser()` helper in the same file
- Produces: `getLastReminderSentAt(): Promise<string | null>` — exported, consumed by `settings/reminders/page.tsx` (Task 5)

- [ ] **Step 1: Write the failing test**

Add to the end of `src/lib/tasks/actions.test.ts` (reuses the file's existing `makeClient` helper and `mocks.createClient`):

```typescript
describe("getLastReminderSentAt", () => {
  it("returns the most recently sent reminder timestamp", async () => {
    const { client } = makeClient({
      listData: [
        { reminder_sent_at: "2026-07-08T09:00:00.000Z" },
        { reminder_sent_at: "2026-07-01T09:00:00.000Z" },
      ],
    });
    mocks.createClient.mockResolvedValue(client);
    expect(await getLastReminderSentAt()).toBe("2026-07-08T09:00:00.000Z");
  });

  it("returns null when no reminder has ever been sent", async () => {
    const { client } = makeClient({ listData: [] });
    mocks.createClient.mockResolvedValue(client);
    expect(await getLastReminderSentAt()).toBeNull();
  });
});
```

Also update the import line at the top of the file to include the new function:

```typescript
import { create, toggleComplete, list, remove, getLastReminderSentAt } from "./actions";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tasks/actions.test.ts`
Expected: FAIL — `getLastReminderSentAt is not a function` / import error

- [ ] **Step 3: Implement**

Add to the end of `src/lib/tasks/actions.ts`:

```typescript
/** Most recent `reminder_sent_at` across the user's tasks, or null if none was ever sent. */
export async function getLastReminderSentAt(): Promise<string | null> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("tasks")
    .select("reminder_sent_at")
    .eq("user_id", userId)
    .order("reminder_sent_at", { ascending: false, nullsFirst: false });
  const rows = (data as { reminder_sent_at: string | null }[]) ?? [];
  return rows[0]?.reminder_sent_at ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tasks/actions.test.ts`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/actions.ts src/lib/tasks/actions.test.ts
git commit -m "feat(tasks): add getLastReminderSentAt for the reminders status page"
```

---

### Task 5: ReminderStatus-Komponente + `/settings/reminders`

**Files:**
- Create: `src/components/features/settings/ReminderStatus.tsx`
- Create: `src/components/features/settings/ReminderStatus.test.tsx`
- Create: `src/app/(app)/settings/reminders/page.tsx`

**Interfaces:**
- Consumes: `getLastReminderSentAt()` (Task 4), `SettingsHeader` (Task 2)
- Produces: `ReminderStatus` (default export, `{ data: ReminderStatusData }` prop where `ReminderStatusData = { telegramConfigured: boolean; lastSentAt: string | null }`) + a working `/settings/reminders` route

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/features/settings/ReminderStatus.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReminderStatus from "./ReminderStatus";

describe("ReminderStatus", () => {
  it("shows Telegram as configured and formats the last-sent timestamp", () => {
    render(
      <ReminderStatus
        data={{
          telegramConfigured: true,
          lastSentAt: "2026-07-08T09:30:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("Konfiguriert")).toBeInTheDocument();
    expect(screen.getByText("08.07.2026 11:30")).toBeInTheDocument();
  });

  it("shows a dash when no reminder has been sent yet", () => {
    render(
      <ReminderStatus data={{ telegramConfigured: false, lastSentAt: null }} />,
    );
    expect(screen.getByText("Nicht gesetzt")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/features/settings/ReminderStatus.test.tsx`
Expected: FAIL — `Cannot find module './ReminderStatus'`

- [ ] **Step 3: Write the component**

```tsx
// src/components/features/settings/ReminderStatus.tsx
import { formatInTimeZone } from "date-fns-tz";

const TZ = "Europe/Berlin";

export type ReminderStatusData = {
  telegramConfigured: boolean;
  lastSentAt: string | null;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-meta uppercase tracking-label ${
        ok ? "text-success" : "text-warning"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export default function ReminderStatus({ data }: { data: ReminderStatusData }) {
  return (
    <section className="mt-8">
      <ul>
        <li className="flex items-center gap-3 border-b border-border py-3">
          <span className="flex-1 text-body text-on-surface">Telegram</span>
          <StatusBadge
            ok={data.telegramConfigured}
            label={data.telegramConfigured ? "Konfiguriert" : "Nicht gesetzt"}
          />
        </li>
        <li className="flex items-center gap-3 border-b border-border py-3">
          <span className="flex-1 text-body text-on-surface">
            Letzte Erinnerung
          </span>
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {data.lastSentAt
              ? formatInTimeZone(new Date(data.lastSentAt), TZ, "dd.MM.yyyy HH:mm")
              : "—"}
          </span>
        </li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/features/settings/ReminderStatus.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire it into the reminders subpage**

```tsx
// src/app/(app)/settings/reminders/page.tsx
import SettingsHeader from "@/components/features/settings/SettingsHeader";
import ReminderStatus from "@/components/features/settings/ReminderStatus";
import { getLastReminderSentAt } from "@/lib/tasks/actions";

export default async function SettingsRemindersPage() {
  const lastSentAt = await getLastReminderSentAt();
  return (
    <section>
      <SettingsHeader title="Journal-Erinnerungen" />
      <ReminderStatus
        data={{
          telegramConfigured: Boolean(
            process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
          ),
          lastSentAt,
        }}
      />
    </section>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, visit `/settings/reminders` → shows Telegram status badge + last-sent timestamp (or "—"), tab bar highlights "Erinnerungen".

- [ ] **Step 7: Commit**

```bash
git add src/components/features/settings/ReminderStatus.tsx src/components/features/settings/ReminderStatus.test.tsx src/app/\(app\)/settings/reminders
git commit -m "feat(settings): add Journal-Erinnerungen status subpage"
```

---

## Gruppe C — Kalender-Mehrfachauswahl

### Task 6: DB-Migration + CalendarSyncState-Typ

**Files:**
- Create: `supabase/migrations/0016_calendar_multi_select.sql`
- Modify: `src/lib/calendar/types.ts`

**Interfaces:**
- Produces: `calendar_sync_state.selected_calendar_ids text[]` column; `calendar_events` unique constraint becomes `(user_id, calendar_id, external_id)`; `CalendarSyncState` type gains `selected_calendar_ids: string[] | null`. Consumed by Tasks 8/9/10.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0016_calendar_multi_select.sql
-- Atlas — Kalender-Mehrfachauswahl (Settings-Restructure).
-- Erlaubt die Auswahl mehrerer Google-Kalender statt nur "primary". Idempotent;
-- reloadet den PostgREST-Schema-Cache am Ende.

alter table calendar_sync_state
  add column if not exists selected_calendar_ids text[] not null default array['primary'];

-- Google-Event-IDs sind nur innerhalb eines Kalenders eindeutig — bei mehreren
-- ausgewählten Kalendern könnten sonst IDs kollidieren.
alter table calendar_events
  drop constraint if exists calendar_events_user_id_external_id_key;
alter table calendar_events
  add constraint calendar_events_user_id_calendar_id_external_id_key
    unique (user_id, calendar_id, external_id);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration**

If working in a git worktree, run `supabase link` first (see Global Constraints). Then:

Run: `supabase db push`
Expected: migration `0016_calendar_multi_select.sql` applied cleanly.

- [ ] **Step 3: Verify the schema change**

Run: `supabase db diff --schema public` (or check the Supabase dashboard's table editor for `calendar_sync_state`)
Expected: `calendar_sync_state` has a `selected_calendar_ids` column (text[], default `{primary}`); `calendar_events` has the new 3-column unique constraint.

- [ ] **Step 4: Update the type to mirror the schema**

In `src/lib/calendar/types.ts`, change:

```typescript
export type CalendarSyncState = {
  user_id: string;
  last_synced_at: string | null;
  last_error: string | null;
};
```

to:

```typescript
export type CalendarSyncState = {
  user_id: string;
  last_synced_at: string | null;
  last_error: string | null;
  selected_calendar_ids: string[] | null;
};
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0016_calendar_multi_select.sql src/lib/calendar/types.ts
git commit -m "feat(calendar): add selected_calendar_ids column + 3-way unique constraint"
```

---

### Task 7: google.ts — calendarId-Parametrisierung + fetchCalendarList

**Files:**
- Modify: `src/lib/calendar/google.ts`
- Test: `src/lib/calendar/google.test.ts` (new)

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `fetchEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string, fetchImpl?: typeof fetch): Promise<GoogleEvent[]>` — **signature changed**, `calendarId` inserted as the 2nd parameter
  - `normalizeEvent(e: GoogleEvent, calendarId: string): NormalizedEvent | null` — **signature changed**, `calendarId` now required
  - `fetchCalendarList(accessToken: string, fetchImpl?: typeof fetch): Promise<{ id: string; summary: string; primary?: boolean }[]>` — new
  - Consumed by `sync.ts` (Task 8) and `calendar/actions.ts` (Task 9)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/calendar/google.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calendar/google.test.ts`
Expected: FAIL — `fetchCalendarList is not exported`, and the URL/signature assertions fail against the current hardcoded-`primary` implementation

- [ ] **Step 3: Implement**

In `src/lib/calendar/google.ts`, replace the `EVENTS_URL` constant and `fetchEvents`/`normalizeEvent` functions:

```typescript
function eventsUrl(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

const CALENDAR_LIST_URL =
  "https://www.googleapis.com/calendar/v3/users/me/calendarList";
```

(this replaces the old `const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";`)

```typescript
/** List a calendar's events within [timeMin, timeMax), expanded to instances. */
export async function fetchEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleEvent[]> {
  const url = new URL(eventsUrl(calendarId));
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
```

(this replaces the old `fetchEvents` — the only change is the new `calendarId` parameter and using `eventsUrl(calendarId)` instead of `EVENTS_URL`)

```typescript
/** Normalise a Google event to a cache row, tagged with its source calendar. Returns null if unusable/cancelled. */
export function normalizeEvent(
  e: GoogleEvent,
  calendarId: string,
): NormalizedEvent | null {
  if (e.status === "cancelled" || !e.id) return null;

  const allDay = Boolean(e.start?.date && !e.start?.dateTime);
  const startRaw = e.start?.dateTime ?? e.start?.date;
  if (!startRaw) return null;

  const toIso = (value: string, isDate: boolean) =>
    isDate ? new Date(`${value}T00:00:00Z`).toISOString() : new Date(value).toISOString();

  const endRaw = e.end?.dateTime ?? e.end?.date ?? null;

  return {
    external_id: e.id,
    calendar_id: calendarId,
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
```

Add at the end of the file (before or after `normalizeEvent`, matching the file's existing top-to-bottom flow):

```typescript
export type GoogleCalendarListEntry = {
  id?: string;
  summary?: string;
  primary?: boolean;
};

/** List the calendars the connected Google account has access to. */
export async function fetchCalendarList(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const res = await fetchImpl(CALENDAR_LIST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`calendar list fetch failed: ${res.status}`);
  const json = (await res.json()) as { items?: GoogleCalendarListEntry[] };
  return (json.items ?? [])
    .filter((c): c is { id: string; summary?: string; primary?: boolean } =>
      Boolean(c.id),
    )
    .map((c) => ({ id: c.id, summary: c.summary ?? c.id, primary: c.primary }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calendar/google.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/google.ts src/lib/calendar/google.test.ts
git commit -m "feat(calendar): parameterize fetchEvents/normalizeEvent by calendarId, add fetchCalendarList"
```

---

### Task 8: sync.ts — Mehrfach-Kalender-Sync

**Files:**
- Modify: `src/lib/calendar/sync.ts`
- Test: `src/lib/calendar/sync.test.ts` (new)

**Interfaces:**
- Consumes: `getAccessToken`, `fetchEvents(token, calendarId, timeMin, timeMax, fetchImpl?)`, `normalizeEvent(e, calendarId)` from `./google` (Task 7)
- Produces: `syncCalendarForUser(db, userId, now?, fetchImpl?): Promise<{ synced: number }>` — same signature as before, now reads `calendar_sync_state.selected_calendar_ids` and loops over it (default `["primary"]`). Consumed by `calendar/actions.ts` (unchanged call sites) and the calendar-sync cron.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/calendar/sync.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calendar/sync.test.ts`
Expected: FAIL — `fetchEvents` called with old 4-arg signature / assertions on `mock.calls[0][1]` don't match "primary"

- [ ] **Step 3: Implement**

Change the import line at the top of `src/lib/calendar/sync.ts` from:

```typescript
import { getAccessToken, fetchEvents, normalizeEvent } from "./google";
```

to:

```typescript
import { getAccessToken, fetchEvents, normalizeEvent, type NormalizedEvent } from "./google";
```

Replace the body of `syncCalendarForUser`:

```typescript
export async function syncCalendarForUser(
  db: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<{ synced: number }> {
  const day = 24 * 60 * 60 * 1000;
  const timeMin = new Date(now.getTime() - day).toISOString();
  const timeMax = new Date(now.getTime() + 30 * day).toISOString();
  const syncedAt = now.toISOString();

  try {
    const { data: state } = await db
      .from("calendar_sync_state")
      .select("selected_calendar_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const calendarIds: string[] = state?.selected_calendar_ids?.length
      ? state.selected_calendar_ids
      : ["primary"];

    const token = await getAccessToken(process.env, fetchImpl);
    const rows: (NormalizedEvent & { user_id: string; synced_at: string })[] = [];
    for (const calendarId of calendarIds) {
      const events = await fetchEvents(token, calendarId, timeMin, timeMax, fetchImpl);
      for (const e of events) {
        const normalized = normalizeEvent(e, calendarId);
        if (normalized) {
          rows.push({ ...normalized, user_id: userId, synced_at: syncedAt });
        }
      }
    }

    if (rows.length > 0) {
      await db
        .from("calendar_events")
        .upsert(rows, { onConflict: "user_id,calendar_id,external_id" });
    }

    // Any row not refreshed this run fell out of the window / was deleted.
    await db
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .lt("synced_at", syncedAt);

    await db
      .from("calendar_sync_state")
      .upsert(
        { user_id: userId, last_synced_at: syncedAt, last_error: null },
        { onConflict: "user_id" },
      );

    return { synced: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("calendar_sync_state")
      .upsert(
        { user_id: userId, last_error: message },
        { onConflict: "user_id" },
      );
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calendar/sync.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/calendar/sync.ts src/lib/calendar/sync.test.ts
git commit -m "feat(calendar): sync every selected calendar instead of only primary"
```

---

### Task 9: calendar/actions.ts — listAvailableCalendars + updateSelectedCalendars

**Files:**
- Modify: `src/lib/calendar/actions.ts`

**Interfaces:**
- Consumes: `getAccessToken`, `fetchCalendarList` from `./google` (Task 7); `syncCalendarForUser` from `./sync` (already imported)
- Produces: `listAvailableCalendars(): Promise<AvailableCalendar[]>` (never throws — returns `[]` on any failure), `updateSelectedCalendars(ids: string[]): Promise<void>`. Both consumed by Task 10.

No dedicated test — this file has zero existing test coverage (`forceSync`/`listTodayEvents`/`getSyncState` are also untested), so adding partial coverage for just the 2 new functions would be inconsistent with the file's established (lack of) convention. Covered by manual verification in Task 10 and the google.ts/sync.ts unit tests already added.

- [ ] **Step 1: Add the import**

At the top of `src/lib/calendar/actions.ts`, change:

```typescript
import { syncCalendarForUser } from "./sync";
```

to:

```typescript
import { getAccessToken, fetchCalendarList } from "./google";
import { syncCalendarForUser } from "./sync";
```

- [ ] **Step 2: Implement the two functions**

Add at the end of `src/lib/calendar/actions.ts`:

```typescript
export type AvailableCalendar = { id: string; summary: string; primary?: boolean };

/**
 * Calendars the connected Google account has, for the Settings selector. Never
 * throws — an unconfigured/broken connection just yields an empty list (the UI
 * hides the selector when this is empty).
 */
export async function listAvailableCalendars(): Promise<AvailableCalendar[]> {
  try {
    const token = await getAccessToken();
    return await fetchCalendarList(token);
  } catch {
    return [];
  }
}

/** Persist the calendar selection and re-sync immediately so it's visible right away. */
export async function updateSelectedCalendars(ids: string[]): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("calendar_sync_state")
    .upsert(
      { user_id: userId, selected_calendar_ids: ids },
      { onConflict: "user_id" },
    );
  try {
    await syncCalendarForUser(createAdminClient(), userId);
  } catch {
    // last_error is already persisted by syncCalendarForUser.
  }
  revalidatePath("/settings/integrations");
  revalidatePath("/today");
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendar/actions.ts
git commit -m "feat(calendar): add listAvailableCalendars and updateSelectedCalendars actions"
```

---

### Task 10: CalendarSelector-Komponente + Integrationen-Seite

**Files:**
- Create: `src/components/features/settings/CalendarSelector.tsx`
- Modify: `src/app/(app)/settings/integrations/page.tsx`

**Interfaces:**
- Consumes: `updateSelectedCalendars` (Task 9), `AvailableCalendar` type (Task 9)
- Produces: `CalendarSelector` (default export, `{ calendars: AvailableCalendar[]; initialSelected: string[] }` props) — renders `null` when `calendars` is empty (self-hides when not connected/configured)

- [ ] **Step 1: Write the component**

```tsx
// src/components/features/settings/CalendarSelector.tsx
"use client";

import { useState, useTransition } from "react";
import {
  updateSelectedCalendars,
  type AvailableCalendar,
} from "@/lib/calendar/actions";
import { useToast } from "@/components/ui/Toast";

export default function CalendarSelector({
  calendars,
  initialSelected,
}: {
  calendars: AvailableCalendar[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function onSave() {
    startTransition(async () => {
      await updateSelectedCalendars(selected);
      showToast("Kalenderauswahl gespeichert");
    });
  }

  if (calendars.length === 0) return null;

  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Kalender-Auswahl
      </p>
      <ul className="mt-3">
        {calendars.map((cal) => (
          <li
            key={cal.id}
            className="flex items-center gap-3 border-b border-border py-3"
          >
            <input
              type="checkbox"
              id={`cal-${cal.id}`}
              checked={selected.includes(cal.id)}
              onChange={() => toggle(cal.id)}
              className="h-4 w-4 accent-accent"
            />
            <label
              htmlFor={`cal-${cal.id}`}
              className="flex-1 text-body text-on-surface"
            >
              {cal.summary}
              {cal.primary && (
                <span className="ml-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
                  primär
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="mt-4 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
      >
        {pending ? "Speichere…" : "Speichern"}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the Integrationen page**

In `src/app/(app)/settings/integrations/page.tsx`, add the import and fetch, and render it after `IntegrationStatus`:

```tsx
import SettingsHeader from "@/components/features/settings/SettingsHeader";
import IntegrationStatus from "@/components/features/settings/IntegrationStatus";
import CalendarSelector from "@/components/features/settings/CalendarSelector";
import { getSyncState, listAvailableCalendars } from "@/lib/calendar/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsIntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [syncState, calendars] = await Promise.all([
    getSyncState(),
    listAvailableCalendars(),
  ]);

  return (
    <section>
      <SettingsHeader title="Integrationen" />
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
      <CalendarSelector
        calendars={calendars}
        initialSelected={syncState?.selected_calendar_ids ?? ["primary"]}
      />
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, visit `/settings/integrations`:
- If Google Calendar is connected: checklist of calendars appears below the status badges; toggling + "Speichern" persists the selection and shows a toast; reloading the page keeps the saved selection checked.
- If not connected/configured: no checklist section renders (component returns `null`).
- `/today` still shows calendar events afterward.

⚠️ If this errors with a scope/permission issue from Google, the existing refresh token may need re-authorization for `calendarList.list` — this was flagged as an open risk in the design spec.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/settings/CalendarSelector.tsx src/app/\(app\)/settings/integrations/page.tsx
git commit -m "feat(settings): add calendar multi-select UI to Integrationen"
```

---

## Gruppe D — AI-Ausbau

### Task 11: Capture-Route vereinfachen + classify.ts löschen

**Files:**
- Modify: `src/app/api/capture/route.ts`
- Delete: `src/lib/ai/classify.ts`
- Delete: `src/lib/ai/classify.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `POST /api/capture` now always responds `{ type: "note", id, title }` with status 201 on success (or the existing 401/429/400/500 failure statuses) — the 207 "degraded" status is no longer produced. This response shape change is consumed by Task 12 (tests) and Task 13 (QuickCapture UI).

- [ ] **Step 1: Simplify the route handler**

In `src/app/api/capture/route.ts`, remove the import of `classify`/`CLASSIFY_MODEL`/`AreaContext`:

Remove this line:
```typescript
import { classify, CLASSIFY_MODEL, type AreaContext } from "@/lib/ai/classify";
```

Remove the `routineTiming` helper function entirely (it was only used for AI-classified routine creation):
```typescript
/**
 * Derive a routine's time-of-day grouping from a captured due time, if any.
 * Routines usually carry no time → "anytime" (TASK-035).
 */
function routineTiming(dueAt: string | null | undefined): {
  time_of_day: "morning" | "afternoon" | "evening" | "anytime";
} {
  if (!dueAt) return { time_of_day: "anytime" };
  const hour = Number(formatInTimeZone(new Date(dueAt), CAPTURE_TZ, "H"));
  const time_of_day =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return { time_of_day };
}
```

Also remove the now-unused `CAPTURE_TZ` constant and the `formatInTimeZone` import (both only existed for `routineTiming`):
```typescript
import { formatInTimeZone } from "date-fns-tz";
```
```typescript
const CAPTURE_TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";
```

Replace everything from step "1. Persist the raw capture first" through the end of the `POST` function body with:

```typescript
  // 1. Persist the capture as a plain inbox note. No classification step —
  // every capture is a note (AI classification removed).
  const { data: inbox, error: inboxError } = await db
    .from("inbox_items")
    .insert({
      user_id: userId,
      raw_text: text,
      source,
      status: "classified",
      classified_type: "note",
    })
    .select("id")
    .single();

  if (inboxError || !inbox) {
    return NextResponse.json(
      { error: "could not persist capture", details: inboxError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { type: "note", id: inbox.id, title: text },
    { status: 201 },
  );
}
```

Also replace the file's top docblock. Find:

```typescript
/**
 * Capture endpoint (TASK-014 / FR-001, latency logging TASK-024).
 *
 * The magic moment: raw text in → classified entry out, in under 5s. Order is
 * chosen so a classifier failure can never lose data (PRD § Reliability):
 *   1. persist inbox_item (status=pending) with the raw text
 *   2. classify
 *   3. create the target entry (task | journal; note stays as the inbox item)
 *   4. mark the inbox_item classified (or failed → 207 note fallback)
 *
 * Auth: a Supabase session (PWA) OR a Bearer token (iOS shortcut). Session
 * inserts run under RLS; token inserts use the admin client with an explicit
 * user_id resolved from the token. user_id is always set explicitly either way.
 */
```

Replace with:

```typescript
/**
 * Capture endpoint (TASK-014 / FR-001).
 *
 * Raw text in → inbox note out. No AI classification (removed) — every
 * capture is persisted as a plain note; task/journal/routine entries are
 * created manually via their own pages.
 *
 * Auth: a Supabase session (PWA) OR a Bearer token (iOS shortcut). Session
 * inserts run under RLS; token inserts use the admin client with an explicit
 * user_id resolved from the token. user_id is always set explicitly either way.
 */
```

- [ ] **Step 2: Delete the now-orphaned AI classifier files**

```bash
git rm src/lib/ai/classify.ts src/lib/ai/classify.test.ts
```

(confirmed via grep that `src/app/api/capture/route.ts` was the only production importer of `classify()`)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `capture.e2e.test.ts` (expected — fixed in Task 12) and possibly `Reclassify.tsx`/`schemas/capture.test.ts` referencing types still present at this point (those are fine, untouched until Tasks 14/15). No errors in `route.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/capture/route.ts
git commit -m "refactor(capture): remove AI classification, every capture becomes a note"
```

---

### Task 12: capture.e2e.test.ts aktualisieren

**Files:**
- Modify: `src/__tests__/capture.e2e.test.ts`

**Interfaces:**
- Consumes: `POST` from `src/app/api/capture/route.ts` (Task 11's new behavior)

- [ ] **Step 1: Update the mocks and top docblock**

Replace the top docblock:

```typescript
/**
 * End-to-end capture test (TASK-025).
 *
 * Token → POST "some text" → an inbox note with raw_text preserved. AI
 * classification was removed (TASK-014 refactor) — every capture is now a
 * plain inbox note. This covers auth, validation and rate-limiting around
 * the insert. Cross-check manually via the real iOS shortcut
 * (ios-shortcut/README.md).
 */
```

Remove `classify: vi.fn(),` from the `mocks` hoisted object, and remove the entire `vi.mock("@/lib/ai/classify", ...)` block:

```typescript
vi.mock("@/lib/ai/classify", () => ({
  classify: mocks.classify,
  CLASSIFY_MODEL: "claude-haiku-4-5",
  ClassificationError: class extends Error {},
}));
```

Remove the `AREAS` constant (no longer loaded by the route) and shrink `INSERT_RETURNS` to just `inbox_items`:

```typescript
const INSERT_RETURNS: Record<string, { id: string }> = {
  inbox_items: { id: "inbox-1" },
};
```

Simplify the admin client mock — the route no longer calls `.select()` on `areas` or `.update()`, only a single `.insert().select().single()` on `inbox_items`:

```typescript
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
```

- [ ] **Step 2: Update `beforeEach` (remove the classify mock setup)**

```typescript
  beforeEach(() => {
    mocks.inserted.length = 0;
    mocks.serverCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    mocks.resolveToken.mockResolvedValue({ ok: true, userId: "user-1" });
  });
```

- [ ] **Step 3: Replace the two classification tests with one note-creation test**

Remove the `it("token + spoken sentence → task in Haus with due_at", ...)` and `it("classifies a recurring habit into a routine, not a task (TASK-035)", ...)` tests entirely. Replace them with:

```typescript
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
```

- [ ] **Step 4: Remove the now-obsolete 207-fallback test**

Remove the `it("falls back to a 207 inbox note when classification fails", ...)` test entirely — there is no classification step left to fail.

The remaining tests (`rejects a missing token with 401`, `rejects an expired token`, `rejects a revoked token`, `rejects an oversized capture with 400`, `rejects a malformed body with 400`, `returns 429 with a Retry-After header`) stay unchanged.

- [ ] **Step 5: Run the test file**

Run: `npx vitest run src/__tests__/capture.e2e.test.ts`
Expected: PASS (7 tests: 1 new note-creation test + 6 unchanged auth/validation/rate-limit tests)

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/capture.e2e.test.ts
git commit -m "test(capture): update e2e test for classification-free capture"
```

---

### Task 13: QuickCapture Toast-Logik vereinfachen

**Files:**
- Modify: `src/components/features/capture/QuickCapture.tsx`

**Interfaces:**
- Consumes: `POST /api/capture` (Task 11's simplified response — always 201 `{type:"note",...}` on success)

- [ ] **Step 1: Remove the now-unused `CaptureResult` type**

Remove:
```typescript
type CaptureResult = {
  type?: string;
  title?: string;
  area?: { id: string; name: string } | null;
  note?: string;
};
```

- [ ] **Step 2: Simplify `submit()`**

Replace the body of `submit()` from the `fetch` call onward:

```typescript
  async function submit() {
    const value = text.trim();
    if (!value || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          source: usedVoice.current ? "pwa_voice" : "pwa_text",
        }),
      });
      if (!res.ok) {
        setError("Konnte nicht erfassen — kurz prüfen?");
        setPending(false);
        return;
      }
      usedVoice.current = false;
      close();
      showToast("In Inbox abgelegt");
    } catch {
      setError("Konnte nicht erfassen — kurz prüfen?");
    } finally {
      setPending(false);
    }
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `QuickCapture.tsx`

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, press Cmd/Ctrl+J, type something, submit → toast reads "In Inbox abgelegt", overlay closes.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/capture/QuickCapture.tsx
git commit -m "refactor(capture): simplify QuickCapture toast for classification-free response"
```

---

### Task 14: Reclassify entfernen

**Files:**
- Delete: `src/components/features/capture/Reclassify.tsx`
- Delete: `src/lib/inbox/reclassify.ts`
- Delete: `src/__tests__/reclassify.test.ts`
- Modify: `src/components/features/today/TodayView.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `TodayView`'s `RecentRow` no longer offers manual reclassification; `RecentRow` drops its now-unused `areas` prop. `TodayView`'s own `areas` prop is unaffected (still used elsewhere for the "Neue Aufgabe" editor).

- [ ] **Step 1: Remove the Reclassify import and usage from TodayView**

In `src/components/features/today/TodayView.tsx`, remove this import:

```typescript
import Reclassify from "@/components/features/capture/Reclassify";
```

Change the `RecentRow` function from:

```tsx
function RecentRow({
  item,
  areas,
}: {
  item: RecentInboxItem;
  areas: AreaOption[];
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <span className="flex-1 truncate text-body-sm text-on-surface-muted">
        {item.raw_text}
      </span>
      <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
        {item.status === "failed" ? "inbox" : (item.classified_type ?? "")}
      </span>
      <Reclassify item={item} areas={areas} />
    </li>
  );
}
```

to:

```tsx
function RecentRow({ item }: { item: RecentInboxItem }) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <span className="flex-1 truncate text-body-sm text-on-surface-muted">
        {item.raw_text}
      </span>
      <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
        {item.status === "failed" ? "inbox" : (item.classified_type ?? "")}
      </span>
    </li>
  );
}
```

Find the call site `<RecentRow key={i.id} item={i} areas={areas} />` and change it to `<RecentRow key={i.id} item={i} />`.

Do NOT remove `TodayView`'s own `areas` prop (used elsewhere in the file for the manual "Neue Aufgabe" task editor — confirmed via `grep -n areas` that it's referenced at another call site beyond `RecentRow`).

- [ ] **Step 2: Delete the Reclassify files**

```bash
git rm src/components/features/capture/Reclassify.tsx src/lib/inbox/reclassify.ts src/__tests__/reclassify.test.ts
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `Reclassify` or `reclassify`

- [ ] **Step 4: Run the Today-related tests**

Run: `npx vitest run src/__tests__/journal.test.ts src/__tests__/areas.test.ts`
Expected: PASS (sanity check — neither file references Reclassify, but they touch adjacent Today/Areas data paths)

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/today` → "kürzlich erfasst" list renders without a reclassify control, no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/today/TodayView.tsx
git commit -m "refactor(capture): remove Reclassify UI and manual re-filing"
```

---

### Task 15: ClassificationSchema aus schemas/capture.ts entfernen

**Files:**
- Modify: `src/lib/schemas/capture.ts`
- Modify: `src/lib/schemas/capture.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `schemas/capture.ts` exports only `CAPTURE_SOURCES`, `CAPTURE_TEXT_MAX`, `CaptureInputSchema`, `CaptureInput`, `CaptureSource` — `ClassificationSchema`/`CLASSIFICATION_TYPES`/`Classification`/`ClassificationType` are removed (confirmed via grep: their only consumers were `classify.ts`, `Reclassify.tsx`, `reclassify.ts` — all deleted in Tasks 11/14)

- [ ] **Step 1: Remove the classification exports**

In `src/lib/schemas/capture.ts`, remove:

```typescript
export const CLASSIFICATION_TYPES = [
  "task",
  "note",
  "journal",
  "routine",
] as const;
```

```typescript
export const ClassificationSchema = z.object({
  type: z.enum(CLASSIFICATION_TYPES),
  title: z.string().trim().min(1),
  // Absolute ISO-8601 instant resolved by the model in the user timezone, or
  // null when the capture carries no due date.
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Slug of an existing area, or null/omitted → "unzugeordnet" (FR-002).
  area_slug: z.string().trim().min(1).nullable().optional(),
});
```

```typescript
export type Classification = z.infer<typeof ClassificationSchema>;
export type ClassificationType = (typeof CLASSIFICATION_TYPES)[number];
```

Update the file's top docblock:

```typescript
/**
 * Zod schema for the capture pipeline (TASK-012).
 *
 * `CaptureInput` validates what reaches POST /api/capture (from the iOS
 * shortcut or the PWA quick-capture overlay).
 */
```

- [ ] **Step 2: Update capture.test.ts**

Remove the `ClassificationSchema` import and the entire `describe("ClassificationSchema", ...)` block from `src/lib/schemas/capture.test.ts`, leaving:

```typescript
import { describe, expect, it } from "vitest";
import { CaptureInputSchema } from "./capture";

// TASK-012 verify: valid inputs pass, invalid inputs are rejected.
describe("CaptureInputSchema", () => {
  it("accepts a valid capture", () => {
    const parsed = CaptureInputSchema.parse({
      text: "  Öl checken  ",
      source: "ios_shortcut",
    });
    expect(parsed.text).toBe("Öl checken"); // trimmed
    expect(parsed.source).toBe("ios_shortcut");
  });

  it("rejects empty / whitespace-only text", () => {
    expect(() =>
      CaptureInputSchema.parse({ text: "   ", source: "pwa_text" }),
    ).toThrow();
  });

  it("rejects an unknown source", () => {
    expect(() =>
      CaptureInputSchema.parse({ text: "hi", source: "carrier_pigeon" }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run the test file**

Run: `npx vitest run src/lib/schemas/capture.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors — this confirms no other file still imports `ClassificationSchema`/`ClassificationType`/`Classification`/`CLASSIFICATION_TYPES`

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/capture.ts src/lib/schemas/capture.test.ts
git commit -m "refactor(schemas): remove ClassificationSchema, no longer used"
```

---

### Task 16: KI-Metriken aus MetricsPanel + metrics/summary.ts entfernen

**Files:**
- Modify: `src/components/features/settings/MetricsPanel.tsx`
- Modify: `src/lib/metrics/summary.ts`
- Modify: `src/lib/metrics/summary.test.ts`

**Interfaces:**
- Produces: `MetricsSummary` type shrinks to `{ windowDays, capturesToday, capturesInWindow, avgPerDay, voiceCaptures, textCaptures, voiceSharePct, failureCount, failureRatePct }` — `classifiedCount`, `correctedCount`, `correctionRatePct`, `captureP95Ms`, `sampleSize` removed. `percentile()` export removed (no longer used anywhere).

- [ ] **Step 1: Write the updated test first**

Replace the entire content of `src/lib/metrics/summary.test.ts` with:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rows: [] as unknown[],
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from() {
      const q = {
        select: () => q,
        eq: () => q,
        gte: () => q,
        then: (res: (v: unknown) => void) =>
          res({ data: mocks.rows, error: null }),
      };
      return q;
    },
  };
}

import { metricsSummary } from "./summary";

describe("metricsSummary (TASK-057)", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(makeClient());
  });

  it("derives capture, voice and failure metrics", async () => {
    const day = "2026-07-01T09:00:00.000Z";
    mocks.rows = [
      { source: "pwa_voice", status: "classified", created_at: day },
      { source: "pwa_text", status: "classified", created_at: day },
      { source: "ios_shortcut", status: "classified", created_at: day },
      { source: "pwa_text", status: "failed", created_at: day },
    ];

    const m = await metricsSummary(
      new Date("2026-07-01T10:00:00.000Z"),
      "Europe/Berlin",
    );

    expect(m.capturesToday).toBe(4);
    expect(m.voiceCaptures).toBe(2);
    expect(m.textCaptures).toBe(2);
    expect(m.voiceSharePct).toBe(50);
    expect(m.failureRatePct).toBe(25);
  });

  it("returns the empty summary when there are no captures", async () => {
    mocks.rows = [];
    const m = await metricsSummary(new Date("2026-07-01T10:00:00.000Z"));
    expect(m.capturesInWindow).toBe(0);
    expect(m.failureRatePct).toBeNull();
  });
});
```

- [ ] **Step 2: Run the updated test against the still-unchanged implementation**

Run: `npx vitest run src/lib/metrics/summary.test.ts`
Expected: PASS already — this task removes fields rather than adding behavior, so the trimmed-down test asserts a subset of what the current implementation already returns. There is no red state to observe here; proceed straight to Step 3 to remove the now-dead AI fields from the implementation, then re-run in Step 4 as confirmation nothing broke.

- [ ] **Step 3: Update summary.ts**

Update the top docblock in `src/lib/metrics/summary.ts`:

```typescript
/**
 * Success-metrics aggregation (TASK-057, Vision § Success Metrics). Mirrors the
 * shape of today/summary.ts: a single server function, scoped to the signed-in
 * user, returning a typed summary. Everything is derived from `inbox_items`:
 *
 *  - daily capture count (today + recent daily average) — primary metric
 *  - voice:text ratio — from `source`
 *  - failure rate — status = 'failed'
 *
 * Single-user scale: reads a bounded recent window (default 30 days).
 */
```

Replace the `MetricsSummary` type:

```typescript
export type MetricsSummary = {
  windowDays: number;
  capturesToday: number;
  capturesInWindow: number;
  avgPerDay: number;
  voiceCaptures: number;
  textCaptures: number;
  voiceSharePct: number | null;
  failureCount: number;
  failureRatePct: number | null;
};
```

Remove the `percentile()` function entirely:

```typescript
/** p95 of a numeric sample (nearest-rank), or null when empty. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}
```

Replace the `InboxRow` type:

```typescript
type InboxRow = {
  source: string | null;
  status: string | null;
  created_at: string;
};
```

Replace the `EMPTY` constant:

```typescript
const EMPTY: MetricsSummary = {
  windowDays: WINDOW_DAYS,
  capturesToday: 0,
  capturesInWindow: 0,
  avgPerDay: 0,
  voiceCaptures: 0,
  textCaptures: 0,
  voiceSharePct: null,
  failureCount: 0,
  failureRatePct: null,
};
```

In `metricsSummary()`, change the select call:

```typescript
  const { data } = await supabase
    .from("inbox_items")
    .select("source, status, created_at")
    .eq("user_id", user.id)
    .gte("created_at", windowStart);
```

Replace the aggregation loop:

```typescript
  let capturesToday = 0;
  let voiceCaptures = 0;
  let textCaptures = 0;
  let failureCount = 0;

  for (const r of rows) {
    if (r.created_at >= todayStart && r.created_at < todayEnd) capturesToday++;
    if (r.source && VOICE_SOURCES.has(r.source)) voiceCaptures++;
    else if (r.source === "pwa_text") textCaptures++;
    if (r.status === "failed") failureCount++;
  }
```

Replace the return statement:

```typescript
  return {
    windowDays: WINDOW_DAYS,
    capturesToday,
    capturesInWindow: rows.length,
    avgPerDay: Math.round((rows.length / WINDOW_DAYS) * 10) / 10,
    voiceCaptures,
    textCaptures,
    voiceSharePct: pct(voiceCaptures, voiceText),
    failureCount,
    failureRatePct: pct(failureCount, rows.length),
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/metrics/summary.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Update MetricsPanel.tsx**

Remove the `seconds()` helper:

```typescript
function seconds(ms: number | null): string {
  return ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`;
}
```

Remove the "KI-Korrekturrate" and "Capture p95" rows from the `<ul>`:

```tsx
        <Row
          label="KI-Korrekturrate"
          value={pct(data.correctionRatePct)}
          hint="gut <20 · top <10"
        />
        <Row
          label="Capture p95"
          value={seconds(data.captureP95Ms)}
          hint="gut <5s · top <3s"
        />
```

leaving the `<ul>` with: „Captures heute", „Ø Captures / Tag", „Voice-Anteil", „Fehlerrate".

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, visit `/settings/insights` → shows exactly 4 metric rows (no KI-Korrekturrate, no Capture p95).

- [ ] **Step 8: Commit**

```bash
git add src/components/features/settings/MetricsPanel.tsx src/lib/metrics/summary.ts src/lib/metrics/summary.test.ts
git commit -m "refactor(metrics): remove AI correction-rate and capture-latency metrics"
```

---

### Task 17: iOS-Shortcut-Doku aktualisieren

**Files:**
- Modify: `ios-shortcut/README.md`

- [ ] **Step 1: Note that the confirmation now shows raw text**

In `ios-shortcut/README.md`, find:

```
4. Add the **"Get Dictionary Value"** action:
   - Key `title` from **Contents of URL** (for the confirmation).
```

Replace with:

```
4. Add the **"Get Dictionary Value"** action:
   - Key `title` from **Contents of URL** (for the confirmation). Note: `title`
     is now the raw dictated text verbatim (AI title-cleanup was removed) —
     the confirmation will read back exactly what you said.
```

- [ ] **Step 2: Update the documented response shapes**

Find:

```
Responses:

- `201` — captured: `{ "type", "id", "title", "area": { "id", "name" } | null, "due_at" }`
- `207` — AI classification failed; stored as a note in the inbox (no data
  loss): `{ "type": "note", "id", "note": "unklassifiziert, in Inbox" }`
- `401` — token invalid/expired → create a new one in Settings.
- `429` — rate limit (60/min) reached → wait briefly.
```

Replace with:

```
Responses:

- `201` — captured as an inbox note: `{ "type": "note", "id", "title" }`
  (`title` is the raw dictated text — there is no AI classification anymore).
- `401` — token invalid/expired → create a new one in Settings.
- `429` — rate limit (60/min) reached → wait briefly.
```

- [ ] **Step 3: Commit**

```bash
git add ios-shortcut/README.md
git commit -m "docs(ios-shortcut): note that confirmation now shows the raw captured text"
```

---

## Gruppe E — Doku & Verifikation

### Task 18: PRD an neue Realität anpassen

**Files:**
- Modify: `docs/prd.md`

- [ ] **Step 1: Update the Areas screen entry**

Find:
```
### Screen: Areas
Route: `/areas` · Purpose: Lebensbereiche anlegen/ordnen · Components: `card`, `drag-handle`, `button-primary`.
```

Replace with:
```
### Screen: Areas
Route: `/settings/areas` (Settings-Unterseite) · Purpose: Lebensbereiche anlegen/ordnen · Components: `card`, `drag-handle`, `button-primary`.
```

- [ ] **Step 2: Update the Settings screen entry**

Find:
```
### Screen: Settings
Route: `/settings` · Purpose: API-Tokens, Google-Calendar-Verbindung, Zeitzone, Integrations-Status · Components: `card`, `button-primary`, `status-badge`, `code-block` (Token-Anzeige einmalig).
```

Replace with:
```
### Screen: Settings
Route: `/settings/*` (Unterseiten mit In-Page-Tabs: Integrationen · Tokens · Insights · Erinnerungen · Areas) · Purpose: Integrations-Status inkl. Kalender-Mehrfachauswahl, API-Tokens, Capture-Metriken, Journal-Erinnerungs-Status, Areas-Verwaltung · Components: `card`, `button-primary`, `status-badge`, `code-block` (Token-Anzeige einmalig), `tabs`, `checkbox` (Kalenderauswahl).
```

- [ ] **Step 3: Update the Quick Capture screen's Success state**

Find:
```
States: Idle · Recording (Pulsanimation) · Submitting (Spinner) · Success (knappe Bestätigung mit Typ + Area) · Error.
```

Replace with:
```
States: Idle · Recording (Pulsanimation) · Submitting (Spinner) · Success (knappe Bestätigung „In Inbox abgelegt") · Error.
```

- [ ] **Step 4: Rewrite FR-001, delete FR-002**

Find:
```
**FR-001: Capture-Endpoint mit KI-Klassifikation**
Priority: P0
Description: `/api/capture` nimmt Rohtext + Source, legt ein `inbox_item` an, ruft die Anthropic-Klassifikation auf und erzeugt den Zieleintrag mit `area_id` und ggf. `due_at`.
Acceptance Criteria:
- Klassifikation liefert validiertes JSON `{type, title, due_at?, area_slug?}`.
- Bei Parse-/Validierungsfehler Fallback auf Notiz in der Inbox, Response 207.
- p95-Latenz < 5 s.
Related Stories: US-001, US-002

**FR-002: KI-Klassifikationslogik**
Priority: P0
Description: `lib/ai/classify.ts` mappt Rohtext auf Typ, Titel, Fälligkeit und passende Area (aus den existierenden Areas des Users). System-Prompt mit Few-Shot-Beispielen; Ausgabe striktes JSON.
Acceptance Criteria:
- Vorhandene Areas werden als Kontext mitgegeben; Klassifikation wählt eine existierende oder schlägt „unzugeordnet" vor.
- Relative Zeitangaben („morgen 17 Uhr") werden in absolute `due_at` in der User-Zeitzone aufgelöst.
```

Replace with:
```
**FR-001: Capture-Endpoint**
Priority: P0
Description: `/api/capture` nimmt Rohtext + Source entgegen und legt ihn als `inbox_item` (Notiz) an. Keine automatische Klassifikation (entfernt) — Tasks/Routinen/Journal-Einträge werden manuell über ihre jeweiligen Seiten angelegt.
Acceptance Criteria:
- Jede valide Capture wird persistiert, nie verworfen.
- Response liefert `{type: "note", id, title}`.
Related Stories: US-001
```

(this leaves an FR-002 numbering gap, which is fine — no other FR needs renumbering)

- [ ] **Step 5: Update FR-010's description**

Find:
```
**FR-010: Google Calendar read-only**
Priority: P1
Description: Cron synct Kalendertermine read-only in einen Cache zur Anzeige im Today-View.
```

Replace with:
```
**FR-010: Google Calendar read-only**
Priority: P1
Description: Cron synct Kalendertermine der vom User in den Settings ausgewählten Kalender (Default: primär) read-only in einen Cache zur Anzeige im Today-View.
```

- [ ] **Step 6: Delete FR-012**

Find:
```
**FR-012: Reklassifikation / Korrektur**
Priority: P2
Description: Einen falsch einsortierten Eintrag in einen anderen Typ/Area verschieben; Korrektur wird (für spätere Prompt-Verbesserung) protokolliert.
```

Delete this block entirely (blank line before `## 7. Non-Functional Requirements` stays).

- [ ] **Step 7: Update the Capture edge-cases table**

Find:
```
### Feature: Capture
| Scenario | Expected Behavior | Priority |
|---|---|---|
| Anthropic-API down/timeout | Rohtext bleibt als Notiz in Inbox (status=failed), Response 207, kein Verlust | P0 |
| Ungültiges/leeres Diktat | 400 mit klarer Meldung, kein Insert | P0 |
| Klassifikation wählt nicht-existente Area | Fallback „unzugeordnet", Eintrag trotzdem erstellt | P1 |
| Rate-Limit überschritten | 429, Shortcut zeigt knappe Fehlermeldung | P1 |
| Ungültiges/abgelaufenes Token | 401, Hinweis Token neu erzeugen | P0 |
```

Replace with:
```
### Feature: Capture
| Scenario | Expected Behavior | Priority |
|---|---|---|
| Ungültiges/leeres Diktat | 400 mit klarer Meldung, kein Insert | P0 |
| Rate-Limit überschritten | 429, Shortcut zeigt knappe Fehlermeldung | P1 |
| Ungültiges/abgelaufenes Token | 401, Hinweis Token neu erzeugen | P0 |
```

- [ ] **Step 8: Add a calendar-selection edge case**

Find:
```
### Feature: Today / Calendar
| Scenario | Expected Behavior | Priority |
|---|---|---|
| Google Calendar nicht verbunden/Fehler | Kalenderbereich zeigt Hinweis, Rest funktioniert | P1 |
| Calendar-Sync-Cron schlägt fehl | Letzter Cache bleibt sichtbar, Stale-Hinweis | P2 |
```

Replace with:
```
### Feature: Today / Calendar
| Scenario | Expected Behavior | Priority |
|---|---|---|
| Google Calendar nicht verbunden/Fehler | Kalenderbereich zeigt Hinweis, Rest funktioniert | P1 |
| Calendar-Sync-Cron schlägt fehl | Letzter Cache bleibt sichtbar, Stale-Hinweis | P2 |
| Keine Kalender-Auswahl gespeichert | Fallback auf `primary` | P2 |
```

- [ ] **Step 9: Commit**

```bash
git add docs/prd.md
git commit -m "docs(prd): sync PRD with Settings restructure and AI removal"
```

---

### Task 19: Vollständige Verifikation

**Files:** none (verification only)

- [ ] **Step 1: Full automated suite**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run && npm run build`
Expected: all four green. If `build` fails on an unrelated pre-existing issue, note it separately — do not silently work around it.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev` and walk through:
- `/settings` redirects to `/settings/integrations`; all 5 tabs (Integrationen/Tokens/Insights/Erinnerungen/Areas) work and deep-link correctly; active tab matches the URL.
- `/areas` redirects to `/settings/areas`; `AreaManager` still drag-reorders, creates, edits, reassigns orphans.
- Bottom nav shows exactly 6 items, no "Areas".
- `/settings/tokens`: create + revoke a token still works.
- `/settings/insights`: exactly 4 metric rows, no KI-Korrekturrate/Capture p95.
- `/settings/reminders`: Telegram status + last-sent timestamp (or "—").
- `/settings/integrations`: calendar checklist appears (if connected), selecting calendars + "Speichern" persists and re-syncs; `/today` reflects events from all selected calendars.
- Quick-Capture (Cmd/Ctrl+J): submitting text always shows "In Inbox abgelegt" and the item appears in `/today`'s "kürzlich erfasst" list without a reclassify control.

- [ ] **Step 3: Report**

Summarize pass/fail for each item above. If anything fails, fix it in a follow-up commit before considering this plan done — do not leave a task half-finished.
