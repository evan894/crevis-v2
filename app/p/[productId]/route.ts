import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const { productId } = params;

  // Validate looks like a UUID before hitting DB
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(productId)) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, name, active')
    .eq('id', productId)
    .eq('active', true)
    .single();

  if (!product) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

  // Deep link into Telegram bot — bot handles product_* start payload
  const telegramDeepLink = `https://t.me/Crevis_shop_bot?start=product_${productId}`;

  return NextResponse.redirect(telegramDeepLink, { status: 302 });
}
