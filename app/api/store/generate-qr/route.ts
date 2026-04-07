import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateStoreQR, regenerateStoreQR } from '@/lib/qr';
import type { Database } from '@/types/database.types';

function buildServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    }
  );
}

export async function POST() {
  try {
    const supabase = buildServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: seller } = await supabaseAdmin
      .from('sellers')
      .select('id, shop_slug, shop_name, qr_code_url')
      .eq('user_id', user.id)
      .single();

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    if (!seller.shop_slug) return NextResponse.json({ error: 'Shop slug not set' }, { status: 400 });

    // Return cached URL if already exists
    if (seller.qr_code_url) {
      return NextResponse.json({ qrUrl: seller.qr_code_url });
    }

    const qrUrl = await generateStoreQR(seller.shop_slug);
    return NextResponse.json({ qrUrl });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'QR generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = buildServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: seller } = await supabaseAdmin
      .from('sellers')
      .select('id, shop_slug, shop_name')
      .eq('user_id', user.id)
      .single();

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    if (!seller.shop_slug) return NextResponse.json({ error: 'Shop slug not set' }, { status: 400 });

    const qrUrl = await regenerateStoreQR(seller.shop_slug);
    return NextResponse.json({ qrUrl });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'QR regeneration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
