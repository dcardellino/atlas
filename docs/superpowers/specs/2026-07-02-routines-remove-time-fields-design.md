# Routinen: Zeit-Felder entfernen (Uhrzeit + Erinnerung)

**Datum:** 2026-07-02
**Status:** Approved (Design)
**Branch:** `refactor/routines-remove-time-fields`

## Kontext / Problem

Eine Routine ist ihrem Wesen nach „an einem Tag erledigt oder nicht" — die konkrete
Uhrzeit ist irrelevant. Der aktuelle Editor trägt aber zwei Zeit-Felder mit, die diesem
Modell widersprechen bzw. gar nichts tun:

- **`specific_time` („Uhrzeit")** — eine feste Uhrzeit pro Routine. Sie wird nur angezeigt
  und zur Sortierung genutzt; sie steuert **keinen** Ablauf. Sie suggeriert einen
  Zeitplan, den es nicht gibt.
- **`notify` („Erinnerung senden")** — eine Checkbox ohne jede Wirkung. Der Reminder-Cron
  (`src/app/api/cron/reminders/route.ts`, FR-009) fragt ausschließlich die Tabelle `tasks`
  ab; Routinen kommen dort nicht vor. Das Feld existiert seit dem initialen Schema
  (`0001_init.sql`, aus dem PRD-Datenmodell übernommen), wurde aber nie an eine
  Funktionsanforderung angebunden.

**Ziel:** Beide Felder vollständig entfernen — aus UI, App-Code, Validierung, Typen **und**
der Datenbank. Die grobe **`time_of_day`-Gruppierung** (Morgens/Mittags/Abends/Jederzeit)
bleibt erhalten: Sie ist kein Zeitplan, sondern eine reine Ordnungs-/Gruppierungshilfe in
der Liste.

## Nicht-Ziele

- `time_of_day` bleibt unverändert.
- Routine-Erinnerungen werden **nicht** neu gebaut (kein Ersatz für `notify`).
- Die Streak-/Log-Mechanik (`routine_logs`, `streak.ts`) bleibt unangetastet.

## Entwurf

### 1. Datenbank

Neue Migration `supabase/migrations/0012_routines_drop_time_fields.sql`:

```sql
ALTER TABLE routines
  DROP COLUMN IF EXISTS specific_time,
  DROP COLUMN IF EXISTS notify;

NOTIFY pgrst, 'reload schema';
```

Irreversibel, aber die Daten sind ungenutzt. Deployment manuell via `supabase db push`
gegen die geteilte Preview+Prod-DB (prod ref `fhzrlctwljepgzzxpada`).

### 2. Typen — `src/lib/routines/types.ts`

`specific_time` und `notify` aus dem `Routine`-Typ entfernen.

### 3. Server Actions — `src/lib/routines/actions.ts`

- `create`: beide Felder aus Input-Signatur und Insert entfernen.
- `update`: beide aus der erlaubten `patch`-`Pick`-Liste entfernen.
- `listWithState`: die `.order("specific_time", { ascending: true, nullsFirst: true })`
  streichen; es bleibt `.order("created_at", { ascending: true })`. Die Gruppierung nach
  `time_of_day` passiert weiterhin im UI.

### 4. Validierung — `src/lib/schemas/forms.ts`

Die `specific_time`-Regel aus `RoutineFormSchema` entfernen. `time_of_day` und
`duration_days` bleiben.

### 5. UI — `src/components/features/routines/RoutineList.tsx`

- State `specificTime` und `notify` entfernen.
- Im `RoutineEditor`: das „Uhrzeit"-Input und die „Erinnerung senden"-Checkbox entfernen.
- In `save()`: `specific_time` und `notify` aus `patch` und aus dem `fieldErrors(...)`-Aufruf
  entfernen.
- In `RoutineRow`: die Anzeige von `routine.specific_time` (die HH:MM-Marke neben dem Namen)
  entfernen.
- Editor-Layout danach:
  ```
  Name
  Beschreibung
  Tageszeit  │ Bereich
  Dauer (Tage)
  ```
  (Die „Tageszeit" rückt neben „Bereich"; „Uhrzeit" und die Checkbox verschwinden.)

### 6. KI-Capture — `src/app/api/capture/route.ts`

`routineTiming()` liefert nur noch `time_of_day` (keine `specific_time` mehr); der Routine-
Insert übergibt kein `specific_time`/`notify` mehr.

### 7. Tests

- `src/lib/schemas/forms.test.ts`: `specific_time`-Assertions entfernen (der Test
  „rejects a malformed routine time…" verliert seinen `specific_time`-Teil bzw. wird auf
  `duration_days` reduziert; „treats empty optional routine fields as valid" ohne
  `specific_time`).
- `src/__tests__/routines.test.ts`: `specific_time`/`notify` aus den Mock-Routine-Objekten
  entfernen (keine Assertion hängt daran).
- `src/__tests__/capture.e2e.test.ts`: **keine Änderung nötig** — der Test referenziert
  weder `specific_time` noch `notify` (verifiziert).

### 8. Doku

Den `routines`-Schemablock in `docs/prd.md` (um Zeile 194) an die Realität angleichen
(`specific_time`/`notify` entfernen), damit PRD und DB nicht auseinanderdriften.

## Verifikation

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` grün.
- Migration `0012` via `supabase db push` angewandt; Spalten in `routines` verschwunden.
- Manuell (`npm run dev`): Editor zeigt weder „Uhrzeit" noch „Erinnerung senden";
  Anlegen/Bearbeiten/Löschen funktioniert; die Tageszeit-Gruppen (Morgens/…/Jederzeit)
  gliedern die Liste weiterhin.

## Betroffene Dateien

- `supabase/migrations/0012_routines_drop_time_fields.sql` (neu)
- `src/lib/routines/types.ts`
- `src/lib/routines/actions.ts`
- `src/lib/schemas/forms.ts`
- `src/components/features/routines/RoutineList.tsx`
- `src/app/api/capture/route.ts`
- `docs/prd.md`
- Tests: `src/lib/schemas/forms.test.ts`, `src/__tests__/routines.test.ts`
