import type { BotContext } from '../index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InlineButton = { text: string; callback_data: string };

export async function renderFilterQuestion(
  ctx: BotContext,
  text: string,
  buttons: InlineButton[][]
) {
  const allButtons = [...buttons, [{ text: '⬅ Cancel', callback_data: 'main_menu' }]];
  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, { reply_markup: { inline_keyboard: allButtons } }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: { inline_keyboard: allButtons } });
  }
}

export async function askClothingSize(ctx: BotContext) {
  return renderFilterQuestion(ctx, 'What size are you looking for?', [
    [
      { text: 'XS', callback_data: 'filter:size:XS' },
      { text: 'S', callback_data: 'filter:size:S' },
      { text: 'M', callback_data: 'filter:size:M' },
    ],
    [
      { text: 'L', callback_data: 'filter:size:L' },
      { text: 'XL', callback_data: 'filter:size:XL' },
      { text: 'XXL', callback_data: 'filter:size:XXL' },
    ],
    [{ text: 'Any Size / Skip', callback_data: 'filter:size:any' }],
  ]);
}

export async function askFootwearSize(ctx: BotContext) {
  return renderFilterQuestion(ctx, 'What shoe size?', [
    [
      { text: '5', callback_data: 'filter:size:5' },
      { text: '6', callback_data: 'filter:size:6' },
      { text: '7', callback_data: 'filter:size:7' },
    ],
    [
      { text: '8', callback_data: 'filter:size:8' },
      { text: '9', callback_data: 'filter:size:9' },
      { text: '10', callback_data: 'filter:size:10' },
    ],
    [
      { text: '11', callback_data: 'filter:size:11' },
      { text: 'Any Size / Skip', callback_data: 'filter:size:any' },
    ],
  ]);
}

export async function askGender(ctx: BotContext) {
  return renderFilterQuestion(ctx, 'For whom?', [
    [
      { text: 'Men', callback_data: 'filter:gender:Men' },
      { text: 'Women', callback_data: 'filter:gender:Women' },
    ],
    [
      { text: 'Kids', callback_data: 'filter:gender:Kids' },
      { text: 'Unisex', callback_data: 'filter:gender:Unisex' },
    ],
    [{ text: 'Any / Skip', callback_data: 'filter:gender:any' }],
  ]);
}

export async function askType(ctx: BotContext) {
  return renderFilterQuestion(ctx, 'Type?', [
    [
      { text: 'Casual', callback_data: 'filter:type:Casual' },
      { text: 'Formal', callback_data: 'filter:type:Formal' },
    ],
    [
      { text: 'Sports', callback_data: 'filter:type:Sports' },
      { text: 'Any / Skip', callback_data: 'filter:type:any' },
    ],
  ]);
}

export async function askBudget(ctx: BotContext) {
  return renderFilterQuestion(ctx, 'Budget?', [
    [{ text: 'Under ₹500', callback_data: 'filter:budget:under500' }],
    [{ text: '₹500–₹1500', callback_data: 'filter:budget:500to1500' }],
    [{ text: '₹1500+', callback_data: 'filter:budget:above1500' }],
    [{ text: 'Any Budget / Skip', callback_data: 'filter:budget:any' }],
  ]);
}
