"use client";

import { useState } from "react";
import { formatTime, toInt, parseTime } from "@/lib/workouts/draft";
import { numInput } from "./fieldStyles";

/**
 * Geteiltes mm:ss-Eingabe-Atom für Zeitdauern.
 *
 * Lokaler Display-State: initialisiert einmalig aus dem Sekunden-String
 * (`value`). Änderungen im Input schreiben `String(parseTime(v))` oder `""`
 * zurück via `onChange` — kompatibel zu `blocksToInput`/`parseTime`.
 *
 * Props:
 * - `value`:     Sekunden als String (z. B. "750" für 12:30 min)
 * - `onChange`:  Callback mit Sekunden als String (oder "" bei leerem/ungültigem Input)
 * - `ariaLabel`: aria-label-Attribut des `<input>` (z. B. "Split (mm:ss)")
 * - `placeholder`: Platzhaltertext (default: "mm:ss")
 */
export function TimeField({
  value,
  onChange,
  ariaLabel,
  placeholder = "mm:ss",
}: {
  value: string;
  onChange: (secondsString: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  // Einmalige Initialisierung aus Sekunden → mm:ss-Anzeige
  const [display, setDisplay] = useState(() => formatTime(toInt(value)));

  return (
    <input
      aria-label={ariaLabel}
      value={display}
      onChange={(e) => {
        const v = e.target.value;
        setDisplay(v);
        // Sekunden zurückschreiben (kompatibel zu blocksToInput/parseTime)
        const parsed = parseTime(v);
        onChange(parsed != null ? String(parsed) : "");
      }}
      placeholder={placeholder}
      className={numInput}
    />
  );
}
