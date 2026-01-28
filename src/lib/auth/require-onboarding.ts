import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Check auth and onboarding status. Redirects if needed.
 * Returns the authenticated user if all checks pass.
 */
export async function requireOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if onboarding is complete
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  return user;
}
