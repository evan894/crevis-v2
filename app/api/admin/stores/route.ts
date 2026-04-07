import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

export async function GET(request: Request) {
  try {
    // Validate admin header (simple token check)
    const authHeader = request.headers.get("x-admin-token");
    if (authHeader !== process.env.ADMIN_SECRET_TOKEN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all sellers with product counts and order stats
    const { data: sellers, error } = await supabaseAdmin
      .from("sellers")
      .select("id, shop_name, category, credit_balance, created_at, user_id, deactivated, deactivated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get product counts per seller
    const { data: productCounts } = await supabaseAdmin
      .from("products")
      .select("seller_id, active")
      .eq("active", true);

    const productMap = new Map<string, number>();
    for (const p of productCounts ?? []) {
      productMap.set(p.seller_id, (productMap.get(p.seller_id) ?? 0) + 1);
    }

    // Get order counts per seller
    const { data: orderCounts } = await supabaseAdmin
      .from("orders")
      .select("seller_id, status")
      .eq("status", "completed");

    const orderMap = new Map<string, number>();
    for (const o of orderCounts ?? []) {
      orderMap.set(o.seller_id, (orderMap.get(o.seller_id) ?? 0) + 1);
    }

    // Get user emails
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map(authData?.users?.map(u => [u.id, u.email ?? "Unknown"]) ?? []);

    const enriched = (sellers ?? []).map(s => ({
      ...s,
      email: emailMap.get(s.user_id) ?? "Unknown",
      active_products: productMap.get(s.id) ?? 0,
      completed_orders: orderMap.get(s.id) ?? 0,
    }));

    return NextResponse.json({ stores: enriched });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// Unused variable suppressor
void ADMIN_EMAILS;
