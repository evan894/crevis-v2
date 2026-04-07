import { Telegraf, session, Context } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// For typing
import type { Database } from '../types/database.types';
import { buildProductQuery } from './utils/queries';

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
  searchState?: string;
  storeContext?: string | null;
  storeContextName?: string | null;
}

export interface BotContext extends Context {
  session: SessionData;
}

const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN);

bot.use(session());

import { CATEGORIES } from '../lib/constants';

// Global Error Handler
bot.catch((err, ctx) => {
  console.error(`[Error] processing update ${ctx.updateType}:`, err);
  ctx.reply('An unexpected error occurred. Please try again later.').catch(console.error);
});

// Helper to provide main menu cleanly
const sendMainMenu = async (ctx: BotContext, edit = false) => {
  const storeLabel = ctx.session?.storeContextName ? `\n\nYou're browsing ${ctx.session.storeContextName}'s collection.` : '';
  const text = `Welcome to Crevis, ${ctx.from?.first_name || 'Buyer'}! 🛍️${storeLabel}\n\nWhat would you like to do?`;
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

    if (ctx.session) ctx.session = { category: undefined, offset: undefined, searchState: undefined, storeContext: undefined, storeContextName: undefined }; 
    else (ctx.session as SessionData) = { category: undefined, offset: undefined, searchState: undefined, storeContext: undefined, storeContextName: undefined };

    const payload = ctx.startPayload;
    if (payload) {
      if (payload.startsWith('product_')) {
        const productId = payload.replace('product_', '');

        const { data: product } = await supabase
          .from('products')
          .select('*, sellers(shop_name, id)')
          .eq('id', productId)
          .eq('active', true)
          .single();

        if (!product) {
          await ctx.reply(
            "Sorry, this product is no longer available.\n\nBrowse all products with /start",
            {
              reply_markup: { inline_keyboard: [[{ text: '🛍 Browse All Products', callback_data: 'browse' }]] }
            }
          );
          return;
        }

        const sData = Array.isArray(product.sellers) ? product.sellers[0] : product.sellers;
        const shopName = sData?.shop_name || 'Crevis Store';
        
        ctx.session.storeContext = product.seller_id;
        ctx.session.storeContextName = shopName;

        const caption = `*${product.name}*\n₹${product.price.toLocaleString('en-IN')}\n\n${product.description || ''}\n\nFrom *${shopName}*${product.boosted ? ' 🚀' : ''}`;

        await ctx.replyWithPhoto(product.photo_url, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: `💳 Buy Now — ₹${product.price.toLocaleString('en-IN')}`, callback_data: `buy:${product.id}` }],
              [{ text: '🛍 Browse More', callback_data: 'browse' }]
            ]
          }
        });
        return;
      }

      if (payload.startsWith('store_')) {
        const shopSlug = payload.replace('store_', '');

        const { data: seller } = await supabase
          .from('sellers')
          .select('id, shop_name')
          .eq('shop_slug', shopSlug)
          .single();

        if (seller) {
          ctx.session.storeContext = seller.id;
          ctx.session.storeContextName = seller.shop_name;

          await ctx.reply(
            `👋 Welcome to ${seller.shop_name} on Crevis!\n` +
            `You're browsing ${seller.shop_name}'s collection.\n\n` +
            `What would you like to do?`,
            { 
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🛍 Browse Products', callback_data: 'browse' }],
                  [{ text: '🔍 Search', callback_data: 'search' }],
                  [{ text: '📦 My Orders', callback_data: 'orders' }]
                ]
              }
            }
          );
          return;
        }
      }
    }

    ctx.session.storeContext = null;
    ctx.session.storeContextName = null;
    await sendMainMenu(ctx, false);
  } catch (error) {
    console.error("Start command error:", error);
    await ctx.reply("Failed to initialize your account. Please try again.");
  }
});


bot.action('main_menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const isMessageText = ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message;
    await sendMainMenu(ctx, isMessageText);
  } catch (err) {
    console.error('[handler main_menu]', err);
    await ctx.reply('Something went wrong. Please try /start again.');
  }
});

bot.action('browse', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (ctx.session) {
       ctx.session.offset = 0;
       ctx.session.category = undefined;
    }
    
    const storeLabel = ctx.session?.storeContextName 
      ? ` from ${ctx.session.storeContextName}` 
      : '';

    await ctx.editMessageText(`Select a category to browse${storeLabel}:`, {
      reply_markup: {
        inline_keyboard: [
          ...CATEGORIES.map(c => [{ text: c, callback_data: `category:${c}` }]),
          [{ text: '⬅ Main Menu', callback_data: 'main_menu' }]
        ]
      }
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
    if (!ctx.session) (ctx.session as SessionData) = { category: undefined, offset: undefined, searchState: undefined };
    ctx.session.category = category;
    ctx.session.offset = 0;
    
    await sendProducts(ctx, category, 0);
  } catch (err) {
    console.error('[handler category:*]', err);
    await ctx.reply('Something went wrong. Please try /start again.');
  }
});

bot.action('load_more', async (ctx) => {
  try {
    await ctx.answerCbQuery();
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
  } catch (err) {
    console.error('[handler load_more]', err);
    await ctx.reply('Something went wrong. Please try /start again.');
  }
});

bot.action('orders', async (ctx) => {
  try {
    await ctx.answerCbQuery();
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
  } catch (err) {
    console.error('[handler orders]', err);
    await ctx.reply('Something went wrong. Please try /start again.');
  }
});

bot.action('search', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    ctx.session.category = undefined;
    ctx.session.searchState = "AWAITING_QUERY";
    
    const storeLabel = ctx.session?.storeContextName 
      ? `Search ${ctx.session.storeContextName}'s collection:` 
      : 'What are you looking for?';

    await ctx.editMessageText(storeLabel, {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅ Cancel', callback_data: 'main_menu' }]]
      }
    }).catch(() => {});
  } catch (err) {
    console.error('[handler search]', err);
    await ctx.reply('Something went wrong. Please try /start again.');
  }
});

// Text handler for search state
bot.on('text', async (ctx) => {
   if (ctx.session?.searchState === "AWAITING_QUERY") {
      ctx.session.searchState = undefined;
      const query = ctx.message.text.trim();
      
      const sentMsg = await ctx.reply("🔍 Searching...");

      try {
         // Fetch all active products for the AI / fallback
         let activeProductsQuery = supabase
            .from('products')
            .select('id, name, description, category, price')
            .eq('active', true);

         if (ctx.session?.storeContext) {
            activeProductsQuery = activeProductsQuery.eq('seller_id', ctx.session.storeContext);
         }

         const { data: allActiveProducts } = await activeProductsQuery;

         if (!allActiveProducts || allActiveProducts.length === 0) {
            await ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, undefined, "Couldn't find that. Try browsing by category.", {
               reply_markup: {
                 inline_keyboard: [[{ text: '🛍 Browse Products', callback_data: 'browse' }]]
               }
            });
            return;
         }

         let matchedIds: string[] = [];

         try {
             // Use dynamic import so it works even if not compiled
             const { searchProductsWithGemini } = await import('../lib/gemini');
             const productsJson = JSON.stringify(allActiveProducts);
             matchedIds = await searchProductsWithGemini(query, productsJson);
         } catch (aiError) {
             console.error("Falling back to text search...", aiError);
             // Fallback text match
             const loweredQuery = query.toLowerCase();
             matchedIds = allActiveProducts.filter(p => 
                p.name.toLowerCase().includes(loweredQuery) || 
                (p.description && p.description.toLowerCase().includes(loweredQuery))
             ).map(p => p.id).slice(0, 3);
         }

         if (matchedIds.length === 0) {
            await ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, undefined, "Couldn't find that. Try browsing by category.", {
               reply_markup: {
                 inline_keyboard: [[{ text: '🛍 Browse Products', callback_data: 'browse' }]]
               }
            });
            return;
         }

         // Fetch full product details
         const { data: matchedProducts } = await buildProductQuery(supabase, ctx.session?.storeContext || null)
            .in('id', matchedIds);
         
         await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(()=>{});

         if (!matchedProducts || matchedProducts.length === 0) {
            await ctx.reply("Couldn't find that. Try browsing by category.", {
               reply_markup: {
                 inline_keyboard: [[{ text: '🛍 Browse Products', callback_data: 'browse' }]]
               }
            });
            return;
         }

         // Send the cards
         for (const p of matchedProducts) {
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
         
         // Final generic back button
         await ctx.reply("Search completed.", {
            reply_markup: {
               inline_keyboard: [[{ text: '⬅ Main Menu', callback_data: 'main_menu' }]]
            }
         });

      } catch (e) {
         console.error("Search flow failed", e);
         await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(()=>{});
         await ctx.reply('An error occurred during search. Please try again.');
      }
      return;
   }
});
const proceedToPayment = async (ctx: any, productId: string, buyerTelegramId: string, variant: string | null) => {
       const sentMsg = await ctx.reply("Creating secure payment link... ⏳");

       try {
           const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
           const res = await fetch(`${appUrl}/api/payment/create-link`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                   productId,
                   buyerTelegramId,
                   variant
               })
           });

           const data = await res.json();
           if (!res.ok) {
               throw new Error(data.error || "Failed to create payment link");
           }

           await ctx.telegram.editMessageText(ctx.chat?.id as number, sentMsg.message_id, undefined, "Tap below to pay securely 👇", {
               reply_markup: {
                   inline_keyboard: [[{ text: '💳 Pay Now', url: data.short_url }]]
               }
           });

       } catch (error) {
           console.error("Buy flow error:", error);
           await ctx.telegram.editMessageText(
              ctx.chat?.id, 
              sentMsg.message_id, 
              undefined, 
              "❌ Payment link creation failed. Please try again later."
           );
       }
};

bot.action(/buy:(.+)/, async (ctx) => {
   try {
       await ctx.answerCbQuery();
       const productId = ctx.match[1];
       const user = ctx.from;
       if (!user) return;

       const { data: product, error } = await supabase.from('products').select('has_variants, variants').eq('id', productId).single();

       if (product && product.has_variants && product.variants) {
           const options = (product.variants as any).options || [];
           const buttons = [];
           for (let i = 0; i < options.length; i += 2) {
               const row = [];
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

           await ctx.reply("Select your size:", {
               reply_markup: {
                   inline_keyboard: buttons
               }
           });
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
    await ctx.answerCbQuery("This option is currently out of stock", { show_alert: true }).catch(() => {});
});


async function sendProducts(ctx: BotContext, category: string, offset: number) {
  const { data: products, error } = await buildProductQuery(supabase, ctx.session?.storeContext || null)
    .eq('category', category)
    .range(offset, offset + 4);

  if (error) {
    console.error(error);
    await ctx.reply("Error fetching products.");
    return;
  }

  let countQuery = supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category', category)
    .eq('active', true);
  
  if (ctx.session?.storeContext) {
    countQuery = countQuery.eq('seller_id', ctx.session.storeContext);
  }

  const { count } = await countQuery;
  
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
