# Atlas — iOS Shortcut Setup

The shortcut is the shortest path from a thought to a captured entry: speak a
sentence into your iPhone and, five seconds later, it's filed correctly. It
dictates on-device and sends the text, authenticated, to `/api/capture`.

## Prerequisites

1. **Create a token.** In Atlas → **Settings → Shortcut Tokens**, create a
   token. The plaintext is shown **exactly once** — copy it immediately.
2. **Know your base URL**, e.g. `https://atlas.example.com`.

## Building the shortcut

1. Open the **Shortcuts** app → **+** (new shortcut).
2. Add the **"Dictate Text"** action.
   - Language: German. "Stop on pause" is convenient for hands-free use.
3. Add the **"Get Contents of URL"** action:
   - **URL:** `https://YOUR-DOMAIN/api/capture`
   - **Method:** `POST`
   - **Headers:**
     - `Authorization` = `Bearer YOUR_TOKEN`
     - `Content-Type` = `application/json`
   - **Request Body:** `JSON`
     - `text` = (variable) **Dictated Text**
     - `source` = `ios_shortcut`
4. Add the **"Get Dictionary Value"** action:
   - Key `title` from **Contents of URL** (for the confirmation).
5. Add the **"Show Notification"** action:
   - Text: e.g. `Captured: ` + **Dictionary Value**.
6. Name the shortcut (e.g. "Capture to Atlas") and add it to the Home Screen or
   as a "Hey Siri" trigger.

## Request format (reference)

```http
POST /api/capture
Authorization: Bearer <TOKEN>
Content-Type: application/json

{ "text": "erinnere mich morgen 17 Uhr ans Öl checken", "source": "ios_shortcut" }
```

Responses:

- `201` — captured: `{ "type", "id", "title", "area": { "id", "name" } | null, "due_at" }`
- `207` — AI classification failed; stored as a note in the inbox (no data
  loss): `{ "type": "note", "id", "note": "unklassifiziert, in Inbox" }`
- `401` — token invalid/expired → create a new one in Settings.
- `429` — rate limit (60/min) reached → wait briefly.

## Verification

Run the shortcut once for real, dictate a sentence with a due time
("erinnere mich morgen 17 Uhr ans Öl checken"), and confirm in Atlas that the
task appears in the right area with the correct `due_at`.
