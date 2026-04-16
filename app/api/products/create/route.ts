import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deductCredits, deactivateSellerListings } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CREDIT_COST_LISTING, CREDIT_LOW_THRESHOLD } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, price, category, photo_url, photo_urls, stock, has_variants, variants } = body;

    if (!name || !price || !category) {
       return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase.from("sellers").select("id, credit_balance").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    if (seller.credit_balance < CREDIT_LOW_THRESHOLD) {
       return NextResponse.json({ 
         error: "Your balance is below 50 credits. Top up your wallet to list new products. Your existing listings remain active."
       }, { status: 400 });
    }

    // Insert Product FIRST
    const { data: product, error: insertError } = await supabaseAdmin.from("products").insert({
       seller_id: seller.id,
       name,
       description: description || null,
       price: parseFloat(price),
       category,
       photo_url,
       photo_urls: photo_urls || [],
       stock: stock || 1,
       has_variants: has_variants || false,
       variants: has_variants ? variants : null,
       active: true,
       boosted: false
    }).select().single();

    if (insertError) throw insertError;

    // THEN Deduct credits with a compensating transaction if it fails
    try {
      const newBalance = await deductCredits(seller.id, CREDIT_COST_LISTING, "listing", `Listing fee for ${name}`);
      
      // If new balance is 0 or less, deactivate all listings
      if (typeof newBalance === 'number' && newBalance <= 0) {
         await deactivateSellerListings(seller.id);
      }
    } catch (deductionError) {
      // COMPENSATING TRANSACTION: If credit deduction fails, delete the product record
      // to ensure we don't have UNPAID listings.
      console.error("Credit deduction failed, rolling back product creation", deductionError);
      await supabaseAdmin.from("products").delete().eq("id", product.id);
      throw deductionError;
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    console.error('[product create caught]', error);
    return NextResponse.json(
      { 
        error: 'Failed to create product', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
