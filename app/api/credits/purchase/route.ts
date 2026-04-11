import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PACKAGES: Record<number, number> = {
  100: 100,
  500: 550,
  1000: 1200
};

export async function POST(request: Request) {
  try {
    const { amount } = await request.json();

    if (!PACKAGES[amount]) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const options = {
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${user.id.slice(0,8)}`,
      notes: {
         credits: PACKAGES[amount]
      }
    };

    const order = await razorpay.orders.create(options);

    const { error: insertError } = await supabaseAdmin.from('credit_purchases').insert({
      seller_id: seller.id,
      amount_paid: amount,
      credits_added: PACKAGES[amount],
      razorpay_order_id: order.id,
      status: 'pending'
    });

    if (insertError) {
      console.error("Failed to insert pending credit purchase", insertError);
      return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
    }

    return NextResponse.json({ 
      id: order.id, 
      amount: order.amount, 
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      credits: PACKAGES[amount]
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
