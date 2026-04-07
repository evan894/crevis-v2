import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { deductCredits, deactivateSellerListings } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Database } from "@/types/database.types";
import { CREDIT_COST_LISTING, CREDIT_LOW_THRESHOLD } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, price, category, photo_url, photo_urls, stock, has_variants, variants } = body;

    if (!name || !price || !category || !photo_url) {
       return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    // THEN Deduct credits
    const newBalance = await deductCredits(seller.id, CREDIT_COST_LISTING, "listing", `Listing fee for ${name}`);

    // THEN Check new balance
    if (newBalance === 0) {
       await deactivateSellerListings(seller.id);
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    if (error instanceof Error) {
       if (error.message.includes('insufficient')) {
          return NextResponse.json({ error: "Insufficient credits" }, { status: 400 });
       }
       return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 400 });
  }
}
