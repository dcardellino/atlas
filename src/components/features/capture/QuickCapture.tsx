"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Quick-capture overlay (TASK-019). Large textarea + mic (Web Speech API with a
 * graceful text fallback). Cmd/Ctrl+J opens it focused. On submit it POSTs to
 * /api/capture and shows a terse confirmation toast (Voice & Tone: knapp, kein
 * Hype). Mounted app-wide in the (app) layout.
 */

type CaptureResult = {
  type?: string;
  title?: string;
  area?: { id: string; name: string } | null;
  note?: string;
};

// Minimal Web Speech API surface (not in lib.dom types).
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
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

export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const usedVoice = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setText("");
    setError(null);
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  // Cmd/Ctrl+J opens focused; Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

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
      setText(transcript);
      usedVoice.current = true;
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

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
      const data: CaptureResult = await res.json();
      if (!res.ok && res.status !== 207) {
        setError("Konnte nicht erfassen — kurz prüfen?");
        setPending(false);
        return;
      }
      const area = data.area?.name ? ` — Bereich ${data.area.name}` : "";
      const label =
        data.type === "note" || res.status === 207
          ? "In Inbox abgelegt"
          : `Erfasst${area}`;
      setToast(label);
      usedVoice.current = false;
      close();
      window.setTimeout(() => setToast(null), 4000);
    } catch {
      setError("Konnte nicht erfassen — kurz prüfen?");
    } finally {
      setPending(false);
    }
  }

  function onTextKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <>
      {/* Floating button to open (mobile FAB / desktop). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Schnell erfassen"
        className="fixed bottom-20 right-5 z-20 h-14 w-14 rounded-full bg-accent font-mono text-label uppercase tracking-label text-on-accent shadow-sm"
      >
        +
      </button>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-sm border border-border bg-surface-raised px-4 py-2 font-mono text-meta uppercase tracking-label text-on-surface"
        >
          {toast}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-on-surface/30 px-4 pt-24"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
              Erfassen
            </p>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onTextKey}
              rows={3}
              placeholder="Sprich oder tippe deinen Gedanken …"
              className="mt-2 w-full resize-none rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
            />
            {error && (
              <p role="alert" className="mt-2 text-body-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
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
              <button
                type="button"
                onClick={submit}
                disabled={pending || !text.trim()}
                className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
              >
                {pending ? "Sende…" : "Senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
