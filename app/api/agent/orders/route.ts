import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/agent/orders
 * Returns delivery_orders joined with orders + products for this seller.
 * Filtered by status ∈ ['confirmed','packed','out_for_delivery']
 */
export async function GET() {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let ctx;
    try { ctx = await requirePermission(user.id, 'pack_orders'); }
    catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }

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
      .eq("seller_id", ctx.sellerId)
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

    return NextResponse.json({ orders: enriched, role: ctx.role });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
