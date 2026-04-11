import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { sendSlackDM } from '@/lib/slack';
import { SLACK_MESSAGES } from '@/lib/constants';

// Sales agent or manage_products permission
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { stock } = body;

    if (typeof stock !== 'number' || stock < 0) {
      return NextResponse.json({ error: "Invalid stock value" }, { status: 400 });
    }

    const { getCookies, setCookies, removeCookies } = createCookieHandlers();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: getCookies,
          set: setCookies,
          remove: removeCookies,
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: member } = await supabase
      .from('store_members')
      .select('role, custom_roles(permissions)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    let hasAccess = false;
    if (member.role === 'owner' || member.role === 'manager' || member.role === 'sales_agent') {
      hasAccess = true;
    } else if (member.role === 'custom') {
      const cr = member.custom_roles as any;
      if (cr?.permissions?.includes('manage_products')) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden: lack store permissions" }, { status: 403 });
    }

    // Update stock
    const payload: any = { stock };
    if (stock === 0) {
      payload.active = false;
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('name, seller_id')
      .single();

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Send slack alert if stock hit 0
    if (stock === 0 && updatedProduct) {
      // Get seller details
      const { data: seller } = await supabase.from('sellers').select('slack_access_token, slack_user_id').eq('id', updatedProduct.seller_id).single();
      
      if (seller?.slack_access_token && seller?.slack_user_id) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `⚠️ Item out of stock: ${updatedProduct.name}. It has been unlisted.`
        ).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, stock });
  } catch (err) {
    console.error("Stock API Error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// Helper to make client cookies easier
import { cookies } from 'next/headers';
function createCookieHandlers() {
  const cookieStore = cookies();
  return {
    getCookies: (name: string) => cookieStore.get(name)?.value,
    setCookies: (name: string, value: string, options: CookieOptions) => {
      cookieStore.set(name, value, options);
    },
    removeCookies: (name: string, options: CookieOptions) => {
      cookieStore.set(name, '', { ...options, maxAge: 0 });
    }
  };
}
