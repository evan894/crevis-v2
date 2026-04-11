import type { Telegraf } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { BotContext } from '../index';
import { CATEGORIES } from '../../lib/constants';
import { buildProductQuery } from '../utils/queries';
import { sendMainMenu } from '../utils/menu';
import {
  askClothingSize,
  askFootwearSize,
  askGender,
  askType,
  askBudget,
} from '../utils/filters';

export async function sendProducts(
  ctx: BotContext,
  supabase: SupabaseClient<Database>,
  category: string,
  offset: number
) {
  let query = buildProductQuery(supabase, ctx.session?.storeContext || null)
    .eq('category', category)
    .eq('active', true);

  const filters = ctx.session?.filters;
  if (filters) {
    if (filters.size && filters.size !== 'any') {
      query = query.contains('variants', { options: [{ label: filters.size }] });
    }
    if (filters.budget && filters.budget !== 'any') {
      if (filters.budget === 'under500') query = query.lte('price', 500);
      else if (filters.budget === '500to1500') query = query.gte('price', 500).lte('price', 1500);
      else if (filters.budget === 'above1500') query = query.gte('price', 1500);
    }
    if (filters.gender && filters.gender !== 'any') {
      query = query.or(`name.ilike.%${filters.gender}%,description.ilike.%${filters.gender}%`);
    }
    if (filters.type && filters.type !== 'any') {
      query = query.or(`name.ilike.%${filters.type}%,description.ilike.%${filters.type}%`);
    }
  }

  const { data: rawProducts, error } = await query;

  if (error) {
    console.error('[sendProducts]', error);
    await ctx.reply('Error fetching products.');
    return;
  }

  // JS filter for size stock > 0
  let products = rawProducts ?? [];
  if (filters?.size && filters.size !== 'any') {
    products = products.filter((p) => {
      if (!p.has_variants || !p.variants) return false;
      const opts = (p.variants as { options: { label: string; stock: number }[] }).options;
      return opts.some((o) => o.label === filters.size && o.stock > 0);
    });
  }

  const count = products.length;
  const paginated = products.slice(offset, offset + 4);

  if (count === 0) {
    const noResultMarkup = {
      inline_keyboard: [
        [{ text: '⬅ Try Different Filters', callback_data: `category:${category}` }],
        [{ text: '⬅ Back to Categories', callback_data: 'browse' }],
      ],
    };
    const noResultText = `No products matching your filters in ${category}.`;
    if (offset === 0) {
      if (ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message) {
        await ctx.editMessageText(noResultText, { reply_markup: noResultMarkup }).catch(() => {});
      } else {
        await ctx.reply(noResultText, { reply_markup: noResultMarkup });
      }
    } else {
      await ctx.reply('No more products.', {
        reply_markup: { inline_keyboard: [[{ text: '⬅ Back to Categories', callback_data: 'browse' }]] },
      });
    }
    return;
  }

  if (ctx.callbackQuery && offset === 0 && ctx.callbackQuery.message) {
    await ctx.deleteMessage().catch(() => {});
  }

  for (const p of paginated) {
    const sData = Array.isArray(p.sellers) ? p.sellers[0] : p.sellers;
    const shopName = (sData as { shop_name?: string } | null)?.shop_name ?? 'Unknown Shop';
    const caption = `**${p.name}**\nPrice: ₹${p.price}\nShop: ${shopName}${p.boosted ? ' 🚀 *BOOSTED*' : ''}\n\n${p.description || ''}`;

    await ctx.replyWithPhoto(p.photo_url, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: `Buy Now ₹${p.price}`, callback_data: `buy:${p.id}` }]] },
    });
  }

  const hasMore = offset + 4 < count;
  const navButtons = [];
  if (hasMore) navButtons.push([{ text: 'Load More ⬇️', callback_data: 'load_more' }]);
  navButtons.push([{ text: '⬅ Back to Categories', callback_data: 'browse' }]);

  await ctx.reply(`Showing ${Math.min(offset + 4, count)} of ${count} in ${category}`, {
    reply_markup: { inline_keyboard: navButtons },
  });
}

export function registerBrowseHandlers(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  bot.action('browse', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      if (ctx.session) {
        ctx.session.offset = 0;
        ctx.session.category = undefined;
      }
      const storeLabel = ctx.session?.storeContextName ? ` from ${ctx.session.storeContextName}` : '';
      await ctx.editMessageText(`Select a category to browse${storeLabel}:`, {
        reply_markup: {
          inline_keyboard: [
            ...CATEGORIES.map((c) => [{ text: c, callback_data: `category:${c}` }]),
            [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
          ],
        },
      }).catch(() => {});
    } catch (err) {
      console.error('[handler browse]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action(/category:(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const category = ctx.match[1];
      if (!ctx.session) ctx.session = {} as BotContext['session'];
      ctx.session.category = category;
      ctx.session.offset = 0;
      ctx.session.filters = { category, size: null, gender: null, type: null, budget: null };

      if (category === 'Clothing') {
        ctx.session.filterStep = 'clothing_size';
        await askClothingSize(ctx);
      } else if (category === 'Footwear') {
        ctx.session.filterStep = 'footwear_size';
        await askFootwearSize(ctx);
      } else if (category === 'Pharmacy') {
        ctx.session.pharmacyCart = ctx.session.pharmacyCart ?? [];
        await ctx.editMessageText('🏥 *Pharmacy*\n\nHow would you like to order?', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Upload Prescription', callback_data: 'pharma_prescription' }],
              [{ text: '💊 Type Medicine Name', callback_data: 'pharma_type' }],
              [{ text: '⬅ Back to Categories', callback_data: 'browse' }],
            ],
          },
        }).catch(() => {});
      } else {
        ctx.session.filterStep = 'budget';
        await askBudget(ctx);
      }
    } catch (err) {
      console.error('[handler category:*]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action(/filter:(size|gender|type|budget):(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      if (!ctx.session?.filters) return sendMainMenu(ctx, true);

      const filterType = ctx.match[1];
      const filterValue = ctx.match[2];
      const filters = ctx.session.filters;

      if (filterType === 'size') {
        filters.size = filterValue === 'any' ? null : filterValue;
        if (filters.category === 'Clothing') {
          ctx.session.filterStep = 'clothing_gender';
          await askGender(ctx);
        } else if (filters.category === 'Footwear') {
          ctx.session.filterStep = 'footwear_type';
          await askType(ctx);
        }
      } else if (filterType === 'gender' || filterType === 'type') {
        if (filterType === 'gender') filters.gender = filterValue === 'any' ? null : filterValue;
        if (filterType === 'type') filters.type = filterValue === 'any' ? null : filterValue;
        ctx.session.filterStep = 'budget';
        await askBudget(ctx);
      } else if (filterType === 'budget') {
        filters.budget = filterValue === 'any' ? null : filterValue;
        ctx.session.filterStep = undefined;
        await ctx.editMessageText(`Searching in ${filters.category}...`).catch(() => {});
        await sendProducts(ctx, supabase, filters.category || '', 0);
      }
    } catch (err) {
      console.error('[handler filter:*]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('load_more', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const category = ctx.session?.category;
      if (!category) {
        await ctx.answerCbQuery('Session expired. Please restart.', { show_alert: true });
        return sendMainMenu(ctx, false);
      }
      const currentOffset = ctx.session?.offset || 0;
      ctx.session!.offset = currentOffset + 5;
      await ctx.deleteMessage().catch(() => {});
      await sendProducts(ctx, supabase, category, ctx.session!.offset);
    } catch (err) {
      console.error('[handler load_more]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });
}
