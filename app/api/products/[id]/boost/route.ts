import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { deductCredits, deactivateSellerListings } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSlackDM } from "@/lib/slack";
import type { Database } from "@/types/database.types";
import { CREDIT_COST_BOOST, LOW_CREDIT_THRESHOLD, SLACK_MESSAGES } from "@/lib/constants";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase.from("sellers").select("id, slack_access_token, slack_user_id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const { data: product } = await supabaseAdmin.from("products").select("id, seller_id, boosted").eq("id", params.id).single();
    
    if (!product || product.seller_id !== seller.id) {
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
