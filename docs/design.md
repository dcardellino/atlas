---
version: alpha
name: Atlas
description: Warm, editorial design system for a personal life-OS — a literary almanac, not a cool tech tool. Light and dark, one rust accent, serif/sans/mono trio.

colors:
  surface: "#F6ECE8"
  surface-dark: "#1A1614"
  surface-raised: "#FCF6F3"
  surface-raised-dark: "#241E1B"
  on-surface: "#1F1B19"
  on-surface-dark: "#EDE4DE"
  on-surface-muted: "#8C8178"
  on-surface-muted-dark: "#A2958C"
  border: "#E6DAD4"
  border-dark: "#332A26"
  accent: "#A8432B"
  accent-dark: "#C75A3E"
  on-accent: "#FBF4F1"
  on-accent-dark: "#1A1614"
  success: "#3E6B4F"
  success-dark: "#5E8C6F"
  warning: "#B57F2E"
  warning-dark: "#D19E4E"
  danger: "#8F2C20"
  danger-dark: "#C75144"
  info: "#3B5A6B"
  info-dark: "#6E93A6"
  cat-rust: "#A8432B"
  cat-forest: "#3E6B4F"
  cat-navy: "#2F4858"
  cat-gold: "#B57F2E"
  cat-maroon: "#6E2A2A"
  cat-teal: "#2C6E6A"
  cat-violet: "#6B5B95"
  cat-stone: "#8C8178"

typography:
  display:
    fontFamily: Newsreader, Georgia, serif
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.02em
  title:
    fontFamily: Newsreader, Georgia, serif
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.01em
  subtitle:
    fontFamily: Newsreader, Georgia, serif
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.2
  body:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "IBM Plex Mono", ui-monospace, monospace
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.08em
  meta:
    fontFamily: "IBM Plex Mono", ui-monospace, monospace
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.06em

rounded:
  none: 0
  sm: 2px
  md: 4px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px

components:
  button-primary:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
    height: 44px
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: 4px 10px
  chip-filter-active:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: 4px 10px
  input-text:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 10px 12px
    height: 44px
  list-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    padding: 14px 0
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  checkbox:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    size: 18px
  checkbox-checked:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    size: 18px
---

# Atlas Design System

## Overview
Atlas ist ein persönliches Lebens-OS, das sich wie ein ruhiges, gut gesetztes Almanach anfühlt — nicht wie ein Dashboard und nicht wie ein kühles Tech-Tool. Der primäre Nutzer ist eine Person, die das System täglich auf dem iPhone (PWA) und gelegentlich am Desktop nutzt, oft im Vorbeigehen. Die emotionale Reaktion soll sein: Ruhe, Ordnung, Vertrauen — das System hält etwas verlässlich fest und drängt sich nie auf. Zwei Anti-Patterns bestimmen das System mehr als jede positive Regel: Es darf niemals **generisch/template-haft** wirken (kein Material- oder Bootstrap-Default-Look) und niemals **kühl/steril-technisch** werden. Wärme, redaktioneller Charakter und Zurückhaltung gewinnen im Zweifel immer.

## Colors
Die Fläche ist warmes Papier — ein blush-getöntes Cream (`surface`), das dem System seinen analogen, almanachhaften Grundton gibt; `surface-raised` hebt Karten und Eingabefelder minimal ab. Text ist ein warmes Fast-Schwarz (`on-surface`), Labels und Metadaten laufen im gedämpften Taupe (`on-surface-muted`). Ein **einziger** Akzent trägt die gesamte interaktive und emphatische Bedeutung: Terracotta/Rost (`accent`) für den Top-3-Stern, überfällige Items, fokussierte Eingaben und Hervorhebungen — sparsam eingesetzt, damit er Gewicht behält. Semantische Zustände sind aus der kategorischen Projekt-Palette abgeleitet, damit sie mit dem Rost harmonieren statt zu konkurrieren: `success` (Forest), `warning` (Amber), `danger` (Brick), `info` (Navy). Die `cat-*`-Farben codieren Lebensbereiche (Areas) als ruhige, gedeckte Punkte. Jeder Token hat eine `-dark`-Variante: Dark-Mode ist bewusst **warm** (Espresso statt kühlem Slate), Akzent und Semantik werden leicht aufgehellt, damit sie auf dunklem Grund Kontrast halten. Textkontraste erfüllen mindestens WCAG AA.

## Typography
Drei Familien bilden die Persönlichkeit: eine literarische High-Contrast-**Serif** (*Newsreader*) für Display und Titel, eine neutrale humanistische **Sans** (*Inter*) für Body, Listen und Formularwerte, und eine **Monospace** (*IBM Plex Mono*) für alle Labels und Metadaten. Das Mono-Label in Versalien mit weitem Letter-Spacing (`label`, `meta`) ist die Signatur des Systems — es rahmt jede Serif-Headline als kleines Eyebrow und trägt sämtliche Statuszeilen (`DUE TODAY`, `OVERDUE`, `CADENCE`). Die Serif-Stufen (`display`, `title`, `subtitle`) sind für Seitentitel und Eintragsnamen reserviert und nie für Fließtext. Die Sans-Stufen (`body`, `body-sm`) tragen alles Lesbare und Funktionale. Versalien werden über CSS (`text-transform: uppercase`) erzeugt, nicht über den Schriftschnitt. Anti-Pattern: Body niemals in der Serif setzen, Labels niemals in der Sans — die Rollentrennung ist die halbe Identität.

## Layout
Das System ist mobile-first gedacht, auch wenn die Referenz desktop-first war: Die dreispaltige Today-Ansicht (Inhalt + rechte Slipping/Routines/Resurfacing-Spalte) kollabiert auf dem iPhone zu einer **einzelnen Spalte** mit klarer Reihenfolge — Quick-Capture, Top-3, fällig heute, Kalender, kürzlich erfasst. Auf Desktop dürfen die Nebenbereiche zurück in eine rechte Spalte wandern. Der Spacing-Rhythmus basiert auf 8 (`xs`–`2xl`); die Dichte ist „comfortable" — luftiger als ein Dashboard, aber kompakter als die großzügige Desktop-Referenz, damit dichte Listen auf kleinen Screens nicht zerfasern. Seiten folgen einem festen Muster: Mono-Eyebrow, große Serif-Headline, rechts ausgerichtete Meta, dann der Inhalt. Container haben großzügige Außenränder; Inhalt bleibt linksbündig und textgeführt.

## Elevation & Depth
Das System ist flach. Tiefe entsteht nicht durch Schatten, sondern durch **Haarlinien** (`border`) zwischen Listeneinträgen und durch den minimalen Helligkeitsunterschied zwischen `surface` und `surface-raised`. Das hält den papierhaften, redaktionellen Charakter und vermeidet den generischen „Karten mit Drop-Shadow"-Look. Die einzige bewusste Ausnahme sind temporäre Overlays (Select-Popover, Quick-Capture, Toast), die eine sehr weiche, niedrige Erhöhung tragen dürfen, um sich vom Hintergrund zu lösen. Im Dark-Mode ersetzt der Helligkeitssprung zwischen `surface-dark` und `surface-raised-dark` die Linie dort, wo Haarlinien zu schwach würden.

## Shapes
Die Formensprache ist scharf und ruhig: `none` und `sm` (2px) dominieren, `md` (4px) nur für Karten. Buttons, Eingabefelder, Filter-Chips und Checkboxen sind nahezu eckig — das signalisiert Präzision und redaktionellen Ernst, nicht verspielte Weichheit. `full` ist ausschließlich kreisförmigen Elementen vorbehalten: Area-Farbpunkten, Avataren, dem Aufnahme-Indikator. Keine gemischten Radien innerhalb einer Komponentenklasse — Konsistenz der Kanten ist Teil der Identität.

## Components
`button-primary` ist das warme Fast-Schwarz mit hellem Text (`SAVE`, `SYNC NOW`), Label-Typografie in Versalien; im `button-primary-hover` wechselt die Fläche bewusst auf den Rost-Akzent — der einzige Ort, an dem Schwarz zu Farbe wird, als kleine editoriale Geste. `button-secondary` bleibt flächig auf `surface-raised` mit einer Haarlinien-Border (in Prosa, da Border kein Token-Property ist). `chip-filter` trägt Mono-Meta in Taupe; im `-active`-Zustand invertiert es zu dunkler Fläche mit heller Schrift (siehe Referenz `OPEN`/`DONE`/`ALL`). `input-text` sitzt auf `surface-raised`, im Fokus erhält es eine Rost-Unterlinie statt eines Glow. `list-item` nutzt keine Karte, sondern eine untere Haarlinie und großzügiges vertikales Padding — Listen sind textgeführt, nicht umrandet. `card` ist Karten mit minimalem Radius für abgegrenzte Inhalte (Needs-Review, Resurfacing). `checkbox` ist quadratisch; `checkbox-checked` füllt sich mit `on-surface` und einem hellen Haken. Streak-Indikatoren (Quadrate-Reihe + Flamme + Zahl) und Nav beschreiben sich aus diesen Primitives; die Bottom-Nav auf Mobile nutzt `meta`-Labels.

## Do's and Don'ts
**Do:** Den Rost sparsam und gezielt einsetzen — Stern, Überfällig, Fokus, Hover — damit er Bedeutung trägt. Jede Headline mit einem Mono-Eyebrow rahmen. Tiefe über Haarlinien und `surface-raised` erzeugen, nicht über Schatten. Die Serif für Namen/Titel, die Sans für Lesbares, die Mono für Labels strikt trennen. Dark warm halten (Espresso, nicht Slate). Tap-Targets auf Mobile mindestens 44px.
**Don't:** Niemals den generischen Material-/Bootstrap-Look zulassen (keine bunten Buttons, keine Drop-Shadow-Karten, kein Floating-Action-Button-Standard). Niemals kühl/steril werden — kein reines Grau-auf-Weiß, kein kaltes Blau als Primärfarbe. Body nie in der Serif, Labels nie in der Sans setzen. Den Akzent nicht inflationär verwenden (keine vollflächig rosten Bereiche). Keine gemischten Eck-Radien innerhalb einer Komponentenklasse. Keine Gamification-Konfetti oder verspielten Animationen — Streaks bleiben sachlich.
