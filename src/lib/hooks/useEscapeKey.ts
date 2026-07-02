import { useEffect } from "react";

/**
 * Close-on-Escape for overlays/dialogs (TASK-054, keyboard accessibility). Mirrors
 * the inline Escape handling in QuickCapture so every modal is dismissable without
 * a pointer.
 */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
