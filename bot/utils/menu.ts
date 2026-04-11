import type { BotContext } from '../index';

export async function sendMainMenu(ctx: BotContext, edit = false) {
  const storeLabel = ctx.session?.storeContextName
    ? `\n\nYou're browsing ${ctx.session.storeContextName}'s collection.`
    : '';
  const text = `Welcome to Crevis, ${ctx.from?.first_name || 'Buyer'}! 🛍️${storeLabel}\n\nWhat would you like to do?`;
  const markup = {
    inline_keyboard: [
      [{ text: '🛍 Browse Products', callback_data: 'browse' }],
      [{ text: '🔍 Search', callback_data: 'search' }],
      [{ text: '📦 My Orders', callback_data: 'orders' }],
    ],
  };

  if (edit) {
    await ctx.editMessageText(text, { reply_markup: markup }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: markup });
  }
}
