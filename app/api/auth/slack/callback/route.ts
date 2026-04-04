import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=2&error=slack_denied`);
  }

  const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
  const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`;

  try {
    const slackRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await slackRes.json();
    if (!data.ok) throw new Error(data.error || "Slack auth failed");

    const slackAccessToken = data.access_token;
    const slackUserId = data.authed_user.id;

    const cookieStore = cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { error: dbError } = await supabase
      .from("sellers")
      .update({
        slack_access_token: slackAccessToken,
        slack_user_id: slackUserId,
      })
      .eq("user_id", user.id);

    if (dbError) throw dbError;

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=2&slack_success=true`);
  } catch (err) {
    console.error("Slack Callback Error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=2&error=slack_exchange_failed`);
  }
}
