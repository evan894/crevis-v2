import type { Telegraf } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { BotContext } from '../index';
import { buildProductQuery, getActiveProductsForSearch } from '../utils/queries';

export function registerSearchHandlers(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  bot.action('search', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      ctx.session.category = undefined;
      ctx.session.searchState = 'AWAITING_QUERY';

      const storeLabel = ctx.session?.storeContextName
        ? `Search ${ctx.session.storeContextName}'s collection:`
        : 'What are you looking for?';

      await ctx.editMessageText(storeLabel, {
        reply_markup: { inline_keyboard: [[{ text: '⬅ Cancel', callback_data: 'main_menu' }]] },
      }).catch(() => {});
    } catch (err) {
      console.error('[handler search]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.searchState !== 'AWAITING_QUERY') return next();

    ctx.session.searchState = undefined;
    const query = ctx.message.text.trim();
    const sentMsg = await ctx.reply('🔍 Searching...');

    try {
      const allActive = await getActiveProductsForSearch(supabase, ctx.session?.storeContext || null);

      if (allActive.length === 0) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          sentMsg.message_id,
          undefined,
          "Couldn't find that. Try browsing by category.",
          { reply_markup: { inline_keyboard: [[{ text: '🛍 Browse Products', callback_data: 'browse' }]] } }
        );
        return;
      }

      let matchedIds: string[] = [];
      try {
        const { searchProductsWithGemini } = await import('../../lib/gemini');
        matchedIds = await searchProductsWithGemini(query, JSON.stringify(allActive));
      } catch {
        const lq = query.toLowerCase();
        matchedIds = allActive
          .filter((p) => p.name.toLowerCase().includes(lq) || (p.description ?? '').toLowerCase().includes(lq))
          .map((p) => p.id)
          .slice(0, 3);
      }

      if (matchedIds.length === 0) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          sentMsg.message_id,
          undefined,
          "Couldn't find that. Try browsing by category.",
          { reply_markup: { inline_keyboard: [[{ text: '🛍 Browse Products', callback_data: 'browse' }]] } }
        );
        return;
      }

      let productQuery = buildProductQuery(supabase, ctx.session?.storeContext || null).in('id', matchedIds);

      const filters = ctx.session?.filters;
      if (filters) {
        if (filters.size && filters.size !== 'any') {
          productQuery = productQuery.contains('variants', { options: [{ label: filters.size }] });
        }
        if (filters.budget && filters.budget !== 'any') {
          if (filters.budget === 'under500') productQuery = productQuery.lte('price', 500);
          else if (filters.budget === '500to1500') productQuery = productQuery.gte('price', 500).lte('price', 1500);
          else if (filters.budget === 'above1500') productQuery = productQuery.gte('price', 1500);
        }
      }

      const { data: rawMatched } = await productQuery;
      await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(() => {});

      let matched = rawMatched ?? [];
      if (filters?.size && filters.size !== 'any') {
        matched = matched.filter((p) => {
          if (!p.has_variants || !p.variants) return false;
          const opts = (p.variants as { options: { label: string; stock: number }[] }).options;
          return opts.some((o) => o.label === filters.size && o.stock > 0);
        });
      }

      if (matched.length === 0) {
        const noResText = filters
          ? 'No products found matching your search and preferences.'
          : "Couldn't find that. Try browsing by category.";
        await ctx.reply(noResText, {
          reply_markup: { inline_keyboard: [[{ text: '🛍 Browse Products', callback_data: 'browse' }]] },
        });
        return;
      }

      for (const p of matched) {
        const sData = Array.isArray(p.sellers) ? p.sellers[0] : p.sellers;
        const shopName = (sData as { shop_name?: string } | null)?.shop_name ?? 'Unknown Shop';
        const caption = `**${p.name}**\nPrice: ₹${p.price}\nShop: ${shopName}${p.boosted ? ' 🚀 *BOOSTED*' : ''}\n\n${p.description || ''}`;

        await ctx.replyWithPhoto(p.photo_url, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: `Buy Now ₹${p.price}`, callback_data: `buy:${p.id}` }]] },
        });
      }

      await ctx.reply('Search completed.', {
        reply_markup: { inline_keyboard: [[{ text: '⬅ Main Menu', callback_data: 'main_menu' }]] },
      });
    } catch (e) {
      console.error('[search text handler]', e);
      await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(() => {});
      await ctx.reply('An error occurred during search. Please try again.');
    }
  });
}
