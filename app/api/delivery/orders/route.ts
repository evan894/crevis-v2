import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/delivery/orders
 * Returns delivery_orders with orders + products for this seller.
 * Statuses returned: packed (ready), out_for_delivery, delivered (today only)
 */
export async function GET() {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let ctx;
    try { ctx = await requirePermission(user.id, 'update_delivery'); }
    catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }

    // Today's start (UTC midnight)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Fetch all relevant delivery_orders for this seller
    const { data: deliveries, error } = await supabaseAdmin
      .from("delivery_orders")
      .select(`
        id,
        order_id,
        status,
        otp,
        otp_attempts,
        packed_at,
        picked_up_at,
        delivered_at,
        failure_reason,
        agent_id
      `)
      .in("status", ["packed", "out_for_delivery", "delivered", "failed_delivery"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch the matching orders + products
    const orderIds = (deliveries ?? []).map(d => d.order_id);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_name, buyer_telegram_id, amount, seller_id, products(id, name, photo_url)")
      .in("id", orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("seller_id", ctx.sellerId);

    const orderMap = new Map((orders ?? []).map(o => [o.id, o]));

    const enriched = (deliveries ?? [])
      .map(d => {
        const order = orderMap.get(d.order_id);
        if (!order) return null; // filter out other sellers
        const product = Array.isArray(order.products) ? order.products[0] : order.products;
        return { ...d, order, product };
      })
      .filter(Boolean);

    return NextResponse.json({ orders: enriched, role: ctx.role, userId: user.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
