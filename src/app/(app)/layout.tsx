import Nav from "@/components/ui/Nav";
import QuickCapture from "@/components/features/capture/QuickCapture";
import { seedDefaultAreas } from "@/lib/areas/seed";

// Authenticated app shell: mobile-first single column with a sticky bottom nav.
// Access is gated by middleware (TASK-006); on desktop the side areas can move
// back into a right column in later phases.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First-login default areas (TASK-011); idempotent, safe on every request.
  await seedDefaultAreas();

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {children}
      </main>
      <Nav />
      {/* App-wide quick capture overlay; opens with Cmd/Ctrl+J (TASK-019). */}
      <QuickCapture />
    </div>
  );
}
