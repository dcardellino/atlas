import WorkoutHeader from "@/components/features/workouts/WorkoutHeader";
import TemplateManager from "@/components/features/workouts/TemplateManager";
import { listTemplates } from "@/lib/workouts/actions";

// Vorlagen verwalten / aus Vorlage starten.
export default async function TemplatesPage() {
  const templates = await listTemplates();
  return (
    <section>
      <WorkoutHeader title="Vorlagen" />
      <TemplateManager templates={templates} />
    </section>
  );
}
