import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Razorpay from "razorpay";
import type { Database } from "@/types/database.types";

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

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    });

    const options = {
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${user.id.slice(0,8)}`,
      notes: {
         credits: PACKAGES[amount]
      }
    };

    const order = await razorpay.orders.create(options);

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
