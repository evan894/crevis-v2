import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bot from '@/bot';
import { sendSlackDM } from '@/lib/slack';

export async function POST(req: Request) {
  try {
    const { deliveryOrderId } = await req.json();

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {}, remove() {}
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate permission
    const { data: storeMember } = await supabase
      .from('store_members')
      .select('role, custom_roles(permissions)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!storeMember) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPermission = 
      ['owner', 'manager', 'sales_agent'].includes(storeMember.role) ||
      (storeMember.role === 'custom' && (storeMember.custom_roles as unknown as {permissions: string[]})?.permissions?.includes('pack_orders'));

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Mark as packed via Supabase service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: dOrder, error: updateError } = await supabaseAdmin
      .from('delivery_orders')
      .update({ 
        status: 'packed',
        packed_at: new Date().toISOString(),
        otp: otp
      })
      .eq('id', deliveryOrderId)
      .select(`
        id, 
        seller_id,
        orders (
          id,
          buyer_telegram_id,
          buyer_name,
          products (name)
        )
      `)
      .single();

    if (updateError || !dOrder) {
      console.error(updateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    const orderData = dOrder.orders as unknown as {id: string, buyer_telegram_id: string, buyer_name: string, products: {name: string}, seller_id: string};
    const shortId = orderData.id.slice(-6).toUpperCase();

    // 2. Telegram to customer
    if (orderData.buyer_telegram_id) {
      const tgMessage = `📦 *Your order is packed and ready!*\nYour delivery OTP is: \`${otp}\`\nShare this with your delivery agent on arrival.`;
      bot.telegram.sendMessage(orderData.buyer_telegram_id, tgMessage, { parse_mode: 'Markdown' })
        .catch(err => console.error("TF Telegram error:", err));
    }

    // 3. Slack to delivery agents (and seller)
    // Query seller_id from orders since delivery_orders has no seller_id
    const sellerId = orderData.seller_id;
    const { data: seller } = await supabaseAdmin
      .from('sellers')
      .select('slack_user_id, slack_access_token')
      .eq('id', sellerId)
      .single();

    if (seller && seller.slack_access_token && seller.slack_user_id) {
       const slackMessage = `📦 Order #${shortId} packed and ready for pickup.\nCustomer: ${orderData.buyer_name} • ${orderData.products?.name}`;
       sendSlackDM(seller.slack_access_token, seller.slack_user_id, slackMessage)
        .catch((err: unknown) => console.error("TF Slack error:", err));
    }

    return NextResponse.json({ success: true, otp });

  } catch (err) {
    console.error("Pack order API Error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
