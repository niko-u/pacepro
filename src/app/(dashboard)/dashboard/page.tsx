import { requireOnboarding } from "@/lib/auth/require-onboarding";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireOnboarding();
  return <DashboardClient user={user} />;
}
