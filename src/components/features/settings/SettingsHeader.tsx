import SettingsTabs from "@/components/features/settings/SettingsTabs";

/**
 * Gemeinsamer Kopf des Settings-Bereichs: Mono-Eyebrow, große Serif-Headline,
 * darunter die In-Page-Tabs (analog zu WorkoutHeader). Rein präsentational.
 */
export default function SettingsHeader({ title }: { title: string }) {
  return (
    <header>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Einstellungen
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">{title}</h1>
      <SettingsTabs />
    </header>
  );
}
