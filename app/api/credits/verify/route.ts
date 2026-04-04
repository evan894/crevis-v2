import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { addCredits } from "@/lib/credits";
import { sendSlackDM } from "@/lib/slack";
import type { Database } from "@/types/database.types";

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, credits } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !credits) {
       return NextResponse.json({ error: "Missing verification parameters" }, { status: 400 });
    }

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

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Securely add credits via Postgres RPC
    const newBalance = await addCredits(seller.id, credits, 'credit_purchase', `Razorpay txn: ${razorpay_payment_id}`);

    if (seller.slack_access_token && seller.slack_user_id) {
       try {
           await sendSlackDM(
               seller.slack_access_token,
               seller.slack_user_id,
               `✅ Wallet recharged! ${credits} credits added.\nNew balance: ${newBalance} credits.`
           );
       } catch (slackErr) {
           console.error(`Slack notification failed [Credit Purchase] [seller_id: ${seller.id}]:`, slackErr);
       }
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}
