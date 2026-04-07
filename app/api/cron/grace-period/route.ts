import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendSlackDM, slackAdmin } from '@/lib/slack';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sellers, error } = await supabaseAdmin
      .from('sellers')
      .select('id, shop_name, credit_balance, grace_period_started_at, slack_access_token, slack_user_id')
      .eq('deactivated', false)
      .not('grace_period_started_at', 'is', null)
      .lt('credit_balance', 0);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!sellers || sellers.length === 0) {
      return NextResponse.json({ success: true, message: 'No sellers in grace period' });
    }

    const now = Date.now();
    let processed = 0;

    for (const seller of sellers) {
      const graceStart = new Date(seller.grace_period_started_at!).getTime();
      const daysOverdue = Math.floor((now - graceStart) / (1000 * 60 * 60 * 24));
      
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      if (daysOverdue === 3) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `⚠️ Your Crevis balance has been negative for 3 days.\n2 days remaining to settle dues or your store will be paused. Top up at ${APP_URL}/wallet`
        );
        processed++;
      } else if (daysOverdue === 5) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `🚨 Final warning — your store will be paused tomorrow if dues are not settled.\nTop up now: ${APP_URL}/wallet`
        );
        processed++;
      } else if (daysOverdue >= 6) {
        const { data: products } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('seller_id', seller.id)
          .eq('active', true);

        const snapshot = products?.map(p => p.id) || [];

        await supabaseAdmin
          .from('products')
          .update({ active: false })
          .eq('seller_id', seller.id)
          .eq('active', true);

        await supabaseAdmin
          .from('sellers')
          .update({
            deactivated: true,
            deactivated_at: new Date().toISOString(),
            deactivated_snapshot: { product_ids: snapshot }
          })
          .eq('id', seller.id);

        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          "❌ Your store has been paused due to outstanding balance. Contact Crevis to resolve."
        );

        if (process.env.ADMIN_SLACK_USER_ID) {
          await slackAdmin.chat.postMessage({
            channel: process.env.ADMIN_SLACK_USER_ID,
            text: `🔴 Store deactivated: ${seller.shop_name}\nBalance: ${seller.credit_balance} CC\nProducts paused: ${snapshot.length}\nUndo at: ${APP_URL}/admin/stores`
          });
        }
        processed++;
      }
    }

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    console.error('[cron/grace-period error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
