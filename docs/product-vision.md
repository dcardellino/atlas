# Product Vision — Atlas

> Arbeitstitel „Atlas" — frei umbenennbar in `vision.json` (`product.name`).

## 1. Vision & Mission

### Vision Statement
Eine Welt, in der ein einzelner Gedanke nie wieder verloren geht — alles Wichtige aus jedem Lebensbereich wird im Moment des Aufkommens erfasst und findet von selbst seinen Platz.

### Mission Statement
Atlas senkt die Reibung beim Erfassen auf einen einzigen gesprochenen Satz und lässt KI das Aufräumen und Einsortieren übernehmen, sodass das System sich aus dem Weg hält statt zur Last zu werden.

### Founder's Why
Dominic hat über Jahre jedes Produktivitätstool durchprobiert — Notion, Apple Notes, Todoist, Google Calendar. Das Muster wiederholte sich jedes Mal: Entweder wurde der Eigenbau in Notion so elaboriert, dass er selbst zur Last wurde, oder ein Tool war für Business-Workflows gebaut, in die sich Haushalt, Hyrox-Training und Familie nicht pressen ließen. Die Erkenntnis, die hinter Atlas steht: Das Problem ist nie das Tracking. Das Problem ist die Reibung beim Erfassen — und dass Notizen, Ideen und Projekte irgendwo landen und nie wieder angefasst werden, weil nichts einen zurückholt.

Was Dominic von den meisten unterscheidet, die so etwas bauen wollen: Er ist Platform/SRE-Engineer mit über zehn Jahren Erfahrung und kann das Ding selbst bauen und betreiben, ohne sich in Infrastruktur zu verlieren. Und er hat mit einer lokalen Voice-to-Text-Pipeline (Oratio) bereits genau die Erfahrung gesammelt, an der die meisten Eigenbauten scheitern: an der Capture-Oberfläche. Die ist bei Atlas kein nachträglicher Gedanke, sondern der Kern.

Er kennt seine eigenen Lebensbereiche besser, als ein generisches Tool sie je modellieren könnte. Atlas ist nicht der Versuch, ein Markt-Produkt zu bauen — es ist der Versuch, ein einziges System zu bauen, das exakt zu einer Person passt und das diese Person auch in fünf Jahren noch täglich nutzt.

### Core Values
- **Capture-Reibung gegen null.** Wenn das Erfassen mehr als einen Satz und eine Sekunde kostet, ist es zu teuer. Jede Designentscheidung wird daran gemessen, ob sie den Weg vom Gedanken zum erfassten Eintrag verkürzt oder verlängert.
- **Die KI sortiert, nicht der Mensch.** Manuelles Einordnen in Kategorien ist Arbeit, die das System übernimmt. Der Mensch korrigiert nur im Ausnahmefall — er taggt nicht standardmäßig.
- **Nichts stirbt im System.** Ein Eintrag, der erfasst wurde, muss auch wieder auftauchen. Slipping-Erkennung und Today-View sind keine Features, sondern die Erfüllung eines Versprechens: dass Erfassen sich lohnt.
- **Werkzeug, kein Spielzeug.** Kein Gamification-Schnickschnack, keine Streak-Konfetti um ihrer selbst willen. Atlas ist ein ruhiger, verlässlicher Werkzeugkasten, der dann zur Hand ist, wenn man ihn braucht, und sonst schweigt.
- **Kein Over-Engineering.** Eine Single-User-App braucht kein Kubernetes. Der Stack bleibt so klein wie möglich, damit die Energie ins Produkt fließt und nicht in den Betrieb.

### Strategic Pillars
- **Capture zuerst, alles andere baut darauf auf.** Wenn der Erfassungs-Flow nicht reibungslos ist, ist kein anderes Feature etwas wert.
- **Der eigene Alltag schlägt jede generische Best Practice.** Im Zweifel gewinnt das, was Dominics realen Lebensbereichen entspricht, nicht das, was ein PM-Tool-Lehrbuch vorschlägt.
- **Managed jetzt, Self-Hosting als Option.** Minimale Betriebslast beim Start (Vercel + Supabase), aber der Stack bleibt so gewählt, dass ein Umzug ins Homelab später ohne Code-Änderung möglich ist.
- **Schneide rücksichtslos.** Jedes Feature, das nicht direkt dem Capture-, Today- oder Wiederfinden-Erlebnis dient, wandert nach hinten oder fliegt raus.

### Success Looks Like
In zwölf Monaten ist Atlas das erste, wohin Dominic greift, wenn ihm etwas einfällt — per iPhone-Diktat unterwegs, per `Cmd+J` am Schreibtisch. Apple Notes und mindestens eine Task-App sind ersetzt. Über alle Lebensbereiche — Familie, Fitness, Haus, Side-Projects — geht spürbar nichts mehr verloren. Der KI-Chat über die eigenen Daten beantwortet Fragen wie „Was wollte ich nochmal zum Thema X festhalten?" in Sekunden. Die Hyrox-Routinen laufen mit Streak-Tracking, das Journal füllt sich beiläufig per Sprache. Und das Wichtigste: Atlas fühlt sich nie wie Arbeit an — es ist die Infrastruktur, die das restliche Leben leiser und geordneter macht.

## 2. User Research

### Primary Persona
Dominic, Anfang/Mitte 30, Platform/SRE-Engineer in Herrenberg. Festangestellt bei Digistore24, daneben freiberufliche DevOps-Praxis. Lebt mit Frau und Hund. Trainiert für Hyrox, kocht gern, betreibt ein Homelab. Technisch auf Senior-Niveau, baut seine Tools selbst (Go/Next.js/PostgreSQL). Sein Tag ist fragmentiert: Hauptjob, Freelance-Tickets, Side-Projects, Training, Haushalt, Familie. Gedanken kommen ständig und überall — beim Hundespaziergang, beim Kochen, mitten im Deployment. Aktuell verteilt er sie über Apple Notes, Kalender und Kopf, und ein guter Teil geht verloren. Emotional ist die Grundstimmung leichte Dauerfrustration darüber, dass er weiß, dass er produktiver und ruhiger sein könnte, wenn nur ein System endlich greifen würde. Was ihn zum Wechsel bewegt: ein Tool, das er nicht pflegen muss, das ihm gehört und das beim Erfassen nicht im Weg steht.

### Secondary Personas
- **Seine Frau** als möglicher geteilter Nutzer eines Haushalts-/Familien-Bereichs in einer späteren Phase. Sie braucht keinen vollen Zugang zum System, sondern nur einen abgegrenzten gemeinsamen Raum für Termine, Einkäufe und Familienorganisation. Für den MVP bewusst nicht im Scope.

### Jobs To Be Done
- **Funktional:** „Wenn mir unterwegs etwas einfällt, will ich es in einem Satz festhalten, ohne anzuhalten oder eine App zu navigieren, damit es erledigt wird und ich es vergessen darf." 
- **Funktional:** „Wenn ich morgens den Tag beginne, will ich auf einen Blick die drei wichtigsten Dinge und alle Fälligkeiten sehen, damit ich nicht in einer ungeordneten Liste ertrinke."
- **Emotional:** „Ich will das Gefühl loswerden, dass ich etwas Wichtiges vergesse — die ständige Hintergrundlast des Sich-merken-Müssens."
- **Emotional:** „Ich will mich kompetent und im Griff fühlen, nicht von meinen eigenen Tools überfordert."
- **Sozial:** Schwach ausgeprägt (Single-User-Tool) — aber: „Ich will als jemand wahrgenommen werden, der zuverlässig ist, weil mir nichts durchrutscht."

### Pain Points
- **Erfassungsreibung (schwer, täglich mehrfach).** Jeder zusätzliche Schritt zwischen Gedanke und Eintrag senkt die Wahrscheinlichkeit, dass erfasst wird, drastisch. Aktuell: App öffnen, Liste wählen, tippen. Konsequenz: Vieles wird gar nicht erst notiert und geht verloren.
- **Notizen sterben (schwer, dauerhaft).** Was in Apple Notes oder einem handschriftlichen Journal landet, wird nie wieder angesehen. Es gibt keinen Mechanismus, der zurückholt. Konsequenz: Erfassen fühlt sich sinnlos an, was den Capture-Pain verstärkt.
- **Business-Strukturen passen nicht (mittel, dauerhaft).** PM-Tools zwingen persönliche Tasks in Projekt-/Sprint-Logik. Konsequenz: ständiges Anpassen oder Aufgeben.
- **Tool-Fragmentierung (mittel, täglich).** Kontext verteilt sich über mehrere Apps; nichts hat den Gesamtüberblick. Konsequenz: Suchen statt Tun.
- **Wartungslast bei Eigenbauten (mittel, periodisch).** Notion-Konstruktionen werden so komplex, dass ihre Pflege selbst zur Aufgabe wird. Konsequenz: Das System wird zur Last und stirbt.

### Current Alternatives & Competitive Landscape
- **Notion** — extrem flexibel, schön. Fällt durch: Beim Versuch, das ganze Leben abzubilden, wird der Eigenbau so komplex, dass Pflege und Erfassung zur Last werden. Wechsel würde bedeuten, die Flexibilität gegen Reibungslosigkeit einzutauschen — was genau der Punkt ist.
- **Apple Notes** — null Erfassungsreibung beim Schreiben. Fällt durch: Keine Struktur, keine Fälligkeiten, kein Wiederauftauchen — Notizen sterben dort.
- **Todoist / Tasks-Apps** — gut für reine Aufgaben. Fällt durch: Business-/GTD-Workflow-Logik, keine Lebensbereiche, kein Journal, keine Routinen in einem.
- **Google Calendar** — bleibt für Termine gesetzt und wird read-only eingebunden. Fällt durch: deckt Tasks, Routinen, Notizen, Journal nicht ab.
- **Handschriftliches Journal** — höchste Reflexionsqualität. Fällt durch: landet im Regal, nicht durchsuchbar, nicht mit dem Rest verbunden.
- **„Nichts tun" / Status quo** — der eigentliche Hauptkonkurrent. Gedanken im Kopf behalten und hoffen. Fällt durch: genau das Problem, das Atlas löst.

### Key Assumptions to Validate
- **Wir nehmen an, dass die KI-Klassifikation gut genug ist, dass manuelle Korrektur die Ausnahme bleibt** — weil sonst die Reibung nur verschoben statt eliminiert wird. Validieren: Erste 100 Captures protokollieren und Korrekturrate messen. Ziel < 15 %.
- **Wir nehmen an, dass ein iOS-Shortcut mit On-Device-Diktat reibungsarm genug ist** — weil der ganze Wertversprechen daran hängt. Validieren: Zwei Wochen ausschließlich über den Shortcut erfassen und subjektive Reibung bewerten.
- **Wir nehmen an, dass die Latenz (Diktat → Anthropic-Call → gespeichert) unter ~5 s bleibt** — weil längere Wartezeit den „Magic Moment" zerstört. Validieren: p95-Latenz des Capture-Endpoints messen.
- **Wir nehmen an, dass Slipping-Erkennung tatsächlich zum Wiederanfassen führt** — weil sie sonst nur eine weitere ignorierte Liste ist. Validieren: Nach 4 Wochen prüfen, ob „slipping" markierte Items reaktiviert werden.
- **Wir nehmen an, dass Dominic die Erfassungsgewohnheit über 90 Tage hält** — die größte Unbekannte. Validieren: Tägliche Capture-Anzahl tracken; Abfall = Frühwarnsignal.
- **Wir nehmen an, dass ein einziges, kombiniertes Datenmodell (Tasks/Notes/Journal/Routines) nicht zu unübersichtlich wird** — weil Jareds „unified inbox"-Problem genau hier lauert. Validieren: getrennte Views statt einer Sammelliste; nach Nutzung evaluieren.

### User Journey Map
**Auslöser → erste Nutzung:** Dominic baut Atlas selbst, der „Awareness"-Schritt entfällt. Der erste echte Moment ist die erste Erfassung über den Shortcut. Emotion: Skepsis, ob es wirklich reibungslos ist. Friktion: Shortcut einrichten, Token hinterlegen.

**Magic Moment:** Beim Hundespaziergang spricht er „erinnere mich morgen um 17 Uhr ans Öl beim Auto checken". Fünf Sekunden später meldet das System: erfasst, Bereich Haus, fällig morgen 17 Uhr, Reminder gesetzt. Emotion: Erleichterung — es funktioniert, ohne dass er etwas sortieren musste. Das ist der Punkt, an dem aus Skepsis Vertrauen wird.

**Habit Formation:** Über die ersten zwei Wochen verlagert sich das Erfassen vollständig nach Atlas. Der Today-View wird zum Morgenritual. Routinen mit Streaks geben Hyrox-Training Struktur. Friktion an dieser Stelle: Wenn die KI zu oft falsch einsortiert, kippt das Vertrauen — deshalb ist die Korrekturrate die kritische Metrik.

**Advocacy:** Bei einem Single-User-Tool optional — möglich, dass Dominic den Bauprozess auf LinkedIn/Substack teilt oder ein Template open-sourct. Emotion: Stolz auf ein System, das endlich greift.

## 3. Product Strategy

### Product Principles
- **Ein Satz, ein Eintrag.** Der Default-Erfassungsweg ist immer Sprache oder ein einzelnes Textfeld — nie ein Formular mit Pflichtfeldern.
- **Die KI rät zuerst, der Mensch korrigiert selten.** Klassifikation, Bereich, Fälligkeit werden automatisch vorgeschlagen; Korrektur ist möglich, aber nie erzwungen.
- **Getrennte Views, ein Datenmodell.** Tasks, Notizen, Journal und Routinen leben technisch zusammen, werden aber nie in einer einzigen Sammelliste vermischt — Jareds „unified inbox"-Fehler wird bewusst vermieden.
- **Lebensbereiche sind die oberste Ebene.** Alles hängt an einer Area; es gibt keine heimatlosen Einträge.
- **Das System holt zurück.** Today-View und Slipping-Erkennung sorgen aktiv dafür, dass Erfasstes wieder sichtbar wird.
- **Stille als Feature.** Keine Benachrichtigung ohne klaren Nutzen. Atlas nervt nicht.

### Market Differentiation
Atlas konkurriert nicht im Markt — es konkurriert gegen Dominics Status quo aus fünf halb genutzten Tools. Der entscheidende Unterschied zu Notion, Todoist & Co. ist nicht ein Feature, sondern eine Designhaltung: Capture-Reibung wird kompromisslos priorisiert, und KI übernimmt das Einsortieren, das bei allen anderen Tools manuelle Arbeit bleibt. Der zweite Unterschied ist die rücksichtslose Reduktion — Atlas verzichtet bewusst auf Content-Pipeline, Personen-CRM und Inventory (Jareds Pains), weil jedes nicht-essenzielle Modul die Erfassungsreibung indirekt erhöht. Verteidigbar ist das nicht durch einen Burggraben, sondern durch perfekten Fit: Ein selbstgebautes System, das exakt einer Person passt, kann von keinem generischen Produkt geschlagen werden.

### Magic Moment Design
Der Magic Moment — gesprochener Satz, fünf Sekunden später korrekt einsortiert — verlangt, dass drei Dinge zuverlässig funktionieren: (1) der iOS-Shortcut nimmt Diktat auf und schickt es authentifiziert an den Capture-Endpoint, (2) der Anthropic-Call liefert in unter ~3 s strukturiertes JSON mit Typ, Titel, Fälligkeit und Area, (3) der Eintrag wird gespeichert und eine knappe Bestätigung kommt zurück. Der kürzeste Weg dahin: Shortcut einrichten ist der einzige Onboarding-Schritt, der zwischen Installation und Magic Moment steht. Dieser Moment ist im MVP erreichbar — er ist sogar der Kern des MVP. Wäre er es nicht, wäre der Scope falsch.

### MVP Definition
**In Scope (v1):**
- **Capture-Pipeline.** iOS-Shortcut (Diktat) + PWA-Quick-Capture (`Cmd+J` / Texteingabe). Anthropic-Klassifikation in `{type, title, due_at, area_id}`. Insert in Supabase. Knappe Bestätigung. *Essenziell:* Das ist der Magic Moment. „Done" = ein gesprochener Satz landet korrekt einsortiert.
- **Today-View.** Top-3, fällige Tasks nach Datum, Google Calendar read-only, „kürzlich erfasst"-Liste zur Kontrolle. *Essenziell:* erfüllt das Wiederfinden-Versprechen. „Done" = Tagesüberblick auf einen Blick.
- **Tasks-CRUD.** Anzeigen, Bearbeiten, Abhaken, Fälligkeit, Area-Zuordnung, wiederkehrend, Reminder via ntfy. „Done" = vollständiger Task-Lebenszyklus.
- **Areas/Domains.** Anlegen/Verwalten der Lebensbereiche als oberste Ebene. „Done" = jeder Eintrag hängt an einer Area.
- **Routines + Streaks.** Morgens/mittags/abends, dauerhaft oder zeitbegrenzt, Abhaken, Streak-Anzeige. „Done" = Hyrox-Routine mit funktionierendem Streak.
- **Journal.** Leichtgewichtige Einträge per Voice/Text mit Foto-Anhang (Supabase Storage). „Done" = Spracheintrag mit Foto landet im Journal.
- **Auth.** Supabase Auth schützt PWA und Capture-Endpoint. „Done" = nur authentifizierter Zugriff.

**Explicitly Out of Scope:**
- **AI-Chat über die eigenen Daten.** Verlockend, weil mächtig — aber braucht pgvector, Embeddings-Pipeline und durchdachtes Retrieval. Verschoben auf Phase 2, sobald genug Daten im System sind, dass der Chat überhaupt Wert liefert.
- **Slipping-Erkennung.** Wertvoll, aber nicht überlebenswichtig für v1; braucht erst Nutzungsdaten, um sinnvolle Schwellen zu setzen. Reconsider: nach 4 Wochen Nutzung.
- **Geteilter Haushalts-Bereich für die Frau.** Multi-User bringt Berechtigungskomplexität. Verschoben, bis das Single-User-System steht. Reconsider: Monat 4–6.
- **Content-Pipeline, Personen-CRM, Inventory.** Jareds Pains, nicht Dominics. Bewusst dauerhaft draußen, außer ein konkreter Alltagsbedarf taucht auf.
- **OCR von handschriftlichen Journalseiten.** Reizvoll, aber Nice-to-have. Reconsider: nach MVP.

### Feature Priority (MoSCoW)
- **Must Have:** Capture-Pipeline (Voice + Text), KI-Klassifikation, Tasks-CRUD, Areas, Today-View, Auth.
- **Should Have:** Routines + Streaks, Journal mit Fotos, Reminder via ntfy, Google Calendar read-only.
- **Could Have:** AI-Chat über Daten, Slipping-Erkennung, wiederkehrende Tasks mit komplexen Regeln.
- **Won't Have (this time):** Geteilter Multi-User-Bereich, Content-Pipeline, Personen-CRM, Inventory, OCR von Journalseiten.

### Core User Flows
**Flow 1 — Voice-Capture (Magic Moment):** Auslöser: Gedanke unterwegs → iOS-Shortcut antippen → Diktat → POST an `/api/capture` mit Token → Anthropic klassifiziert → Insert in Supabase → Push-/Shortcut-Bestätigung. Outcome: korrekt einsortierter Eintrag. Erfolgskriterium: < 5 s, korrekte Area/Typ ohne manuelle Korrektur.

**Flow 2 — Morgendlicher Today-Check:** Auslöser: Tagesbeginn → PWA öffnen → Today-View → Top-3 markieren, Fälligkeiten sehen, Kalender abgleichen → Tasks abhaken. Outcome: klarer Tagesplan. Erfolgskriterium: Überblick in < 30 s, kein Scrollen durch ungeordnete Listen.

**Flow 3 — Routine abhaken:** Auslöser: nach dem Hyrox-Training → Today-View → Routine abhaken → Streak aktualisiert. Outcome: Gewohnheit getrackt. Erfolgskriterium: ein Tap, sichtbares Streak-Feedback.

### Success Metrics
- **Primärmetrik:** Tägliche Capture-Anzahl. Gut: ≥ 3/Tag im Schnitt. Großartig: ≥ 8/Tag — das System ist zum Default-Ablageort geworden.
- **Sekundär:** KI-Korrekturrate (Anteil Captures, die nachträglich umsortiert werden). Gut: < 20 %. Großartig: < 10 %.
- **Sekundär:** Anteil Tage mit Today-View-Öffnung. Gut: ≥ 5/Woche. Großartig: täglich.
- **Leading Indicator:** Capture-Latenz p95. Gut: < 5 s. Großartig: < 3 s.
- **Leading Indicator:** Verhältnis Voice- zu Text-Captures — hoher Voice-Anteil bestätigt, dass der reibungsärmste Weg auch genutzt wird.

### Risks
- **KI-Klassifikation zu ungenau (wahrscheinlich, hoher Impact).** Wenn zu oft falsch einsortiert wird, kippt das Vertrauen. Mitigation: gut geprompte Klassifikation mit Few-Shot-Beispielen aus echten Captures; einfache Korrektur-UI; Korrekturrate als überwachte Metrik.
- **Habit hält nicht (mittel, kritischer Impact).** Side-Project-Apps werden oft nicht durchgehalten. Mitigation: Magic Moment so früh wie möglich; Capture-Reibung kompromisslos niedrig halten; Today-View als tägliches Ritual etablieren.
- **Latenz zerstört den Flow (mittel, hoher Impact).** Anthropic-Call + Cold Start auf Vercel könnten zu langsam sein. Mitigation: Capture-Endpoint warm halten / schlank halten; Klassifikation auf ein schnelles Modell legen; ggf. optimistisches Speichern des Rohtexts vor der Klassifikation.
- **Scope-Creep durch SRE-Reflex (mittel, mittlerer Impact).** Versuchung, Infrastruktur zu überbauen oder Jareds Features doch reinzunehmen. Mitigation: MoSCoW-Disziplin; „Won't Have" ernst nehmen; managed Stack statt GKE.
- **Personendaten auf Managed-Stack (niedrig, mittlerer Impact).** Journal/Familie auf Supabase/Vercel. Mitigation: Self-Hosting-Exit bewusst offengehalten; RLS sauber; sensible Felder bei Bedarf später verschlüsseln.
- **Vercel-Serverless-Grenzen für Background-Jobs (niedrig, niedriger Impact).** Cron nur als kurze Invocations. Mitigation: Jobs bleiben kurz; bei Bedarf auf Supabase pg_cron + Edge Functions ausweichen.
- **Einzelnutzer = einzige Feedback-Quelle (mittel, mittlerer Impact).** Keine externe Validierung der Produktentscheidungen. Mitigation: eigene Nutzung ehrlich tracken (Metriken oben), nicht auf Bauchgefühl verlassen.

## 4. Brand Strategy

### Positioning Statement
Für eine technisch versierte Person, die ihre Gedanken und Aufgaben über zu viele Tools verstreut und ständig etwas verliert, ist Atlas das persönliche Lebens-OS, das alles per gesprochenem Satz erfasst und von KI automatisch einsortieren lässt. Anders als Notion, Todoist oder Apple Notes zwingt Atlas niemanden in eine Struktur und lässt nichts im System sterben.

### Brand Personality
Atlas ist der ruhige, kompetente Kollege, der nie hektisch wird und immer weiß, wo etwas liegt. Er redet wenig, aber wenn, dann präzise. Er würde nie mit Konfetti-Animationen um Aufmerksamkeit betteln und nie eine Benachrichtigung schicken, die nicht zählt. Er trägt schlichtes, gutes Werkzeug — nichts Auffälliges. In der Bestätigung knapp, im Fehlerfall sachlich und lösungsorientiert, nie entschuldigend-jammernd. Er behandelt den Nutzer als kompetenten Erwachsenen.

### Voice & Tone Guide
Die Stimme ist konstant: deutschsprachig, knapp, direkt, ohne Floskeln und ohne Jargon. Der Ton verschiebt sich je nach Kontext:

| Kontext | DO | DON'T |
|---|---|---|
| Onboarding | „Richte den Shortcut ein — danach genügt ein gesprochener Satz." | „Willkommen bei deiner Produktivitäts-Journey! 🚀" |
| Erfolg | „Erfasst — Bereich Haus, fällig morgen 17 Uhr." | „Super gemacht! Du bist ein Produktivitäts-Champion!" |
| Fehler | „Konnte den Eintrag nicht einsortieren — kurz prüfen?" | „Ups! Da ist etwas schiefgelaufen 😟" |
| Empty State | „Noch nichts erfasst. Sprich oder tippe deinen ersten Gedanken." | „Hier ist es noch ganz leer und einsam …" |
| Slipping-Hinweis | „Bereich Side-Projects: seit 12 Tagen nichts angefasst." | „Vergiss deine Projekte nicht!!!" |

### Messaging Framework
- **Tagline:** „Ein Satz. Richtig einsortiert."
- **Headline:** „Das Lebens-OS, das beim Erfassen nicht im Weg steht."
- **Value Props:** (1) Erfassen per gesprochenem Satz, KI sortiert ein. (2) Ein System für alle Lebensbereiche, sauber getrennt. (3) Nichts geht verloren — der Today-View und Slipping holen zurück.
- **Feature-Beschreibungen:** knapp, nutzenorientiert („Diktiere unterwegs, finde es geordnet wieder").
- **Objection Handler:** „Schon wieder ein Tool?" → „Nein — das eine, das die anderen ersetzt, weil Erfassen endlich nichts kostet."

### Elevator Pitches
- **5 Sekunden:** „Ein persönliches Lebens-OS, das gesprochene Gedanken automatisch einsortiert."
- **30 Sekunden:** „Ich verliere ständig Gedanken zwischen Apple Notes, Kalender und Kopf, weil jedes Tool beim Erfassen im Weg steht. Atlas dreht das um: Ich spreche einen Satz ins iPhone, eine KI räumt ihn auf und legt ihn in den richtigen Lebensbereich — mit Fälligkeit, ohne dass ich sortiere. Today-View und Slipping holen zurück, was sonst stirbt."
- **2 Minuten:** „Das Problem ist nie das Tracking, sondern die Reibung beim Erfassen — und dass Notizen nie wieder auftauchen. Ich habe Notion, Todoist und Apple Notes durch und bin immer am selben Punkt gescheitert: zu komplex oder zu Business-zentriert. Atlas senkt die Erfassung auf einen gesprochenen Satz und lässt KI das Einsortieren übernehmen. Warum jetzt: Sprach-Diktat ist on-device gut genug, und ein KI-Call klassifiziert Rohtext zuverlässig in strukturierte Einträge. Warum ich: Ich bin SRE, baue meine Tools selbst und habe mit Voice-to-Text schon die Capture-Pipeline gemeistert, an der die meisten scheitern. Der Plan: ein schlanker Next.js-/Supabase-Stack, kein Over-Engineering, Self-Hosting als Option. Ziel ist nicht ein Markt-Produkt, sondern ein System, das mir exakt passt — und das ich in fünf Jahren noch nutze."

### Competitive Differentiation Narrative
Generische Produktivitätstools optimieren für Flexibilität und Feature-Breite — und scheitern genau daran, wenn jemand sein ganzes Leben hineinpressen will: Der Eigenbau wird zur Last, oder die Business-Logik passt nicht. Atlas optimiert für das Gegenteil: kompromisslos niedrige Erfassungsreibung und KI-gestütztes Einsortieren statt manuellem Tagging. Wo Notion erwartet, dass der Nutzer das System pflegt, pflegt sich Atlas selbst. Wo Todoist Aufgaben in Workflow-Strukturen presst, modelliert Atlas die echten Lebensbereiche einer Person. Der Vorteil ist nicht technologisch verteidigbar — er ist Fit-verteidigbar: Ein System, das für genau einen Menschen und dessen Alltag gebaut ist, schlägt jedes Produkt, das für alle gebaut wurde.

## 5. Visual Design

Visuelle Design-Tokens (Farben Light/Dark, Typografie, Spacing, Komponenten) liegen in `docs/design.md` — warm-editorial, ein Rost-Akzent, Serif/Sans/Mono-Dreiklang, scharfe Kanten, flach mit Haarlinien. Diese Datei ist die verbindliche Styling-Quelle für die Implementierung.
