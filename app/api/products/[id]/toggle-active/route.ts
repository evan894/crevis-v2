import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requirePermission } from "@/lib/roles";
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

    // Use permission system instead of direct seller lookup
    let ctx;
    try {
      ctx = await requirePermission(user.id, 'manage_products');
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Permission denied" }, { status: 403 });
    }

    const { data: product } = await supabaseAdmin.from("products").select("id, seller_id, active").eq("id", params.id).single();
    
    if (!product || product.seller_id !== ctx.sellerId) {
       return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await supabaseAdmin.from("products").update({ active: !product.active }).eq("id", params.id);

    return NextResponse.json({ success: true, active: !product.active });
  } catch (error: unknown) {
    console.error("Toggle active error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to toggle active" }, { status: 400 });
  }
}
