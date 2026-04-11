import type { Telegraf } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { BotContext } from '../index';
import { getBuyerOrders } from '../utils/queries';

export function registerOrdersHandler(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  bot.action('orders', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = ctx.from;
      if (!user) return;

      const myOrders = await getBuyerOrders(supabase, user.id.toString());

      if (myOrders.length === 0) {
        await ctx.editMessageText('You have no orders yet.', {
          reply_markup: { inline_keyboard: [[{ text: '⬅ Main Menu', callback_data: 'main_menu' }]] },
        }).catch(() => {});
        return;
      }

      let text = '📦 *Your Recent Orders*\n\n';
      for (const o of myOrders) {
        const pData = Array.isArray(o.products) ? o.products[0] : o.products;
        const pName = (pData as { name?: string } | null)?.name ?? 'Unknown Item';
        const date = new Date(o.created_at).toLocaleDateString();
        text += `• ${pName} - ₹${o.amount} [${o.status.toUpperCase()}] on ${date}\n`;
      }

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '⬅ Main Menu', callback_data: 'main_menu' }]] },
      }).catch(() => {});
    } catch (err) {
      console.error('[handler orders]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });
}
