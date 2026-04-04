import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be provided");
}

const botUrl = process.argv[2];
if (!botUrl || !botUrl.startsWith('https://')) {
    console.error("Please provide the full production webhook URL (e.g. https://crevis.in/api/webhooks/telegram)");
    process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

async function registerWebhook() {
  try {
    const res = await bot.telegram.setWebhook(botUrl);
    if (res) {
        console.log(`✅ Successfully bound Telegram Webhook to: ${botUrl}`);
        
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log("Current Webhook Info:");
        console.log(webhookInfo);
    } else {
        console.error("Failed to bind Webhook");
    }
  } catch (error) {
    console.error("Error setting webhook:", error);
  }
}

registerWebhook();
