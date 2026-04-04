import { NextResponse } from "next/server";

export async function GET() {
  const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`;
  
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=chat:write,chat:write.public&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
  return NextResponse.redirect(slackAuthUrl);
}
