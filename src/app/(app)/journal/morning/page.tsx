import MorningJournalForm from "@/components/features/journal/MorningJournalForm";
import { list } from "@/lib/tasks/actions";

export default async function MorningJournalPage() {
  const openTasks = await list({ status: "open" });
  return <MorningJournalForm openTasks={openTasks} />;
}
