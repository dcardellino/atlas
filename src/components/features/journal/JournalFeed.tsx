"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { create, attachMedia, remove } from "@/lib/journal/actions";
import { uploadJournalPhoto, UploadError } from "@/lib/journal/upload";
import type { JournalFeedItem } from "@/lib/journal/types";
import type { AreaOption } from "@/components/features/tasks/TaskEditor";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { JournalFormSchema, fieldErrors } from "@/lib/schemas/forms";

/**
 * Journal feed + composer (TASK-039, FR-008). Chronological reflection feed with
 * photo thumbnails, plus a composer offering text, a mic (Web Speech API with a
 * text fallback), and photo attachments. A photo-upload failure never blocks the
 * text entry — the entry is saved first, photos are attached afterwards, and any
 * upload error surfaces a retry hint (Edge Cases: Journal).
 */

const TZ = "Europe/Berlin";

// Minimal Web Speech API surface (not in lib.dom types) — mirrors QuickCapture.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";

function formatEntryDate(entryDate: string): string {
  return formatInTimeZone(new Date(`${entryDate}T00:00:00`), TZ, "dd.MM.yyyy");
}

function Composer({
  areas,
  userId,
}: {
  areas: AreaOption[];
  userId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [areaId, setAreaId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const usedVoice = useRef(false);
  const { show: showToast } = useToast();

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getRecognition();
    if (!recognition) {
      setError("Spracheingabe wird hier nicht unterstützt — bitte tippen.");
      return;
    }
    recognition.lang = "de-DE";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) =>
        e.results[i][0].transcript,
      ).join("");
      setBody(transcript);
      usedVoice.current = true;
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function save() {
    if (pending) return;
    const errs = fieldErrors(JournalFormSchema, { body });
    if (errs) {
      setError(errs.body);
      return;
    }
    const value = body.trim();
    setError(null);
    startTransition(async () => {
      // 1. Persist the text entry first — never lose it to a photo failure.
      const entry = await create({
        body: value,
        area_id: areaId || null,
        source: usedVoice.current ? "pwa_voice" : "pwa_text",
      });

      // 2. Upload photos, then record the ones that succeeded.
      const uploaded: { storage_path: string }[] = [];
      let uploadFailed = false;
      for (const file of files) {
        try {
          const path = await uploadJournalPhoto(userId, entry.id, file);
          uploaded.push({ storage_path: path });
        } catch (err) {
          uploadFailed = true;
          setError(
            err instanceof UploadError
              ? `${err.message} Der Text wurde gespeichert.`
              : "Ein Foto konnte nicht hochgeladen werden. Der Text wurde gespeichert.",
          );
        }
      }
      if (uploaded.length > 0) await attachMedia(entry.id, uploaded);

      // 3. Reset composer (keep the error hint if a photo failed).
      setBody("");
      setAreaId("");
      setFiles([]);
      usedVoice.current = false;
      if (!uploadFailed) {
        setError(null);
        showToast("Eintrag gespeichert");
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-md border border-border bg-surface-raised p-md">
      <p className={fieldLabel}>Neuer Eintrag</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Sprich oder tippe, was dich beschäftigt …"
        className="mt-2 w-full resize-none rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
      />

      {files.length > 0 && (
        <p className="mt-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
          {files.length} Foto{files.length > 1 ? "s" : ""} ausgewählt
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          aria-pressed={recording}
          aria-label="Spracheingabe"
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-border ${
            recording ? "bg-accent text-on-accent" : "bg-surface text-on-surface"
          }`}
        >
          🎙
        </button>

        <label className="flex h-11 cursor-pointer items-center rounded-sm border border-border bg-surface px-4 font-mono text-label uppercase tracking-label text-on-surface">
          Foto
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          aria-label="Bereich"
          className="h-11 rounded-sm border border-border bg-surface px-3 text-body text-on-surface outline-none focus:border-accent"
        >
          <option value="">Unzugeordnet</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={save}
          disabled={pending || !body.trim()}
          className="ml-auto h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          {pending ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}

function EntryRow({ item }: { item: JournalFeedItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <li className="border-b border-border py-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
          {formatEntryDate(item.entry_date)}
        </span>
        {item.area_name && (
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {item.area_name}
          </span>
        )}
        <button
          type="button"
          aria-label="Eintrag löschen"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await remove(item.id);
            router.refresh();
          })}
          className="ml-auto font-mono text-meta uppercase tracking-label text-danger disabled:opacity-60"
        >
          Löschen
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-body text-on-surface">
        {item.body}
      </p>
      {item.media.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.media.map((m) =>
            m.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.url}
                alt="Journal-Foto"
                className="h-24 w-24 rounded-sm border border-border object-cover"
              />
            ) : null,
          )}
        </div>
      )}
    </li>
  );
}

export default function JournalFeed({
  feed,
  areas,
  userId,
}: {
  feed: JournalFeedItem[];
  areas: AreaOption[];
  userId: string;
}) {
  return (
    <section>
      <p className={fieldLabel}>Journal</p>
      <h1 className="mt-1 font-serif text-display text-on-surface">Journal</h1>

      <Composer areas={areas} userId={userId} />

      {feed.length === 0 ? (
        <EmptyState
          title="Noch nichts festgehalten."
          hint="Sprich oder tippe deinen ersten Gedanken."
        />
      ) : (
        <ul className="mt-6">
          {feed.map((item) => (
            <EntryRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
