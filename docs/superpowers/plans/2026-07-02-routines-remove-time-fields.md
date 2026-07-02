# Routinen: Zeit-Felder entfernen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `specific_time` (Uhrzeit) und `notify` (Erinnerung) vollständig aus Routinen entfernen — UI, App-Code, Validierung, Typen und DB — bei erhaltener `time_of_day`-Gruppierung.

**Architecture:** Reine Entfernung/Vereinfachung, keine neue Funktion. Weil das Entfernen des Feldes aus dem `Routine`-Typ alle Verbraucher (Actions, UI, Capture) gleichzeitig bricht, erfolgt die Code-Entfernung **atomar in einer Task/einem Commit**; DB-Migration und Doku sind separate Tasks.

**Tech Stack:** Next.js (App Router) + TypeScript, Supabase (Postgres, migrations), Zod, Vitest.

## Global Constraints

- READMEs/Docs: Deutsch für UI-Texte; Code-Kommentare wie im Bestand (knapp, Englisch/Deutsch gemischt ok).
- Migrations werden manuell via `supabase db push` gegen die geteilte Preview+Prod-DB (prod ref `fhzrlctwljepgzzxpada`) angewandt — kein CI.
- `time_of_day` (Morgens/Mittags/Abends/Jederzeit) bleibt unverändert erhalten.
- Nach jeder Code-Task müssen `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` grün sein.

---

## Task 1: Zeit-Felder aus App-Code + Tests entfernen (atomar)

**Files:**
- Modify: `src/lib/routines/types.ts`
- Modify: `src/lib/routines/actions.ts`
- Modify: `src/lib/schemas/forms.ts`
- Modify: `src/components/features/routines/RoutineList.tsx`
- Modify: `src/app/api/capture/route.ts`
- Test: `src/lib/schemas/forms.test.ts`
- Test: `src/__tests__/routines.test.ts`

**Interfaces:**
- Consumes: nichts Neues.
- Produces: `Routine` ohne `specific_time`/`notify`; `create`/`update` ohne diese Felder; `RoutineFormSchema` ohne `specific_time`.

- [ ] **Step 1: `types.ts` — beide Felder aus `Routine` entfernen**

Entferne diese zwei Zeilen aus dem `Routine`-Typ:
```ts
  specific_time: string | null;
  notify: boolean;
```
Ergebnis (Ausschnitt):
```ts
export type Routine = {
  id: string;
  area_id: string | null;
  name: string;
  description: string | null;
  time_of_day: TimeOfDay;
  duration_days: number | null;
  start_date: string;
  archived_at: string | null;
  created_at: string;
};
```

- [ ] **Step 2: `actions.ts` — `create` bereinigen**

Aus der `create`-Input-Signatur `specific_time?: string | null;` und `notify?: boolean;` entfernen, und aus dem Insert-Objekt die Zeilen `specific_time: input.specific_time ?? null,` und `notify: input.notify ?? false,` entfernen. Der Insert lautet danach:
```ts
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description ?? null,
      time_of_day: input.time_of_day ?? "anytime",
      duration_days: input.duration_days ?? null,
      area_id: input.area_id ?? null,
    })
```

- [ ] **Step 3: `actions.ts` — `update`-Pick bereinigen**

Aus der `Pick<Routine, …>`-Liste in `update` die Einträge `| "specific_time"` und `| "notify"` entfernen. Ergebnis:
```ts
  patch: Partial<
    Pick<
      Routine,
      "name" | "description" | "time_of_day" | "duration_days" | "area_id"
    >
  >,
```

- [ ] **Step 4: `actions.ts` — Sortierung in `listWithState`**

Die Zeile `.order("specific_time", { ascending: true, nullsFirst: true })` entfernen, sodass nur nach `created_at` sortiert wird:
```ts
    supabase
      .from("routines")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
```

- [ ] **Step 5: `forms.ts` — `specific_time`-Regel aus `RoutineFormSchema` entfernen**

Den kompletten `specific_time`-Block entfernen (das Feld mit dem `HH:MM`-Regex und dem `.or(z.literal(""))`). `name`, `description`, `time_of_day`, `duration_days` bleiben. Ergebnis:
```ts
export const RoutineFormSchema = z.object({
  name: requiredName,
  description: optionalText(DESCRIPTION_MAX),
  time_of_day: z.enum(TIMES_OF_DAY),
  duration_days: z
    .string()
    .regex(/^\d+$/, "Nur ganze Tage.")
    .refine((v) => Number(v) > 0, "Mindestens 1 Tag.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
```

- [ ] **Step 6: `RoutineList.tsx` — State entfernen**

Die beiden State-Zeilen entfernen:
```ts
  const [specificTime, setSpecificTime] = useState(
    routine?.specific_time?.slice(0, 5) ?? "",
  );
```
und
```ts
  const [notify, setNotify] = useState(routine?.notify ?? false);
```

- [ ] **Step 7: `RoutineList.tsx` — `save()` bereinigen**

Im `fieldErrors(RoutineFormSchema, {…})`-Aufruf die Zeile `specific_time: specificTime,` entfernen; im `patch` die Zeilen `specific_time: specificTime || null,` und `notify,` entfernen. `save()` danach:
```ts
  function save() {
    const errs = fieldErrors(RoutineFormSchema, {
      name,
      description,
      time_of_day: timeOfDay,
      duration_days: durationDays,
    });
    setErrors(errs);
    if (errs) return;
    const patch = {
      name: name.trim(),
      description: description.trim() || null,
      time_of_day: timeOfDay,
      duration_days: durationDays ? Number(durationDays) : null,
      area_id: areaId || null,
    };
    startTransition(async () => {
      if (routine) await update(routine.id, patch);
      else await create(patch);
      onClose();
      showToast(routine ? "Gespeichert" : "Routine angelegt");
    });
  }
```

- [ ] **Step 8: `RoutineList.tsx` — Editor-Layout umbauen**

Ersetze den bisherigen Grid-Block „Tageszeit | Uhrzeit" **und** „Bereich | Dauer" sowie die „Erinnerung senden"-Checkbox durch: eine Grid-Zeile „Tageszeit | Bereich" und eine Grid-Zeile mit „Dauer (Tage)". Die neue Struktur (ersetzt alles von der `Tageszeit`-Grid-Zeile bis inkl. der `notify`-Checkbox):
```tsx
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Tageszeit</span>
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
              className={fieldInput}
            >
              {TIMES_OF_DAY.map((t) => (
                <option key={t} value={t}>
                  {GROUP_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={fieldLabel}>Bereich</span>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className={fieldInput}
            >
              <option value="">Unzugeordnet</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Dauer (Tage)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="∞"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              aria-invalid={Boolean(errors?.duration_days)}
              className={fieldInput}
            />
            {errors?.duration_days && (
              <span role="alert" className="mt-1 block text-body-sm text-danger">
                {errors.duration_days}
              </span>
            )}
          </label>
        </div>
```

- [ ] **Step 9: `RoutineList.tsx` — `specific_time`-Anzeige aus `RoutineRow` entfernen**

Den Block entfernen, der die Uhrzeit neben dem Namen rendert:
```tsx
          {routine.specific_time && (
            <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
              {routine.specific_time.slice(0, 5)}
            </span>
          )}
```

- [ ] **Step 10: `capture/route.ts` — `routineTiming` vereinfachen**

`routineTiming` gibt nur noch `time_of_day` zurück:
```ts
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

- [ ] **Step 11: `capture/route.ts` — Routine-Insert bereinigen**

Destructuring und Insert anpassen (kein `specific_time` mehr):
```ts
    const { time_of_day } = routineTiming(classification.due_at);
    const { data: routine, error } = await db
      .from("routines")
      .insert({
        user_id: userId,
        area_id: areaId,
        name: classification.title,
        time_of_day,
      })
      .select("id")
      .single();
```

- [ ] **Step 12: `forms.test.ts` — `specific_time`-Assertions entfernen**

Den Test „rejects a malformed routine time and non-positive duration" auf `duration_days` reduzieren, und „treats empty optional routine fields as valid" ohne `specific_time`:
```ts
  it("rejects a non-positive routine duration", () => {
    const errs = fieldErrors(RoutineFormSchema, {
      name: "Mobility",
      time_of_day: "morning",
      duration_days: "0",
    });
    expect(errs?.duration_days).toBe("Mindestens 1 Tag.");
  });

  it("treats empty optional routine fields as valid", () => {
    expect(
      fieldErrors(RoutineFormSchema, {
        name: "Mobility",
        time_of_day: "anytime",
        duration_days: "",
      }),
    ).toBeNull();
  });
```

- [ ] **Step 13: `routines.test.ts` — Mock-Objekte bereinigen**

In den beiden Routine-Mock-Objekten (`r-active`, `r-expired`) die Zeilen `specific_time: null,` und `notify: false,` entfernen. Keine Assertion hängt daran.

- [ ] **Step 14: Verifizieren**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alles grün; Tests „form schemas" und „routines actions" laufen ohne `specific_time`/`notify`.

- [ ] **Step 15: Commit**

```bash
git add src/ && git commit -m "refactor(routines): remove specific_time and notify fields

Uhrzeit and the non-functional Erinnerung checkbox are gone from types,
actions, schema, editor, row display and AI capture. time_of_day grouping
stays. Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: DB-Migration (Spalten droppen) + anwenden

**Files:**
- Create: `supabase/migrations/0012_routines_drop_time_fields.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- Drop the two unused time fields from routines: a routine is "done today or
-- not", regardless of clock time. `specific_time` was only display+sort;
-- `notify` was never wired to any reminder path (reminders cron reads `tasks`
-- only). Idempotent; reloads the PostgREST schema cache.

ALTER TABLE routines
  DROP COLUMN IF EXISTS specific_time,
  DROP COLUMN IF EXISTS notify;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Migration anwenden** (erfordert explizite Nutzer-Autorisierung / läuft gegen Prod)

Run: `npx supabase db push`
Expected: `Applying migration 0012_routines_drop_time_fields.sql...` → `Finished`.

- [ ] **Step 3: Verifizieren**

Run: `npx supabase migration list | grep 0012`
Expected: `0012 | 0012 | 0012` (lokal und remote).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_routines_drop_time_fields.sql
git commit -m "feat(db): drop routines.specific_time and routines.notify (0012)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PRD-Doku angleichen

**Files:**
- Modify: `docs/prd.md` (routines-Schemablock, ~Zeile 194)

- [ ] **Step 1: Schemablock anpassen**

Im `CREATE TABLE routines (…)`-Block in `docs/prd.md` die Zeilen `specific_time TIME,` und `notify BOOLEAN NOT NULL DEFAULT FALSE,` entfernen, sodass PRD und tatsächliches Schema übereinstimmen.

- [ ] **Step 2: Commit**

```bash
git add docs/prd.md
git commit -m "docs(prd): drop specific_time/notify from routines schema block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: PR erstellen

- [ ] **Step 1: Branch pushen**

Run: `git push -u origin refactor/routines-remove-time-fields`

- [ ] **Step 2: PR anlegen**

Run: `gh pr create --base main` mit Titel `refactor(routines): remove Uhrzeit + Erinnerung fields` und einem Body, der Kontext (Felder ohne Funktion), Änderungen und Verifikation zusammenfasst; Hinweis, dass Migration `0012` bereits auf die geteilte DB angewandt wurde.

---

## Self-Review

**Spec coverage:** DB-Drop (Task 2) ✓, Typen (T1.1) ✓, Actions inkl. Sortierung (T1.2–1.4) ✓, Validierung (T1.5) ✓, UI State/Editor/Row (T1.6–1.9) ✓, Capture (T1.10–1.11) ✓, Tests (T1.12–1.13) ✓, PRD-Doku (Task 3) ✓, Verifikation (T1.14, T2.3) ✓. Alle Spec-Punkte abgedeckt.

**Placeholder scan:** Keine TBD/TODO; alle Edits mit konkretem Zielcode.

**Type consistency:** `Routine` verliert `specific_time`/`notify` (T1.1); alle Verbraucher (actions T1.2–1.4, forms T1.5, UI T1.6–1.9, capture T1.10–1.11, Tests T1.12–1.13) im selben Commit bereinigt → kein Zwischenzustand mit dangling references. `RoutineFormSchema`-Keys nach Entfernung: name/description/time_of_day/duration_days — konsistent mit dem `save()`-Aufruf in T1.7.
