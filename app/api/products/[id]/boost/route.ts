import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deductCredits, deactivateSellerListings } from "@/lib/credits";
import { requirePermission } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSlackDM } from "@/lib/slack";
import { CREDIT_COST_BOOST, LOW_CREDIT_THRESHOLD, CREDIT_LOW_THRESHOLD, SLACK_MESSAGES } from "@/lib/constants";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Use permission system instead of direct seller lookup
    let ctx;
    try {
      ctx = await requirePermission(user.id, 'manage_products');
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Permission denied" }, { status: 403 });
    }

    const { data: seller } = await supabaseAdmin.from("sellers").select("id, slack_access_token, slack_user_id, credit_balance").eq("id", ctx.sellerId).single();
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    if (seller.credit_balance < CREDIT_LOW_THRESHOLD) {
       return NextResponse.json({ 
         error: "Your balance is below 50 credits. Top up to boost products."
       }, { status: 400 });
    }

    const { data: product } = await supabaseAdmin.from("products").select("id, seller_id, boosted").eq("id", params.id).single();
    
    if (!product || product.seller_id !== ctx.sellerId) {
       return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (product.boosted) {
       return NextResponse.json({ error: "Product already boosted" }, { status: 400 });
    }

    // Deduct credits
    const newBalance = await deductCredits(seller.id, CREDIT_COST_BOOST, "boost", `Boost feature for ${params.id}`);

    if (newBalance === 0) {
       await deactivateSellerListings(seller.id);
    } else if (newBalance < LOW_CREDIT_THRESHOLD && newBalance > 0) {
       if (seller.slack_access_token && seller.slack_user_id) {
           try {
               await sendSlackDM(
                   seller.slack_access_token,
                   seller.slack_user_id,
                   SLACK_MESSAGES.lowCredits(newBalance)
               );
           } catch (err) {
               console.error('[Slack] failed', err);
           }
       }
    }

    // Set boosted
    await supabaseAdmin.from("products").update({ boosted: true }).eq("id", params.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
       if (error.message.includes('insufficient')) {
          return NextResponse.json({ error: "Insufficient credits" }, { status: 400 });
       }
       return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to boost product" }, { status: 400 });
  }
}
