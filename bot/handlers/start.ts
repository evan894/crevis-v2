import type { Telegraf } from 'telegraf';
import type { BotContext } from '../index';
import { sendMainMenu } from '../utils/menu';
import { findBuyer, upsertBuyer, getProductById, getSellerBySlug } from '../utils/queries';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

export function registerStartHandler(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  bot.start(async (ctx) => {
    const user = ctx.message.from;
    try {
      const existing = await findBuyer(supabase, user.id.toString());
      if (!existing) {
        await upsertBuyer(supabase, user.id.toString(), user.first_name ?? null, user.username ?? null);
      }

      ctx.session = {
        category: undefined,
        offset: undefined,
        searchState: undefined,
        storeContext: undefined,
        storeContextName: undefined,
        filters: undefined,
        filterStep: undefined,
      };

      const payload = ctx.startPayload;

      if (payload?.startsWith('product_')) {
        const productId = payload.replace('product_', '');
        const product = await getProductById(supabase, productId);

        if (!product) {
          await ctx.reply('Sorry, this product is no longer available.\n\nBrowse all products with /start', {
            reply_markup: { inline_keyboard: [[{ text: '🛍 Browse All Products', callback_data: 'browse' }]] },
          });
          return;
        }

        const sData = Array.isArray(product.sellers) ? product.sellers[0] : product.sellers;
        const shopName = (sData as { shop_name?: string } | null)?.shop_name || 'Crevis Store';

        ctx.session.storeContext = product.seller_id;
        ctx.session.storeContextName = shopName;

        const caption = `*${product.name}*\n₹${product.price.toLocaleString('en-IN')}\n\n${product.description || ''}\n\nFrom *${shopName}*${product.boosted ? ' 🚀' : ''}`;

        await ctx.replyWithPhoto(product.photo_url, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: `💳 Buy Now — ₹${product.price.toLocaleString('en-IN')}`, callback_data: `buy:${product.id}` }],
              [{ text: '🛍 Browse More', callback_data: 'browse' }],
            ],
          },
        });
        return;
      }

      if (payload?.startsWith('store_')) {
        const shopSlug = payload.replace('store_', '');
        const seller = await getSellerBySlug(supabase, shopSlug);

        if (seller) {
          ctx.session.storeContext = seller.id;
          ctx.session.storeContextName = seller.shop_name;

          await ctx.reply(
            `👋 Welcome to ${seller.shop_name} on Crevis!\nYou're browsing ${seller.shop_name}'s collection.\n\nWhat would you like to do?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🛍 Browse Products', callback_data: 'browse' }],
                  [{ text: '🔍 Search', callback_data: 'search' }],
                  [{ text: '📦 My Orders', callback_data: 'orders' }],
                ],
              },
            }
          );
          return;
        }
      }

      ctx.session.storeContext = null;
      ctx.session.storeContextName = null;
      await sendMainMenu(ctx, false);
    } catch (error) {
      console.error('[handler start]', error);
      await ctx.reply('Failed to initialize your account. Please try again.');
    }
  });
}
