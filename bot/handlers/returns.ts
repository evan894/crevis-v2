import type { Telegraf } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { BotContext } from '../index';
import { sendSlackDM } from '../../lib/slack';
import { getOrderForReturn, getOrderWithRelations, markReturnRequested } from '../utils/queries';

const RETURN_REASONS: Record<string, string> = {
  wrong: 'Wrong item received',
  damaged: 'Item damaged',
  not_described: 'Item not as described',
  changed_mind: 'Changed my mind',
};

export function registerReturnHandlers(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  bot.action(/^return_order_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = await getOrderForReturn(supabase, orderId);

    if (!order) return ctx.answerCbQuery('Order not found.');
    if (order.return_requested) return ctx.answerCbQuery('Return already requested.', { show_alert: true });
    if (!order.return_window_closes_at || new Date(order.return_window_closes_at).getTime() <= Date.now()) {
      await ctx.answerCbQuery();
      return ctx.reply('Return window has closed for this order.');
    }

    await ctx.reply('Why do you want to return?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Wrong item received', callback_data: `submit_return_${orderId}_wrong` }],
          [{ text: 'Item damaged', callback_data: `submit_return_${orderId}_damaged` }],
          [{ text: 'Item not as described', callback_data: `submit_return_${orderId}_not_described` }],
          [{ text: 'Changed my mind', callback_data: `submit_return_${orderId}_changed_mind` }],
        ],
      },
    });
    await ctx.answerCbQuery();
  });

  bot.action(/^submit_return_(.+)_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const reasonKey = ctx.match[2];
    const reason = RETURN_REASONS[reasonKey] ?? 'Other';

    const order = await getOrderWithRelations(supabase, orderId);

    if (!order) return ctx.answerCbQuery('Order not found.');
    if (order.return_requested) return ctx.answerCbQuery('Return already requested.');
    if (!order.return_window_closes_at || new Date(order.return_window_closes_at).getTime() <= Date.now()) {
      await ctx.answerCbQuery();
      return ctx.reply('Return window has closed for this order.');
    }

    await markReturnRequested(supabase, orderId, reason);

    const productName = Array.isArray(order.products)
      ? (order.products[0] as { name?: string } | null)?.name
      : (order.products as { name?: string } | null)?.name;

    await ctx.editMessageText(
      `Return request submitted for ${productName}.\nThe seller will contact you to arrange pickup.\nCredits will not be released until return is resolved.`
    );

    const slackToken = Array.isArray(order.sellers)
      ? (order.sellers[0] as { slack_access_token?: string } | null)?.slack_access_token
      : (order.sellers as { slack_access_token?: string } | null)?.slack_access_token;
    const slackUserId = Array.isArray(order.sellers)
      ? (order.sellers[0] as { slack_user_id?: string } | null)?.slack_user_id
      : (order.sellers as { slack_user_id?: string } | null)?.slack_user_id;

    if (slackToken && slackUserId) {
      await sendSlackDM(
        slackToken,
        slackUserId,
        `↩️ Return requested for ${productName}\nBuyer: ${order.buyer_name}\nReason: ${reason}\nContact buyer to arrange pickup.`
      ).catch(console.error);
    }
  });
}
