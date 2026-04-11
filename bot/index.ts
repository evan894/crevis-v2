import { Telegraf, session, Context } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

import type { Database } from '../types/database.types';
import { sendMainMenu } from './utils/menu';
import { registerStartHandler } from './handlers/start';
import { registerBrowseHandlers } from './handlers/browse';
import { registerSearchHandlers } from './handlers/search';
import { registerBuyHandlers } from './handlers/buy';
import { registerOrdersHandler } from './handlers/orders';
import { registerReturnHandlers } from './handlers/returns';
import { registerPharmacyHandlers } from './handlers/pharmacy';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN must be provided');
}

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SessionData {
  category?: string;
  offset?: number;
  searchState?: string;
  storeContext?: string | null;
  storeContextName?: string | null;
  filters?: {
    category: string | null;
    size: string | null;
    gender: string | null;
    type: string | null;
    budget: string | null;
  };
  filterStep?: string;
  // Pharmacy
  pharmacyState?: 'AWAITING_PRESCRIPTION' | 'AWAITING_MEDICINE_NAME' | 'AWAITING_PHONE';
  pharmacyCart?: Array<{ productId: string; name: string; price: number; shopName: string }>;
  pharmacyPrescriptionFileId?: string;
  buyerPhone?: string;
}

export interface BotContext extends Context {
  session: SessionData;
}

const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN);

bot.use(session());

// Global error handler
bot.catch((err, ctx) => {
  console.error(`[Error] processing update ${ctx.updateType}:`, err);
  ctx.reply('An unexpected error occurred. Please try again later.').catch(console.error);
});

// ── Main menu ─────────────────────────────────────────────────────────────────

bot.action('main_menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const isText = ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message;
    await sendMainMenu(ctx, isText);
  } catch (err) {
    console.error('[handler main_menu]', err);
    await ctx.reply('Something went wrong. Please try /start again.');
  }
});

// ── Feature handlers ──────────────────────────────────────────────────────────

registerStartHandler(bot, supabase);
registerBrowseHandlers(bot, supabase);
registerSearchHandlers(bot, supabase);
registerBuyHandlers(bot, supabase);
registerOrdersHandler(bot, supabase);
registerReturnHandlers(bot, supabase);
registerPharmacyHandlers(bot, supabase);

// ── Launch ────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production' || process.env.RUN_BOT_LOCAL === 'true') {
  bot.launch()
    .then(() => console.log('✅ Bot started in polling mode!'))
    .catch(console.error);
} else {
  console.log('✅ Bot initialized for webhook mode (production).');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
