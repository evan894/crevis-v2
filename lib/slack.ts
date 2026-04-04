import { WebClient } from '@slack/web-api';

export const slackAdmin = new WebClient(process.env.SLACK_BOT_TOKEN!);
