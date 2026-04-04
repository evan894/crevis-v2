import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

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

    const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });

    const { data: product } = await supabaseAdmin.from("products").select("id, seller_id, active").eq("id", params.id).single();
    
    if (!product || product.seller_id !== seller.id) {
       return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await supabaseAdmin.from("products").update({ active: !product.active }).eq("id", params.id);

    return NextResponse.json({ success: true, active: !product.active });
  } catch (error: unknown) {
    console.error("Toggle active error", error);
    return NextResponse.json({ error: "Failed to toggle active" }, { status: 400 });
  }
}
