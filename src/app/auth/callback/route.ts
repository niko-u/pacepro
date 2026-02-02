import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function isValidRedirectPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.includes("//") &&
    !path.includes("@") &&
    !path.match(/^\/[a-zA-Z]+:/i) // block /http:, /javascript:, etc.
  );
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = isValidRedirectPath(rawNext) ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
