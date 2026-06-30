# Atlas — iOS-Shortcut einrichten

Der Shortcut ist der kürzeste Weg vom Gedanken zum erfassten Eintrag: ein
gesprochener Satz ins iPhone, fünf Sekunden später korrekt einsortiert. Er
diktiert on-device und schickt den Text authentifiziert an `/api/capture`.

## Voraussetzungen

1. **Token erzeugen.** In Atlas → **Settings → Shortcut-Tokens** ein Token
   erzeugen. Der Klartext wird **genau einmal** angezeigt — sofort kopieren.
2. **Basis-URL** der Atlas-Installation kennen, z.B. `https://atlas.example.com`.

## Shortcut Schritt für Schritt

1. App **Kurzbefehle** öffnen → **+** (neuer Kurzbefehl).
2. Aktion **„Text diktieren"** (Dictate Text) hinzufügen.
   - Sprache: Deutsch. „Bei Pause beenden" ist angenehm fürs Freisprechen.
3. Aktion **„Inhalte von URL abrufen"** (Get Contents of URL) hinzufügen:
   - **URL:** `https://DEINE-DOMAIN/api/capture`
   - **Methode:** `POST`
   - **Header:**
     - `Authorization` = `Bearer DEIN_TOKEN`
     - `Content-Type` = `application/json`
   - **Anfragetext:** `JSON`
     - `text` = (Variable) **Diktierter Text**
     - `source` = `ios_shortcut`
4. Aktion **„Wörterbuchwert abrufen"** (Get Dictionary Value) hinzufügen:
   - Schlüssel `title` aus **Inhalte von URL** (für die Rückmeldung).
5. Aktion **„Mitteilung anzeigen"** (Show Notification):
   - Text: z.B. `Erfasst: ` + **Wörterbuchwert**.
6. Kurzbefehl benennen (z.B. „Atlas erfassen") und zum Home-Screen / als
   „Hey Siri"-Auslöser hinzufügen.

## Request-Format (Referenz)

```http
POST /api/capture
Authorization: Bearer <TOKEN>
Content-Type: application/json

{ "text": "erinnere mich morgen 17 Uhr ans Öl checken", "source": "ios_shortcut" }
```

Antworten:

- `201` — erfasst: `{ "type", "id", "title", "area": { "id", "name" } | null, "due_at" }`
- `207` — KI-Klassifikation fehlgeschlagen, als Notiz in der Inbox abgelegt
  (kein Datenverlust): `{ "type": "note", "id", "note": "unklassifiziert, in Inbox" }`
- `401` — Token ungültig/abgelaufen → in den Settings ein neues erzeugen.
- `429` — Rate-Limit (60/min) erreicht → kurz warten.

## Verifikation

Den Shortcut einmal real ausführen, einen Satz mit Fälligkeit diktieren
(„erinnere mich morgen 17 Uhr ans Öl checken") und in Atlas prüfen, dass der
Task im passenden Bereich mit korrektem `due_at` erscheint.
