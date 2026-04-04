import { NextResponse } from 'next/server';


export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sellerId = url.searchParams.get('sellerId');
  
  if (!sellerId) {
    return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`;
  const scope = 'chat:write,im:write,users:read';
  
  // Provide sellerId in the state parameter
  const state = sellerId;
  
  const slackOAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;

  return NextResponse.redirect(slackOAuthUrl);
}
