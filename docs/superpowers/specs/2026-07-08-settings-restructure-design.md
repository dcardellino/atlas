# Settings: Unterseiten, Areas-Migration, AI-Ausbau, Kalender-Auswahl

**Datum:** 2026-07-08
**Status:** Approved (Design)
**Branch:** `refactor/settings-restructure`

## Kontext / Problem

Die Settings-Seite (`src/app/(app)/settings/page.tsx`) stapelt aktuell drei Sektionen
untereinander auf einer einzigen Seite: `MetricsPanel` (Insights), `TokenManager`
(Shortcut Tokens), `IntegrationStatus` (Integrationen). Eine vierte Sektion
(Journal-Erinnerungen) soll dazukommen — auf einer Seite wird das unübersichtlich.

Gleichzeitig lebt `Areas` als eigenständiger Punkt in der globalen Bottom-Navigation
(`src/components/ui/Nav.tsx`), obwohl es inhaltlich eine Konfigurationsseite ist wie
die anderen Settings-Sektionen auch.

Die KI-Klassifizierung im Capture-Flow (`src/lib/ai/classify.ts`, aufgerufen aus
`src/app/api/capture/route.ts`) wird nicht genutzt — Tasks, Journal-Einträge und
Routinen werden manuell über ihre jeweiligen Seiten angelegt, nicht über Capture.
Der Code, die zugehörige Reclassify-UI und die KI-Metriken im Insights-Panel sollen
raus.

Die Google-Kalender-Integration (`src/lib/calendar/`) fragt aktuell hart verdrahtet
nur den `primary`-Kalender ab; es gibt keine Möglichkeit, weitere Kalender
auszuwählen.

**Ziel:** Settings bekommt Unterseiten mit In-Page-Tabs (analog zum bestehenden
Workout-Muster), Areas zieht dorthin um, die KI-Klassifizierung wird entfernt, und
die Kalender-Integration bekommt eine Mehrfachauswahl.

## Nicht-Ziele

- Der Capture-Endpoint (`/api/capture`), das QuickCapture-Overlay (Cmd/Ctrl+J) und
  der iOS-Shortcut bleiben bestehen — sie werden vereinfacht (jede Capture wird zur
  Notiz), nicht entfernt.
- Keine Migration, die die KI-Spalten auf `inbox_items` (`ai_meta`, `corrected_type`,
  `corrected_area_id`, `corrected_at`) droppt. Sie bleiben ungenutzt liegen.
- Journal-Erinnerungen: nur Statusanzeige (Telegram konfiguriert? / letzte gesendete
  Erinnerung). Keine konfigurierbaren Zeiten — das ist ein möglicher späterer Schritt.
- `TodayView.tsx` / `listTodayEvents()` bleiben unverändert — sie filtern nur nach
  Datum, unabhängig davon aus welchem Kalender ein Event stammt.
- Keine Änderung an der Drag-Reorder-, Farb- oder Icon-Logik von `AreaManager` — nur
  der Ort der Seite ändert sich.

## Entwurf

### 1. Settings-Unterseiten-Routing

Neue Struktur nach dem bestehenden Workout-Tabs-Muster (`WorkoutTabs.tsx` /
`WorkoutHeader.tsx`): kein gemeinsames `layout.tsx`, jede `page.tsx` rendert ihren
Header selbst, der intern die Tabs mitbringt.

```
src/app/(app)/settings/
├── page.tsx               → redirect("/settings/integrations")
├── integrations/page.tsx  → IntegrationStatus + CalendarSelector
├── tokens/page.tsx        → TokenManager
├── insights/page.tsx      → MetricsPanel (ohne KI-Metriken)
├── reminders/page.tsx     → ReminderStatus (neu)
└── areas/page.tsx         → AreaManager (verschoben von /areas)
```

Neue Komponenten:

- `src/components/features/settings/SettingsTabs.tsx` — analog zu `WorkoutTabs.tsx`
  (Client, `usePathname()`, `aria-current`): 5 Tabs (Integrationen / Tokens /
  Insights / Erinnerungen / Areas), erste Route `exact: true`, Rest über
  `startsWith`.
- `src/components/features/settings/SettingsHeader.tsx` — analog zu
  `WorkoutHeader.tsx`: Mono-Eyebrow „Einstellungen" + Serif-H1 (Titel als Prop) +
  `SettingsTabs` darunter. Rein präsentational, kein Client nötig. Jede
  Settings-`page.tsx` ruft `<SettingsHeader title="..." />` statt des bisherigen
  eigenen `<section>`-Headers auf.

`src/app/(app)/areas/page.tsx`: Inhalt (aktuell `AreaManager` + Datenladen) entfernt,
wird zu `redirect("/settings/areas")` aus `next/navigation` — bestehende
Bookmarks/Links auf `/areas` funktionieren weiter.

`src/components/ui/Nav.tsx`: Eintrag `{ href: "/areas", label: "Areas" }` (Zeile 10)
entfernen → 6 statt 7 Items.

### 2. AI-Ausbau

**Zu löschende Dateien:**

- `src/lib/ai/classify.ts`
- `src/components/features/capture/Reclassify.tsx`
- `src/lib/inbox/reclassify.ts`

**`src/app/api/capture/route.ts` — Kernvereinfachung:** Die Schritte „Areas als
Klassifizierungs-Kontext laden", `classify()`-Aufruf, Task/Routine/Journal-Branch
und der abschließende Klassifizierungs-Update entfallen. Jede Capture wird direkt
und terminal als Notiz persistiert:

```typescript
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

return NextResponse.json({ type: "note", id: inbox.id, title: text }, { status: 201 });
```

Auch `routineTiming()` (nur für die entfallende Routinen-Erstellung gebraucht) und
der Import aus `@/lib/ai/classify` entfallen. Die Rate-Limit- und Auth-Logik
(`authenticate()`, `rateLimited()`) bleibt unverändert.

**Response-Verhalten ändert sich:** `type` ist immer `"note"`, `area`/`due_at`
immer `null`, `title` ist der rohe erfasste Text statt eines KI-verfeinerten Titels.
Das entspricht bereits exakt dem heutigen 207-Fallback-Shape — kein neuer Fall für
die Clients.

**QuickCapture (`src/components/features/capture/QuickCapture.tsx`):** Die
Toast-Logik verzweigt aktuell auf `data.type`/Status 207 zwischen „In Inbox
abgelegt" und „Erfasst — Bereich X". Da `type` künftig immer `"note"` ist, wird der
zweite Branch nie mehr erreicht — die Verzweigung wird auf einen festen Text „In
Inbox abgelegt" vereinfacht, die jetzt ungenutzte `area`-Ableitung aus der Response
entfällt mit.

**iOS-Shortcut (`ios-shortcut/README.md`):** Zeigt künftig den rohen Diktat-Text
statt eines KI-verfeinerten Titels in der Bestätigung — funktional unverändert, nur
geringere Titel-Qualität. Kurzer Doku-Hinweis reicht, kein Code-Change am Shortcut
nötig.

**Tests (`src/__tests__/capture.e2e.test.ts`):** 9 bestehende Tests. Die beiden
Klassifizierungs-Tests („spoken sentence → task in Haus", „recurring habit →
routine") testen den entfallenen Pfad und werden durch einen Test „jede Capture wird
zur Notiz" ersetzt. Die restlichen 7 (Auth-Fehler, Rate-Limit, Validierung) bleiben
inhaltlich bestehen, verlieren aber ihre `classify()`-Mocks.

**MetricsPanel (`src/components/features/settings/MetricsPanel.tsx`):** Die Rows
„KI-Korrekturrate" und „Capture p95" (Zeilen 59–68) entfernen; der dadurch
ungenutzte `seconds()`-Helper (Zeilen 37–39) entfällt mit. Übrig bleiben: Captures
heute, Ø Captures/Tag, Voice-Anteil, Fehlerrate.

**`src/lib/metrics/summary.ts`:** `correctionRatePct`, `captureP95Ms`,
`classifiedCount`, `correctedCount` aus dem `MetricsSummary`-Typ, dem `EMPTY`-Objekt
und der Berechnungsschleife entfernen. `ai_meta`, `corrected_at` aus dem
Supabase-`select()` (Zeile 91) entfernen. Der `percentile()`-Export und das
`latencies`-Array-Tracking entfallen, da nichts mehr einen Perzentil-Wert braucht.

**Env-Vars:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` werden nirgends mehr
referenziert (optional aus `.env` entfernen — kein Code-Zwang).

### 3. Areas-Migration (Details siehe Abschnitt 1) & Journal-Erinnerungen

Neue Komponente `src/components/features/settings/ReminderStatus.tsx` (Server
Component, presentational, analog zu `IntegrationStatus`-Optik):

- **Telegram konfiguriert?** — derselbe Check wie in `IntegrationStatus.tsx`
  (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` gesetzt).
- **Letzte gesendete Erinnerung** — neue Funktion `getLastReminderSentAt()` in
  `src/lib/tasks/actions.ts`: liest `MAX(reminder_sent_at)` aus `tasks` für den
  aktuellen User.

### 4. Kalender-Mehrfachauswahl

**`src/lib/calendar/google.ts`:**

- Die bisher feste `EVENTS_URL`-Konstante (`/calendars/primary/events`) wird zu
  einer kleinen URL-Builder-Funktion, die eine `calendarId` einsetzt.
- `fetchEvents()` bekommt einen zusätzlichen `calendarId`-Parameter.
- `normalizeEvent()` bekommt `calendar_id` als Parameter statt ihn hart auf
  `"primary"` zu setzen.
- Neue Funktion `fetchCalendarList(accessToken, fetchImpl?)` →
  `GET https://www.googleapis.com/calendar/v3/users/me/calendarList`, liefert
  `{ id, summary, primary? }[]`.

**Neue Migration** `supabase/migrations/0016_calendar_multi_select.sql`:

```sql
alter table calendar_sync_state
  add column if not exists selected_calendar_ids text[] not null default array['primary'];

alter table calendar_events
  drop constraint if exists calendar_events_user_id_external_id_key,
  add constraint calendar_events_user_id_calendar_id_external_id_key
    unique (user_id, calendar_id, external_id);

notify pgrst, 'reload schema';
```

Der genaue Default-Name des bestehenden Unique-Constraints wird vor der Umsetzung
per `\d calendar_events` (oder Supabase-Dashboard) verifiziert, falls Postgres ihn
anders benannt hat. Grund für die Constraint-Änderung: Google-Event-IDs sind nur
innerhalb eines Kalenders eindeutig — bei mehreren ausgewählten Kalendern könnten
sonst IDs kollidieren.

**`src/lib/calendar/sync.ts`:**

- Liest `selected_calendar_ids` aus `calendar_sync_state` (Fallback `['primary']`,
  falls noch nicht gesetzt).
- Iteriert pro Kalender-ID: `fetchEvents(token, calendarId, timeMin, timeMax)`,
  normalisiert mit der jeweiligen `calendar_id`.
- Der Upsert-`onConflict` (aktuell `"user_id,external_id"`, Zeile 37) wird auf
  `"user_id,calendar_id,external_id"` angepasst. Die Prune-Logik (Löschen nicht
  aktualisierter Zeilen) bleibt unverändert, da pro Sync-Lauf weiterhin alle
  ausgewählten Kalender komplett neu abgefragt werden.

**`src/lib/calendar/actions.ts`:** zwei neue Funktionen

- `listAvailableCalendars()` — `getAccessToken()` + `fetchCalendarList()`, für die
  UI.
- `updateSelectedCalendars(ids: string[])` — schreibt `selected_calendar_ids` in
  `calendar_sync_state`, ruft danach `syncCalendarForUser()` auf, damit die Auswahl
  sofort sichtbar wird.

**Neue UI-Komponente** `src/components/features/settings/CalendarSelector.tsx`
(Client, analog zur Optik von `IntegrationStatus.tsx`): Checkliste der verfügbaren
Kalender, nur sichtbar wenn `calendar.connected`. Wird auf
`src/app/(app)/settings/integrations/page.tsx` unterhalb der bestehenden
`IntegrationStatus`-Sektion gerendert.

⚠️ **Offener Punkt:** Falls der bestehende Google-Refresh-Token mit einem auf
`primary` beschränkten Scope erstellt wurde, könnte `calendarList.list` eine
Neu-Autorisierung erfordern. Zeigt sich beim Testen; kein Blocker für die Planung.

## Verifikation

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — alle grün.
- Migration `0016` via `supabase db push` angewandt (Worktree-Hinweis: falls in
  einem separaten Git-Worktree gearbeitet wird, braucht dieser einen eigenen
  `supabase link`, sonst zeigen Migration-Checks auf das falsche Projekt).
- Manuell (`npm run dev`):
  - `/settings` redirected zu `/settings/integrations`; alle 5 Tabs erreichbar,
    aktiver Tab stimmt mit der URL überein, Deep-Links (z. B. `/settings/tokens`
    direkt aufrufen) funktionieren.
  - `/areas` redirected zu `/settings/areas`; `AreaManager` funktioniert unverändert
    (Drag-Reorder, Create, Edit, Orphan-Reassign).
  - Bottom-Nav zeigt 6 statt 7 Einträge, kein „Areas" mehr.
  - Quick-Capture (Cmd/Ctrl+J) legt eine Notiz an, landet in der Inbox, Toast zeigt
    „In Inbox abgelegt".
  - `/settings/integrations`: Kalender-Checkliste erscheint, Auswahl ändern löst
    Sync aus, Today-View zeigt Events aus allen ausgewählten Kalendern.
  - `/settings/insights` zeigt nur noch 4 statt 6 Metriken (keine KI-Zeilen mehr).
  - `/settings/reminders` zeigt Telegram-Status + Zeitpunkt der letzten Erinnerung.

## Betroffene Dateien

**Neu:**
- `src/app/(app)/settings/integrations/page.tsx`
- `src/app/(app)/settings/tokens/page.tsx`
- `src/app/(app)/settings/insights/page.tsx`
- `src/app/(app)/settings/reminders/page.tsx`
- `src/app/(app)/settings/areas/page.tsx`
- `src/components/features/settings/SettingsTabs.tsx`
- `src/components/features/settings/SettingsHeader.tsx`
- `src/components/features/settings/ReminderStatus.tsx`
- `src/components/features/settings/CalendarSelector.tsx`
- `supabase/migrations/0016_calendar_multi_select.sql`

**Geändert:**
- `src/app/(app)/settings/page.tsx` (→ redirect)
- `src/app/(app)/areas/page.tsx` (→ redirect)
- `src/components/ui/Nav.tsx`
- `src/app/api/capture/route.ts`
- `src/components/features/capture/QuickCapture.tsx`
- `src/components/features/settings/MetricsPanel.tsx`
- `src/lib/metrics/summary.ts`
- `src/lib/calendar/google.ts`
- `src/lib/calendar/sync.ts`
- `src/lib/calendar/actions.ts`
- `src/lib/tasks/actions.ts`
- `ios-shortcut/README.md`
- Tests: `src/__tests__/capture.e2e.test.ts`

**Gelöscht:**
- `src/lib/ai/classify.ts`
- `src/components/features/capture/Reclassify.tsx`
- `src/lib/inbox/reclassify.ts`
