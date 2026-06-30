import { redirect } from "next/navigation";

// The root route forwards into the authenticated app shell. Unauthenticated
// users are bounced to /login by middleware (TASK-006).
export default function RootPage() {
  redirect("/today");
}
