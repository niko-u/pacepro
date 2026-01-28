import { requireOnboarding } from "@/lib/auth/require-onboarding";
import CalendarClient from "./calendar-client";

export default async function CalendarPage() {
  const user = await requireOnboarding();
  return <CalendarClient user={user} />;
}
