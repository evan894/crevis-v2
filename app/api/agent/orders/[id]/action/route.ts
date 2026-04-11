import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSlackDM } from "@/lib/slack";

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendTelegramMessage(telegramId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[Telegram] sendMessage failed:", err);
  }
}

/**
 * POST /api/agent/orders/[id]/action
 * body: { action: 'start_packing' | 'mark_packed' | 'out_of_stock' }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let ctx;
    try { ctx = await requirePermission(user.id, 'pack_orders'); }
    catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }

    const { action } = await request.json();
    const orderId = params.id;

    // Fetch the order + product
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_name, buyer_telegram_id, amount, seller_id, products(id, name)")
      .eq("id", orderId)
      .eq("seller_id", ctx.sellerId)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const productName = Array.isArray(order.products)
      ? order.products[0]?.name ?? "your product"
      : (order.products as { name: string } | null)?.name ?? "your product";

    // Fetch seller for Slack
    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("slack_user_id, slack_access_token, shop_name")
      .eq("id", ctx.sellerId)
      .single();

    // ── action: start_packing ──────────────────────────────────────────────
    if (action === "start_packing") {
      // Upsert delivery_order with status = 'confirmed'
      const { error } = await supabaseAdmin
        .from("delivery_orders")
        .upsert(
          { order_id: orderId, status: "confirmed" },
          { onConflict: "order_id" }
        );
      if (error) throw error;
      return NextResponse.json({ success: true, status: "confirmed" });
    }

    // ── action: mark_packed ───────────────────────────────────────────────
    if (action === "mark_packed") {
      const otp = generateOTP();

      const { error } = await supabaseAdmin
        .from("delivery_orders")
        .update({
          status: "packed",
          otp,
          packed_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);

      if (error) throw error;

      // Send OTP to buyer via Telegram
      await sendTelegramMessage(
        order.buyer_telegram_id,
        `📦 Your order is packed and ready!\n\n` +
        `Your delivery OTP is: <b>${otp}</b>\n\n` +
        `Share this with your delivery agent when they arrive.`
      );

      // Notify seller on Slack
      if (seller?.slack_access_token && seller?.slack_user_id) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `📦 Order #${orderId.slice(0, 8)} is packed and ready for pickup.\nProduct: ${productName}\nAssign a delivery agent in your dashboard.`
        );
      }

      return NextResponse.json({ success: true, status: "packed", otp });
    }

    // ── action: out_of_stock ──────────────────────────────────────────────
    if (action === "out_of_stock") {
      const productId = Array.isArray(order.products)
        ? order.products[0]?.id
        : (order.products as { id: string } | null)?.id;

      // Update order status
      await supabaseAdmin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", orderId);

      // Update delivery_orders
      await supabaseAdmin
        .from("delivery_orders")
        .upsert(
          {
            order_id: orderId,
            status: "failed_delivery",
            failure_reason: "out_of_stock",
          },
          { onConflict: "order_id" }
        );

      // Deactivate product and zero stock
      if (productId) {
        await supabaseAdmin
          .from("products")
          .update({ active: false, stock: 0 })
          .eq("id", productId);
      }

      // Notify buyer on Telegram
      await sendTelegramMessage(
        order.buyer_telegram_id,
        `😔 Sorry, your order for ${productName} couldn't be fulfilled as it's out of stock.\n\nA refund will be processed shortly.`
      );

      // Notify seller on Slack
      if (seller?.slack_access_token && seller?.slack_user_id) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `⚠️ Order #${orderId.slice(0, 8)} for "${productName}" marked out of stock by an agent. Buyer has been notified.`
        );
      }

      return NextResponse.json({ success: true, status: "failed_delivery" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
