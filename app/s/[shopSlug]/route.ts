import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  request: Request,
  { params }: { params: { shopSlug: string } }
) {
  const { shopSlug } = params;

  const { data: seller } = await supabaseAdmin
    .from('sellers')
    .select('id, shop_name, shop_slug')
    .eq('shop_slug', shopSlug)
    .single();

  if (!seller) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

  // Deep link into the bot — bot handles store_* start payload
  const telegramDeepLink = `https://t.me/Crevis_shop_bot?start=store_${shopSlug}`;

  return NextResponse.redirect(telegramDeepLink, { status: 302 });
}
