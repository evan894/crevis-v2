import type { Telegraf } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { BotContext } from '../index';
import { getProductVariants } from '../utils/queries';

async function proceedToPayment(
  ctx: BotContext,
  productId: string,
  buyerTelegramId: string,
  variant: string | null
) {
  const sentMsg = await ctx.reply('Creating secure payment link... ⏳');

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${appUrl}/api/payment/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, buyerTelegramId, variant }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create payment link');

    await ctx.telegram.editMessageText(
      ctx.chat?.id as number,
      sentMsg.message_id,
      undefined,
      'Tap below to pay securely 👇',
      { reply_markup: { inline_keyboard: [[{ text: '💳 Pay Now', url: data.short_url }]] } }
    );
  } catch (error) {
    console.error('[proceedToPayment]', error);
    await ctx.telegram.editMessageText(
      ctx.chat?.id as number,
      sentMsg.message_id,
      undefined,
      '❌ Payment link creation failed. Please try again later.'
    );
  }
}

export function registerBuyHandlers(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  bot.action(/buy:(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const productId = ctx.match[1];
      const user = ctx.from;
      if (!user) return;

      const product = await getProductVariants(supabase, productId);

      if (product?.has_variants && product.variants) {
        const options = (product.variants as { options: { label: string; stock: number }[] }).options ?? [];
        const buttons: { text: string; callback_data: string }[][] = [];
        for (let i = 0; i < options.length; i += 2) {
          const row: { text: string; callback_data: string }[] = [];
          for (let j = 0; j < 2 && i + j < options.length; j++) {
            const opt = options[i + j];
            if (opt.stock > 0) {
              row.push({ text: opt.label, callback_data: `size:${productId}:${opt.label}` });
            } else {
              row.push({ text: `${opt.label} (out of stock)`, callback_data: 'ignore' });
            }
          }
          buttons.push(row);
        }
        buttons.push([{ text: '⬅ Cancel', callback_data: 'main_menu' }]);
        await ctx.reply('Select your size:', { reply_markup: { inline_keyboard: buttons } });
        return;
      }

      await proceedToPayment(ctx, productId, user.id.toString(), null);
    } catch (err) {
      console.error('[handler buy:*]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action(/size:(.+):(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const productId = ctx.match[1];
      const sizeOption = ctx.match[2];
      const user = ctx.from;
      if (!user) return;

      await ctx.editMessageText(`Selected Size: ${sizeOption}`).catch(() => {});
      await proceedToPayment(ctx, productId, user.id.toString(), sizeOption);
    } catch (err) {
      console.error('[handler size:*]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('ignore', async (ctx) => {
    await ctx.answerCbQuery('This option is currently out of stock', { show_alert: true }).catch(() => {});
  });
}
