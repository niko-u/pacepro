import { requireOnboarding } from "@/lib/auth/require-onboarding";
import AnalyticsClient from "./analytics-client";

export const metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const user = await requireOnboarding();
  return <AnalyticsClient user={user} />;
}
