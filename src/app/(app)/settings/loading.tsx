import { SkeletonScreen } from "@/components/ui/Skeleton";

// Settings loading state (TASK-050): skeleton cards, not a spinner.
export default function SettingsLoading() {
  return <SkeletonScreen eyebrow="Einstellungen" title="Settings" rows={4} />;
}
