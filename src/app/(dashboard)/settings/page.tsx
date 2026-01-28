import { Suspense } from "react";
import { requireOnboarding } from "@/lib/auth/require-onboarding";
import SettingsClient from "./settings-client";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireOnboarding();
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-black" />}>
      <SettingsClient user={user} />
    </Suspense>
  );
}
