import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminToken = process.env.ADMIN_SECRET_TOKEN;
const domain = "https://crevis.in";

const webhookUrl = `${domain}/api/telegram/webhook?token=${encodeURIComponent(adminToken!)}`;
const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

fetch(url)
  .then(res => res.json())
  .then(json => console.log("Webhook registration result:", json))
  .catch(console.error);
