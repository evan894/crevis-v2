import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendSlackDM } from '@/lib/slack';
import { addCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Check for cron authorization (if provided by Vercel)
    const authHeader = req.headers.get('authorization');
    if (
      process.env.NODE_ENV === 'production' &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // We also need to filter by status = 'delivered'
    // But since the requirement says "AND status = 'delivered'", let's add that filter
    // Wait, let's filter in code in case it's in a different table or string
    // Let's add it to the query:
    const { data: deliveredOrders, error: deliveredErr } = await supabaseAdmin
      .from('orders')
      .select('*, products(name), sellers(shop_name, slack_user_id, slack_access_token)')
      .eq('credits_released', false)
      .eq('return_requested', false)
      .eq('status', 'delivered')
      .lte('return_window_closes_at', new Date().toISOString());

    if (deliveredErr) {
      throw new Error(`Failed to fetch orders: ${deliveredErr.message}`);
    }

    let processedCount = 0;

    for (const order of deliveredOrders || []) {
      // Calculate earned credits
      const earned = order.amount - order.platform_fee;

      const productName = Array.isArray(order.products) ? order.products[0]?.name : order.products?.name;

      // Add to seller earned credits
      const newBalance = await addCredits(
        order.seller_id,
        earned,
        'order_earned',
        'earned',
        `Order #${order.id.slice(-6)} — ${productName}`
      );

      // Mark credits released
      await supabaseAdmin
        .from('orders')
        .update({
          credits_released: true,
          credits_released_at: new Date().toISOString()
        })
        .eq('id', order.id);

      // Notify seller
      const slackAccessToken = Array.isArray(order.sellers) ? order.sellers[0]?.slack_access_token : order.sellers?.slack_access_token;
      const slackUserId = Array.isArray(order.sellers) ? order.sellers[0]?.slack_user_id : order.sellers?.slack_user_id;

      if (slackAccessToken && slackUserId) {
        try {
          await sendSlackDM(
            slackAccessToken,
            slackUserId,
            `💰 ₹${earned} earned from ${productName} sale.\nAdded to your wallet.\nBalance: ${newBalance} CC`
          );
        } catch (err) {
          console.error(`Failed to send Slack DM to ${slackUserId}:`, err);
        }
      }

      processedCount++;
    }

    return NextResponse.json({ success: true, processed: processedCount }, { status: 200 });
  } catch (error: unknown) {
    console.error('Release credits cron error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
