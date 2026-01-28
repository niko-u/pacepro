import { requireOnboarding } from "@/lib/auth/require-onboarding";
import SettingsClient from "./settings-client";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireOnboarding();
  return <SettingsClient user={user} />;
}
