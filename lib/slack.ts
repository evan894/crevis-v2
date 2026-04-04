import { WebClient } from '@slack/web-api';

export const slackAdmin = new WebClient(process.env.SLACK_BOT_TOKEN!);

export const sendSlackDM = async (slackAccessToken: string | null, slackUserId: string | null, text: string) => {
  if (!slackAccessToken || !slackUserId) return;
  try {
    const slackClient = new WebClient(slackAccessToken);
    await slackClient.chat.postMessage({
        channel: slackUserId,
        text
    });
  } catch (error) {
    throw error;
  }
};
