import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { formatInTimeZone } from "date-fns-tz";
import {
  ClassificationSchema,
  type Classification,
} from "@/lib/schemas/capture";

/**
 * AI classification of a raw capture (TASK-013, FR-002).
 *
 * Maps raw text → {type, title, due_at?, area_slug?} using the Anthropic API.
 * The model is told to answer with strict JSON only; we strip any markdown
 * fences and validate against the zod schema before returning — the model
 * output is never trusted unparsed (PRD § Security). Relative German times
 * ("morgen 17 Uhr") are resolved to an absolute `due_at` in the user timezone.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

export type AreaContext = { slug: string; name: string };

/** Thrown when the model output cannot be parsed/validated — caller falls back. */
export class ClassificationError extends Error {
  constructor(
    message: string,
    readonly raw?: string,
  ) {
    super(message);
    this.name = "ClassificationError";
  }
}

function buildSystemPrompt(
  areas: AreaContext[],
  now: Date,
  tz: string,
): string {
  const nowLocal = formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const weekday = formatInTimeZone(now, tz, "EEEE");
  const areaList =
    areas.length > 0
      ? areas.map((a) => `- ${a.slug} (${a.name})`).join("\n")
      : "(keine Areas vorhanden)";

  return `Du bist der Klassifikator von Atlas, einem persönlichen Lebens-OS. Du bekommst einen kurzen, gesprochenen oder getippten deutschen Satz und ordnest ihn ein.

Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt, ohne Markdown, ohne Erklärtext. Schema:
{"type": "task" | "note" | "journal" | "routine", "title": string, "due_at": string | null, "area_slug": string | null}

Regeln:
- "type": "task" für etwas zu Erledigendes; "routine" für wiederkehrende Gewohnheiten ("jeden Morgen ..."); "journal" für Reflexion/Erlebtes; "note" sonst.
- "title": knapper, aufgeräumter Titel (kein "erinnere mich an ...").
- "due_at": absolute Zeit als ISO-8601 mit Offset, NUR wenn der Satz eine Fälligkeit nennt; sonst null. Relative Angaben in die Nutzer-Zeitzone auflösen.
- "area_slug": passender slug aus der Liste unten, oder null wenn keiner passt.

Aktuelle Zeit des Nutzers: ${nowLocal} (${weekday}), Zeitzone ${tz}.

Verfügbare Areas:
${areaList}

Beispiele:
Eingabe: "erinnere mich morgen um 17 Uhr ans Öl beim Auto checken"
Ausgabe: {"type":"task","title":"Öl beim Auto checken","due_at":"<morgen>T17:00:00+0X:00","area_slug":"haus"}
Eingabe: "jeden Morgen 5 Minuten Mobility machen"
Ausgabe: {"type":"routine","title":"5 Minuten Mobility","due_at":null,"area_slug":"fitness"}
Eingabe: "heute war ein richtig guter Trainingstag, fühle mich stark"
Ausgabe: {"type":"journal","title":"Guter Trainingstag","due_at":null,"area_slug":"fitness"}
Eingabe: "Idee: Geschenk für Mama zum Geburtstag"
Ausgabe: {"type":"note","title":"Geschenk für Mama zum Geburtstag","due_at":null,"area_slug":"familie"}`;
}

/** Strip ```json fences / stray prose and return the inner JSON candidate. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new ClassificationError("no JSON object found", text);
  }
  return candidate.slice(start, end + 1);
}

export async function classify(
  text: string,
  areas: AreaContext[],
  now: Date = new Date(),
  tz: string = process.env.CAPTURE_TZ ?? "Europe/Berlin",
): Promise<Classification> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(areas, now, tz),
    messages: [{ role: "user", content: text }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ClassificationError("no text block in model response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(textBlock.text));
  } catch (err) {
    if (err instanceof ClassificationError) throw err;
    throw new ClassificationError("invalid JSON in model response", textBlock.text);
  }

  const result = ClassificationSchema.safeParse(parsed);
  if (!result.success) {
    throw new ClassificationError(
      `classification failed validation: ${result.error.message}`,
      textBlock.text,
    );
  }

  // Drop an area_slug the user doesn't actually have → "unzugeordnet".
  if (
    result.data.area_slug &&
    !areas.some((a) => a.slug === result.data.area_slug)
  ) {
    result.data.area_slug = null;
  }

  return result.data;
}

export { MODEL as CLASSIFY_MODEL };
