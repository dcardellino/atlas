"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * App-wide toast (TASK-051). A single, terse confirmation pill — the design is
 * lifted from the original QuickCapture toast. Tone stays sachlich und knapp
 * (Vision § Voice & Tone): confirmations only, never Hype, never a notification
 * that doesn't count. `aria-live="polite"` so screen readers announce it.
 */

type ToastContextValue = { show: (message: string) => void };

// A no-op default keeps toast-consuming components renderable in isolation
// (tests, Storybook) without a provider; the real ToastProvider — mounted app-
// wide in (app)/layout — overrides it to render the visible pill.
const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback((message: string) => {
    setToast(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-sm border border-border bg-surface-raised px-4 py-2 font-mono text-meta uppercase tracking-label text-on-surface"
        >
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}
