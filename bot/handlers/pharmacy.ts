import type { Telegraf } from 'telegraf';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import type { BotContext } from '../index';
import { searchProductsWithGemini } from '../../lib/gemini';

type CartItem = { productId: string; name: string; price: number; shopName: string };

function formatCart(cart: CartItem[]): string {
  const lines = cart.map((item, i) => `${i + 1}. ${item.name} — ₹${item.price} (${item.shopName})`);
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  return lines.join('\n') + `\n\nTotal: ₹${total}`;
}

async function showCartSummary(ctx: BotContext) {
  const cart = ctx.session.pharmacyCart ?? [];
  if (cart.length === 0) {
    await ctx.reply('Your cart is empty.', {
      reply_markup: {
        inline_keyboard: [[{ text: '💊 Add a Medicine', callback_data: 'pharma_add_more' }]],
      },
    });
    return;
  }
  await ctx.reply(`🛒 *Your Cart*\n\n${formatCart(cart)}`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Confirm Order', callback_data: 'pharma_confirm' }],
        [{ text: '💊 Add Another Medicine', callback_data: 'pharma_add_more' }],
        [{ text: '🗑 Clear Cart', callback_data: 'pharma_clear' }],
      ],
    },
  });
}

async function proceedToCartPayment(ctx: BotContext) {
  const cart = ctx.session.pharmacyCart ?? [];
  const sentMsg = await ctx.reply('Creating secure payment link... ⏳');
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${appUrl}/api/payment/create-pharmacy-cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartItems: cart,
        buyerTelegramId: ctx.from!.id.toString(),
        buyerPhone: ctx.session.buyerPhone ?? '',
        prescriptionFileId: ctx.session.pharmacyPrescriptionFileId ?? null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create payment link');

    await ctx.telegram.editMessageText(
      ctx.chat!.id as number,
      sentMsg.message_id,
      undefined,
      `🛒 *Order Summary*\n\n${formatCart(cart)}\n\nTap below to pay securely 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '💳 Pay Now', url: data.short_url }]] },
      }
    );
  } catch (err) {
    console.error('[proceedToCartPayment]', err);
    await ctx.telegram.editMessageText(
      ctx.chat!.id as number,
      sentMsg.message_id,
      undefined,
      '❌ Payment link creation failed. Please try again later.'
    );
  }
}

export function registerPharmacyHandlers(
  bot: Telegraf<BotContext>,
  supabase: SupabaseClient<Database>
) {
  // Re-entry point for cancel buttons within pharmacy flow
  bot.action('pharmacy_entry', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      if (!ctx.session) ctx.session = {} as BotContext['session'];
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
    } catch (err) {
      console.error('[pharmacy_entry]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('pharma_prescription', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      ctx.session.pharmacyState = 'AWAITING_PRESCRIPTION';
      await ctx.editMessageText('📋 Please upload a photo of your prescription.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅ Back', callback_data: 'pharmacy_entry' }]],
        },
      }).catch(() => {});
    } catch (err) {
      console.error('[pharma_prescription]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('pharma_type', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      ctx.session.pharmacyState = 'AWAITING_MEDICINE_NAME';
      await ctx.editMessageText('💊 Type the name of the medicine:', {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅ Back', callback_data: 'pharmacy_entry' }]],
        },
      }).catch(() => {});
    } catch (err) {
      console.error('[pharma_type]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('pharma_add_more', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      ctx.session.pharmacyState = 'AWAITING_MEDICINE_NAME';
      const cart = ctx.session.pharmacyCart ?? [];
      await ctx.reply('💊 Type the name of the next medicine:', {
        reply_markup: {
          inline_keyboard: [
            ...(cart.length > 0
              ? [[{ text: `🛒 View Cart (${cart.length})`, callback_data: 'pharma_view_cart' }]]
              : []),
            [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
          ],
        },
      });
    } catch (err) {
      console.error('[pharma_add_more]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('pharma_view_cart', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showCartSummary(ctx);
    } catch (err) {
      console.error('[pharma_view_cart]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action('pharma_clear', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      ctx.session.pharmacyCart = [];
      await ctx.editMessageText('🗑 Cart cleared.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💊 Start Shopping', callback_data: 'pharmacy_entry' }],
            [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
          ],
        },
      }).catch(() => {});
    } catch (err) {
      console.error('[pharma_clear]', err);
      await ctx.reply('Something went wrong. Please try /start again.');
    }
  });

  bot.action(/^pharma_add:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const productId = ctx.match[1];
      const cart = ctx.session.pharmacyCart ?? [];

      const { data: product } = await supabase
        .from('products')
        .select('id, name, price, sellers(shop_name)')
        .eq('id', productId)
        .eq('active', true)
        .single();

      if (!product) {
        await ctx.reply('This product is no longer available.');
        return;
      }

      const sData = Array.isArray(product.sellers) ? product.sellers[0] : product.sellers;
      const shopName = (sData as { shop_name?: string } | null)?.shop_name ?? 'Unknown Shop';

      cart.push({ productId: product.id, name: product.name, price: Number(product.price), shopName });
      ctx.session.pharmacyCart = cart;

      await ctx.reply(
        `✅ *${product.name}* added to cart!\n\n${cart.length} item${cart.length > 1 ? 's' : ''} in your cart.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💊 Add Another Medicine', callback_data: 'pharma_add_more' }],
              [{ text: `🛒 View Cart (${cart.length})`, callback_data: 'pharma_view_cart' }],
            ],
          },
        }
      );
    } catch (err) {
      console.error('[pharma_add:*]', err);
      await ctx.reply('Something went wrong. Please try again.');
    }
  });

  bot.action('pharma_confirm', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const cart = ctx.session.pharmacyCart ?? [];
      if (cart.length === 0) {
        await ctx.reply('Your cart is empty. Add medicines first.');
        return;
      }
      if (!ctx.session.buyerPhone) {
        ctx.session.pharmacyState = 'AWAITING_PHONE';
        await ctx.editMessageText(
          '📞 Please type your phone number so our pharmacist can call to confirm your order:',
          {
            reply_markup: {
              inline_keyboard: [[{ text: '⬅ Back to Cart', callback_data: 'pharma_view_cart' }]],
            },
          }
        ).catch(() => {});
        return;
      }
      await proceedToCartPayment(ctx);
    } catch (err) {
      console.error('[pharma_confirm]', err);
      await ctx.reply('Something went wrong. Please try again.');
    }
  });

  // Prescription photo
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.pharmacyState !== 'AWAITING_PRESCRIPTION') return next();
    ctx.session.pharmacyState = 'AWAITING_MEDICINE_NAME';
    const photos = ctx.message.photo;
    ctx.session.pharmacyPrescriptionFileId = photos[photos.length - 1].file_id;
    await ctx.reply('📋 Prescription received!\n\n💊 Now type the name of the medicine you need:');
  });

  // Text: medicine name or phone number
  bot.on('text', async (ctx, next) => {
    const state = ctx.session?.pharmacyState;
    if (state !== 'AWAITING_MEDICINE_NAME' && state !== 'AWAITING_PHONE') return next();

    if (state === 'AWAITING_PHONE') {
      ctx.session.pharmacyState = undefined;
      ctx.session.buyerPhone = ctx.message.text.trim();
      await ctx.reply('Got it! Processing your order...');
      await proceedToCartPayment(ctx);
      return;
    }

    // AWAITING_MEDICINE_NAME
    ctx.session.pharmacyState = undefined;
    const query = ctx.message.text.trim();
    const sentMsg = await ctx.reply('🔍 Searching...');

    try {
      // Step 1: Exact name match within Pharmacy category
      const { data: exactMatches } = await supabase
        .from('products')
        .select('id, name, price, description, photo_url, boosted, sellers(shop_name)')
        .eq('category', 'Pharmacy')
        .eq('active', true)
        .ilike('name', `%${query}%`);

      if (exactMatches && exactMatches.length > 0) {
        await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(() => {});
        for (const p of exactMatches) {
          const sData = Array.isArray(p.sellers) ? p.sellers[0] : p.sellers;
          const shopName = (sData as { shop_name?: string } | null)?.shop_name ?? 'Unknown Shop';
          const caption = `*${p.name}*\nPrice: ₹${p.price}\nShop: ${shopName}${p.boosted ? ' 🚀' : ''}\n\n${p.description || ''}`;
          await ctx.replyWithPhoto(p.photo_url, {
            caption,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `🛒 Add to Cart — ₹${p.price}`, callback_data: `pharma_add:${p.id}` }],
              ],
            },
          });
        }
        const cart = ctx.session.pharmacyCart ?? [];
        await ctx.reply('Add to cart or search for more:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💊 Search Another Medicine', callback_data: 'pharma_add_more' }],
              ...(cart.length > 0
                ? [[{ text: `🛒 View Cart (${cart.length})`, callback_data: 'pharma_view_cart' }]]
                : []),
              [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
            ],
          },
        });
        return;
      }

      // Step 2: Fuzzy search via Gemini on Pharmacy products only
      const { data: allPharmacy } = await supabase
        .from('products')
        .select('id, name, description, price')
        .eq('category', 'Pharmacy')
        .eq('active', true);

      let fuzzyId: string | null = null;
      if (allPharmacy && allPharmacy.length > 0) {
        try {
          const ids = await searchProductsWithGemini(query, JSON.stringify(allPharmacy));
          fuzzyId = ids[0] ?? null;
        } catch {
          // Text fallback: partial prefix match
          const lq = query.toLowerCase();
          const matched = allPharmacy.find((p) => {
            const pn = p.name.toLowerCase();
            return pn.includes(lq.slice(0, 4)) || lq.includes(pn.slice(0, 4));
          });
          fuzzyId = matched?.id ?? null;
        }
      }

      if (fuzzyId) {
        const { data: fuzzyProduct } = await supabase
          .from('products')
          .select('id, name, price, sellers(shop_name)')
          .eq('id', fuzzyId)
          .eq('active', true)
          .single();

        if (fuzzyProduct) {
          const sData = Array.isArray(fuzzyProduct.sellers) ? fuzzyProduct.sellers[0] : fuzzyProduct.sellers;
          const shopName = (sData as { shop_name?: string } | null)?.shop_name ?? 'Unknown Shop';
          const suggestionText =
            `❌ "${query}" not found.\n\n` +
            `Would you like to purchase "${fuzzyProduct.name}" — ₹${fuzzyProduct.price} (${shopName}) instead?\n\n` +
            `⚠️ This AI-powered search looks up the nearest matching products and is not responsible for picking the correct alternative to the medicine you typed. Please verify with your pharmacist.`;

          await ctx.telegram
            .editMessageText(ctx.chat.id, sentMsg.message_id, undefined, suggestionText, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: `✅ Yes, add to cart`, callback_data: `pharma_add:${fuzzyProduct.id}` }],
                  [{ text: '🔍 Search Again', callback_data: 'pharma_add_more' }],
                  [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
                ],
              },
            })
            .catch(async () => {
              await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(() => {});
              await ctx.reply(suggestionText, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: `✅ Yes, add to cart`, callback_data: `pharma_add:${fuzzyProduct.id}` }],
                    [{ text: '🔍 Search Again', callback_data: 'pharma_add_more' }],
                    [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
                  ],
                },
              });
            });
          return;
        }
      }

      // Nothing found
      await ctx.telegram
        .editMessageText(
          ctx.chat.id,
          sentMsg.message_id,
          undefined,
          `❌ "${query}" not found in our pharmacy.\n\nTry a different name or spelling.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Search Again', callback_data: 'pharma_add_more' }],
                [{ text: '⬅ Main Menu', callback_data: 'main_menu' }],
              ],
            },
          }
        )
        .catch(() => {});
    } catch (err) {
      console.error('[pharma text handler]', err);
      await ctx.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(() => {});
      await ctx.reply('An error occurred. Please try again.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅ Main Menu', callback_data: 'main_menu' }]],
        },
      });
    }
  });
}
