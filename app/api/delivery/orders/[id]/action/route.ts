import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSlackDM } from "@/lib/slack";
import type { Database } from "@/types/database.types";

const ALLOWED_ROLES = ["owner", "manager", "delivery_agent"];
const MAX_OTP_ATTEMPTS = 3;

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name) { return cookieStore.get(name)?.value; } } }
  );
}

async function sendTelegram(telegramId: string, text: string) {
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
 * POST /api/delivery/orders/[id]/action
 * body: { action: 'pick_up' | 'confirm_delivery' | 'report_failed', otp?: string, reason?: string, notes?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabaseAdmin
      .from("store_members")
      .select("seller_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ALLOWED_ROLES)
      .limit(1)
      .single();

    if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { action, otp: enteredOtp, reason, notes } = await request.json();
    const deliveryId = params.id;

    // Fetch delivery_order
    const { data: delivery, error: deliveryErr } = await supabaseAdmin
      .from("delivery_orders")
      .select("id, order_id, status, otp, otp_attempts")
      .eq("id", deliveryId)
      .single();

    if (deliveryErr || !delivery) {
      return NextResponse.json({ error: "Delivery record not found" }, { status: 404 });
    }

    // Fetch the order + product + seller
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_name, buyer_telegram_id, amount, seller_id, products(id, name)")
      .eq("id", delivery.order_id)
      .eq("seller_id", membership.seller_id)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const productName = Array.isArray(order.products)
      ? (order.products[0] as { name: string })?.name ?? "your item"
      : (order.products as { name: string } | null)?.name ?? "your item";

    // Seller Slack info
    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("slack_user_id, slack_access_token")
      .eq("id", membership.seller_id)
      .single();

    // ── pick_up ──────────────────────────────────────────────────────────────
    if (action === "pick_up") {
      const { error } = await supabaseAdmin
        .from("delivery_orders")
        .update({
          status: "out_for_delivery",
          agent_id: user.id,
          picked_up_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      if (error) throw error;

      await sendTelegram(
        order.buyer_telegram_id,
        `🛵 Your order is on the way!\n\n` +
        `Your delivery agent has picked it up.\n` +
        `Have your OTP ready — it was sent when your order was packed.`
      );

      return NextResponse.json({ success: true, status: "out_for_delivery" });
    }

    // ── confirm_delivery ──────────────────────────────────────────────────────
    if (action === "confirm_delivery") {
      if (!enteredOtp) {
        return NextResponse.json({ error: "OTP is required" }, { status: 400 });
      }

      // Check attempt limit
      if ((delivery.otp_attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
        return NextResponse.json({
          error: "Too many wrong attempts. Please contact the customer directly.",
          locked: true,
        }, { status: 429 });
      }

      // Verify OTP
      if (enteredOtp.trim() !== delivery.otp?.trim()) {
        // Increment attempts
        await supabaseAdmin
          .from("delivery_orders")
          .update({ otp_attempts: (delivery.otp_attempts ?? 0) + 1 })
          .eq("id", deliveryId);

        const attemptsLeft = MAX_OTP_ATTEMPTS - (delivery.otp_attempts ?? 0) - 1;
        return NextResponse.json({
          error: `Wrong OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`,
          wrong_otp: true,
          attempts_left: attemptsLeft,
        }, { status: 422 });
      }

      // OTP correct — mark delivered
      await supabaseAdmin
        .from("delivery_orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      await supabaseAdmin
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id);

      // Telegram buyer
      await sendTelegram(
        order.buyer_telegram_id,
        `✅ Order delivered successfully!\n\nThank you for shopping on Crevis.`
      );

      // Slack seller
      if (seller?.slack_access_token && seller?.slack_user_id) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `✅ Order delivered — ${productName} to ${order.buyer_name}.\nAmount: ₹${order.amount.toLocaleString("en-IN")}`
        );
      }

      return NextResponse.json({ success: true, status: "delivered" });
    }

    // ── report_failed ─────────────────────────────────────────────────────────
    if (action === "report_failed") {
      if (!reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 });

      const failureReason = notes ? `${reason}: ${notes}` : reason;

      await supabaseAdmin
        .from("delivery_orders")
        .update({
          status: "failed_delivery",
          failure_reason: failureReason,
        })
        .eq("id", deliveryId);

      await supabaseAdmin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id);

      // Telegram buyer
      await sendTelegram(
        order.buyer_telegram_id,
        `😔 We couldn't deliver your order.\n\nReason: ${reason}\n\nPlease contact your seller to reschedule.`
      );

      // Slack seller
      if (seller?.slack_access_token && seller?.slack_user_id) {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `❌ Delivery failed — ${productName} for ${order.buyer_name}.\nReason: ${failureReason}\nAgent: ${user.id.slice(0, 8)}`
        );
      }

      return NextResponse.json({ success: true, status: "failed_delivery" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
