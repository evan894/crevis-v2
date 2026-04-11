import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { redeemCoupon } from "@/lib/credits";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const newBalance = await redeemCoupon(seller.id, code);
    
    return NextResponse.json({ success: true, newBalance });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid or expired coupon" }, { status: 400 });
  }
}
