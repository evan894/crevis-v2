import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // That's our sellerId
  
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('client_id', process.env.SLACK_CLIENT_ID!);
    formData.append('client_secret', process.env.SLACK_CLIENT_SECRET!);
    formData.append('code', code);
    formData.append('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`);

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!data.ok) {
       console.error("Slack OAuth Error:", data);
       return NextResponse.json({ error: "Failed to exchange slack token" }, { status: 400 });
    }

    // data.authed_user.access_token contains the user token which has the scope
    // data.authed_user.id contains the slack user id
    const slackAccessToken = data.authed_user?.access_token;
    const slackUserId = data.authed_user?.id;

    if (!slackAccessToken || !slackUserId) {
        return NextResponse.json({ error: "No user token provided by Slack. Ensure you requested user scopes like chat:write." }, { status: 400 });
    }

    // Save to Seller record directly
    const { error } = await supabaseAdmin.from('sellers').update({
        slack_access_token: slackAccessToken,
        slack_user_id: slackUserId,
    }).eq('id', state);

    if (error) {
       console.error("Failed to save to supabase:", error);
       return NextResponse.json({ error: "Failed to link Slack account" }, { status: 500 });
    }

    // Redirect to onboarding with connected flag
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=2&connected=true`);

  } catch (error) {
    console.error("Exchange error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
