import EveningJournalForm from "@/components/features/journal/EveningJournalForm";
import { list } from "@/lib/tasks/actions";

export default async function EveningJournalPage() {
  const top3Tasks = await list({ status: "all" }).then((tasks) =>
    tasks.filter((t) => t.is_top3),
  );
  return <EveningJournalForm top3Tasks={top3Tasks} />;
}
