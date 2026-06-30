import type { Config } from "tailwindcss";

// All values mirror the YAML front-matter of docs/design.md (the single styling
// source). Colours are wired as CSS variables so light/dark (warm Espresso) and
// the manual toggle all resolve from one place — see src/app/globals.css.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-muted": "var(--color-on-surface-muted)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
        "on-accent": "var(--color-on-accent)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
        // Area category palette (quiet, muted dots)
        "cat-rust": "var(--color-cat-rust)",
        "cat-forest": "var(--color-cat-forest)",
        "cat-navy": "var(--color-cat-navy)",
        "cat-gold": "var(--color-cat-gold)",
        "cat-maroon": "var(--color-cat-maroon)",
        "cat-teal": "var(--color-cat-teal)",
        "cat-violet": "var(--color-cat-violet)",
        "cat-stone": "var(--color-cat-stone)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing }]
        display: ["40px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        title: ["28px", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        subtitle: ["20px", { lineHeight: "1.2" }],
        body: ["16px", { lineHeight: "1.5" }],
        "body-sm": ["14px", { lineHeight: "1.45" }],
        label: ["12px", { lineHeight: "1.2", letterSpacing: "0.08em" }],
        meta: ["11px", { lineHeight: "1.3", letterSpacing: "0.06em" }],
      },
      letterSpacing: {
        label: "0.08em",
        meta: "0.06em",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        md: "4px",
        full: "9999px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        "2xl": "64px",
      },
    },
  },
  plugins: [],
};

export default config;
