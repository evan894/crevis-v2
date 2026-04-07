import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    // Quick auth check for Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Find products where scheduled_delete_at <= now()
    const { data: productsToClean, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('id, name, unlisted_at, scheduled_delete_at, seller_id, sellers(slack_access_token, slack_user_id, unlist_duration_days)')
      .lte('scheduled_delete_at', new Date().toISOString())

    if (fetchError) throw fetchError

    if (!productsToClean || productsToClean.length === 0) {
      return NextResponse.json({ message: 'No products to clean up', deletedCount: 0 })
    }

    let deletedCount = 0
    let failedCount = 0

    // 2 & 3 Process each product
    for (const prod of productsToClean) {
      try {
        const seller = Array.isArray(prod.sellers) ? prod.sellers[0] : prod.sellers;
        
        // Hard delete
        const { error: deleteError } = await supabaseAdmin
          .from('products')
          .delete()
          .eq('id', prod.id)
          
        if (deleteError) throw deleteError
        deletedCount++

        // Notification logic
        if (seller?.slack_access_token && seller?.slack_user_id) {
          const duration = seller?.unlist_duration_days || 7;
          const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
          const text = `🚮 Your product *${prod.name}* has been automatically deleted after being unlisted for ${duration} days.\n<${dashboardUrl}|View Dashboard>`;
          
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
               'Authorization': `Bearer ${seller.slack_access_token}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
               channel: seller.slack_user_id,
               text
            })
          });
        }
      } catch (err) {
        console.error(`Failed to delete product ${prod.id}:`, err)
        failedCount++
      }
    }

    // 4. Return summary
    return NextResponse.json({
      message: 'Product cleanup completed',
      deletedCount,
      failedCount
    })

  } catch (error) {
    console.error('Cleanup products cron failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
