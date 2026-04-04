import { Telegraf, session, Context } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// For typing
import type { Database } from '../types/database.types';

// Load variables from .env.local for local development
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be provided");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

interface SessionData {
  category?: string;
  offset?: number;
}

export interface BotContext extends Context {
  session: SessionData;
}

const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN);

bot.use(session());

const CATEGORIES = ["Clothing", "Footwear", "Accessories", "Home Textiles", "Other"];

// Global Error Handler
bot.catch((err, ctx) => {
  console.error(`[Error] processing update ${ctx.updateType}:`, err);
  ctx.reply('An unexpected error occurred. Please try again later.').catch(console.error);
});

// Helper to provide main menu cleanly
const sendMainMenu = async (ctx: BotContext, edit = false) => {
  const text = `Welcome to Crevis, ${ctx.from?.first_name || 'Buyer'}! 🛍️\n\nWhat would you like to do?`;
  const markup = {
    inline_keyboard: [
      [{ text: '🛍 Browse Products', callback_data: 'browse' }],
      [{ text: '🔍 Search', callback_data: 'search' }],
      [{ text: '📦 My Orders', callback_data: 'orders' }]
    ]
  };

  if (edit) {
    await ctx.editMessageText(text, { reply_markup: markup }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: markup });
  }
};

bot.start(async (ctx) => {
  const user = ctx.message.from;
  try {
    const { data: existingBuyer } = await supabase
      .from('buyers')
      .select('id')
      .eq('telegram_id', user.id.toString())
      .single();

    if (!existingBuyer) {
      await supabase.from('buyers').insert({
        telegram_id: user.id.toString(),
        first_name: user.first_name || null,
        username: user.username || null,
      });
    }

    if (ctx.session) ctx.session = {}; 
    else (ctx.session as any) = {};

    await sendMainMenu(ctx, false);
  } catch (error) {
    console.error("Start command error:", error);
    await ctx.reply("Failed to initialize your account. Please try again.");
  }
});

bot.action('main_menu', async (ctx) => {
  const isMessageText = ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message;
  await sendMainMenu(ctx, isMessageText);
});

bot.action('browse', async (ctx) => {
  if (ctx.session) {
     ctx.session.offset = 0;
     ctx.session.category = undefined;
  }
  
  await ctx.editMessageText('Select a category to browse:', {
    reply_markup: {
      inline_keyboard: [
        ...CATEGORIES.map(c => [{ text: c, callback_data: `category:${c}` }]),
        [{ text: '⬅ Main Menu', callback_data: 'main_menu' }]
      ]
    }
  }).catch(() => {});
});

bot.action(/category:(.+)/, async (ctx) => {
  const category = ctx.match[1];
  if (!ctx.session) (ctx.session as any) = {};
  ctx.session.category = category;
  ctx.session.offset = 0;
  
  await sendProducts(ctx, category, 0);
});

bot.action('load_more', async (ctx) => {
  const category = ctx.session?.category;
  if (!category) {
    await ctx.answerCbQuery("Session expired. Please restart.", { show_alert: true });
    return sendMainMenu(ctx, false);
  }
  
  const currentOffset = ctx.session?.offset || 0;
  ctx.session!.offset = currentOffset + 5;
  
  // Clean up the previous 'Load more' message
  await ctx.deleteMessage().catch(()=>{});
  await sendProducts(ctx, category, ctx.session!.offset);
});

bot.action('orders', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const { data: myOrders } = await supabase
      .from('orders')
      .select('amount, status, created_at, products(name)')
      .eq('buyer_telegram_id', user.id.toString())
      .order('created_at', { ascending: false })
      .limit(10);

  if (!myOrders || myOrders.length === 0) {
     await ctx.editMessageText("You have no orders yet.", {
         reply_markup: {
            inline_keyboard: [[{ text: '⬅ Main Menu', callback_data: 'main_menu' }]]
         }
     }).catch(() => {});
     return;
  }

  let text = "📦 *Your Recent Orders*\n\n";
  for (const o of myOrders) {
     const pData = Array.isArray(o.products) ? o.products[0] : o.products;
     const pName = pData?.name || "Unknown Item";
     const date = new Date(o.created_at).toLocaleDateString();
     text += `• ${pName} - ₹${o.amount} [${o.status.toUpperCase()}] on ${date}\n`;
  }

  await ctx.editMessageText(text, {
     parse_mode: 'Markdown',
     reply_markup: {
        inline_keyboard: [
           [{ text: '⬅ Main Menu', callback_data: 'main_menu' }]
        ]
     }
  }).catch(() => {});
});

// Dummy search for now
bot.action('search', async (ctx) => {
  await ctx.answerCbQuery("Search is coming soon!", { show_alert: true });
});

async function sendProducts(ctx: BotContext, category: string, offset: number) {
  const { data: products, error } = await supabase
    .from('products')
    .select('*, sellers(shop_name)')
    .eq('category', category)
    .eq('active', true)
    .order('boosted', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + 4);

  if (error) {
    console.error(error);
    await ctx.reply("Error fetching products.");
    return;
  }

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category', category)
    .eq('active', true);
  
  if (!products || products.length === 0) {
     if (offset === 0) {
        if (ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message) {
           await ctx.editMessageText(`No products available in ${category} yet. Try another category.`, {
              reply_markup: {
                inline_keyboard: [[{ text: '⬅ Back to Categories', callback_data: 'browse' }]]
              }
           }).catch(() => {});
        } else {
           await ctx.reply(`No products available in ${category} yet. Try another category.`, {
              reply_markup: {
                inline_keyboard: [[{ text: '⬅ Back to Categories', callback_data: 'browse' }]]
              }
           });
        }
     } else {
        await ctx.reply("No more products.", {
           reply_markup: {
             inline_keyboard: [[{ text: '⬅ Back to Categories', callback_data: 'browse' }]]
           }
        });
     }
     return;
  }

  if (ctx.callbackQuery && offset === 0) {
    if (ctx.callbackQuery.message) {
      await ctx.deleteMessage().catch(() => {});
    }
  }

  for (const p of products) {
    const sData = Array.isArray(p.sellers) ? p.sellers[0] : p.sellers;
    const shopName = sData?.shop_name || 'Unknown Shop';
    const caption = `**${p.name}**\nPrice: ₹${p.price}\nShop: ${shopName}${p.boosted ? ' 🚀 *BOOSTED*' : ''}\n\n${p.description || ''}`;

    await ctx.replyWithPhoto(p.photo_url, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `Buy Now ₹${p.price}`, callback_data: `buy:${p.id}` }]
        ]
      }
    });
  }

  const total = count || 0;
  const hasMore = (offset + 5) < total;

  const navButtons = [];
  if (hasMore) {
    navButtons.push([{ text: 'Load More ⬇️', callback_data: `load_more` }]);
  }
  navButtons.push([{ text: '⬅ Back to Categories', callback_data: 'browse' }]);

  await ctx.reply(`Showing ${Math.min(offset + 5, total)} of ${total} in ${category}`, {
    reply_markup: {
      inline_keyboard: navButtons
    }
  });
}

if (process.env.NODE_ENV !== 'production' || process.env.RUN_BOT_LOCAL === 'true') {
  bot.launch()
    .then(() => console.log('✅ Bot started securely in polling mode!'))
    .catch(console.error);
} else {
  console.log('✅ Bot initialized for webhook mode (production).');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
