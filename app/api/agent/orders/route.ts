import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Database } from "@/types/database.types";

const ALLOWED_ROLES = ["owner", "manager", "sales_agent"];

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name) { return cookieStore.get(name)?.value; } } }
  );
}

/**
 * GET /api/agent/orders
 * Returns delivery_orders joined with orders + products for this seller.
 * Filtered by status ∈ ['confirmed','packed','out_for_delivery']
 */
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve seller via store_members (agent may not have a sellers row)
    const { data: membership } = await supabaseAdmin
      .from("store_members")
      .select("seller_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .single();

    if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        buyer_name,
        buyer_telegram_id,
        amount,
        status,
        created_at,
        products ( id, name, photo_url, price, category )
      `)
      .eq("seller_id", membership.seller_id)
      .in("status", ["completed", "pending"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch delivery records for these orders
    const orderIds = (orders ?? []).map(o => o.id);
    const { data: deliveries } = await supabaseAdmin
      .from("delivery_orders")
      .select("id, order_id, status, otp, packed_at")
      .in("order_id", orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"]);

    const deliveryMap = new Map((deliveries ?? []).map(d => [d.order_id, d]));

    const enriched = (orders ?? []).map(o => ({
      ...o,
      delivery: deliveryMap.get(o.id) ?? null,
      product: Array.isArray(o.products) ? o.products[0] : o.products,
    }));

    return NextResponse.json({ orders: enriched, role: membership.role });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
