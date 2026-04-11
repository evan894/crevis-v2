import bot from '@/bot';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (
      process.env.ADMIN_SECRET_TOKEN &&
      token !== process.env.ADMIN_SECRET_TOKEN
    ) {
      return new Response('unauthorized', { status: 401 });
    }
    const body = await req.json();
    await bot.handleUpdate(body);
  } catch (err) {
    console.error('[Telegram webhook error]', err);
    // Always return 200 — never let Telegram retry loop
  }
  return new Response('ok', { status: 200 });
}
