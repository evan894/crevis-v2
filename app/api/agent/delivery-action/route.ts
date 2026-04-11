import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bot from '@/bot';
import { sendSlackDM } from '@/lib/slack';
import { SLACK_MESSAGES } from '@/lib/constants';

export async function POST(req: Request) {
  try {
    const { action, deliveryOrderId, otp, reason } = await req.json();

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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: dOrder } = await supabaseAdmin
      .from('delivery_orders')
      .select('*, orders (id, seller_id, buyer_telegram_id, buyer_name, products (name))')
      .eq('id', deliveryOrderId)
      .single();

    if (!dOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const orderData = dOrder.orders as any;
    const shortId = orderData.id.slice(-6).toUpperCase();

    // PICK UP ORDER
    if (action === 'pick_up') {
      const { error } = await supabaseAdmin
        .from('delivery_orders')
        .update({ 
          status: 'out_for_delivery', 
          agent_id: user.id, 
          picked_up_at: new Date().toISOString() 
        })
        .eq('id', deliveryOrderId);

      if (error) throw error;
      
      if (orderData.buyer_telegram_id) {
        bot.telegram.sendMessage(orderData.buyer_telegram_id, "🛵 *Your order is on the way!*\nYour delivery agent has picked it up.\nHave your OTP ready.", { parse_mode: 'Markdown' })
          .catch(console.error);
      }
      return NextResponse.json({ success: true });
    }

    // VERIFY OTP
    if (action === 'verify_otp') {
      if (dOrder.otp_attempts >= 3) {
        return NextResponse.json({ error: "Too many wrong attempts", locked: true }, { status: 400 });
      }

      if (dOrder.otp !== otp) {
        const newAttempts = dOrder.otp_attempts + 1;
        await supabaseAdmin
          .from('delivery_orders')
          .update({ otp_attempts: newAttempts })
          .eq('id', deliveryOrderId);

        return NextResponse.json({ 
          error: "Wrong OTP", 
          attemptsLeft: 3 - newAttempts 
        }, { status: 400 });
      }

      // Success
      await supabaseAdmin.from('delivery_orders').update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      }).eq('id', deliveryOrderId);

      await supabaseAdmin.from('orders').update({
        status: 'completed'
      }).eq('id', dOrder.order_id);

      if (orderData.buyer_telegram_id) {
        bot.telegram.sendMessage(orderData.buyer_telegram_id, "✅ Order delivered! Thank you for shopping on Crevis.", { parse_mode: 'Markdown' })
          .catch(console.error);
      }

      const { data: seller } = await supabaseAdmin.from('sellers').select('slack_user_id, slack_access_token').eq('id', orderData.seller_id).single();
      if (seller?.slack_access_token && seller?.slack_user_id) {
        sendSlackDM(seller.slack_access_token, seller.slack_user_id, `✅ Order #${shortId} delivered to ${orderData.buyer_name}.`)
          .catch((err: any) => console.error(err));
      }
      return NextResponse.json({ success: true });
    }

    // REPORT FAILED
    if (action === 'report_failed') {
      await supabaseAdmin.from('delivery_orders').update({
        status: 'failed_delivery',
        failure_reason: reason,
        failed_at: new Date().toISOString()
      }).eq('id', deliveryOrderId);

      await supabaseAdmin.from('orders').update({ status: 'failed' }).eq('id', dOrder.order_id);

      if (orderData.buyer_telegram_id) {
        bot.telegram.sendMessage(orderData.buyer_telegram_id, `❌ Your order delivery failed.\nReason: ${reason}`, { parse_mode: 'Markdown' })
          .catch(console.error);
      }

      const { data: seller } = await supabaseAdmin.from('sellers').select('slack_user_id, slack_access_token').eq('id', orderData.seller_id).single();
      if (seller?.slack_access_token && seller?.slack_user_id) {
        sendSlackDM(seller.slack_access_token, seller.slack_user_id, `❌ Order #${shortId} delivery failed.\nReason: ${reason}`)
          .catch((err: any) => console.error(err));
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (err) {
    console.error("Delivery action API Error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
