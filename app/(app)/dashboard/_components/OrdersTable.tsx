"use client";

import { ShoppingBag } from "lucide-react";

type DeliveryStatus =
  | "pending" | "confirmed" | "packed" | "out_for_delivery"
  | "delivered" | "failed_delivery" | null;

export type OrderRow = {
  id: string;
  buyer_name: string;
  amount: number;
  platform_fee: number;
  status: string;
  created_at: string;
  products: { name: string } | null;
  delivery_orders: { status: DeliveryStatus; agent_id: string | null } | null;
};

const DELIVERY_LABELS: Record<string, string> = {
  pending: "Awaiting packing",
  confirmed: "Confirmed",
  packed: "Packed, awaiting pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered ✅",
  failed_delivery: "Failed ❌",
};

const DELIVERY_BADGE: Record<string, string> = {
  pending: "bg-surface text-ink-muted border-border",
  confirmed: "bg-warning-bg text-warning-content border-warning/30",
  packed: "bg-blue-50 text-blue-700 border-blue-200",
  out_for_delivery: "bg-info-bg text-info border-info/30",
  delivered: "bg-success-bg text-success border-success/30",
  failed_delivery: "bg-error-bg text-error border-error/30",
};

function deliveryBadge(status: DeliveryStatus) {
  const s = status ?? "pending";
  const cls = DELIVERY_BADGE[s] ?? "bg-surface text-ink-muted border-border";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cls}`}>
      {DELIVERY_LABELS[s] ?? s}
    </span>
  );
}

export function OrdersTable({ orders, pulse }: { orders: OrderRow[]; pulse: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne font-bold text-2xl text-ink">Recent Orders</h2>
        {pulse && (
          <span className="flex items-center gap-2 px-3 py-1 bg-success/10 text-success text-xs font-bold rounded-full animate-pulse border border-success/20">
            <span className="w-1.5 h-1.5 bg-success rounded-full" />
            LIVE UPDATING
          </span>
        )}
      </div>

      <div className="bg-surface-raised border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <ShoppingBag className="w-12 h-12 text-ink-muted opacity-50 mb-4" />
              <h3 className="text-lg font-bold text-ink mb-1">No orders yet</h3>
              <p className="text-sm text-ink-secondary max-w-sm mb-6">Share your Telegram bot link with customers to start processing sales.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface text-ink-muted border-b border-border">
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Buyer</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Amount</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Fee</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-center">Delivery Status</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-surface/50 transition-colors last:border-0">
                    <td className="px-6 py-4 text-sm font-medium text-ink">{order.products?.name ?? "Unknown Item"}</td>
                    <td className="px-6 py-4 text-sm text-ink-secondary">{order.buyer_name}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-jetbrains-mono font-medium text-ink">₹{order.amount}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-jetbrains-mono text-sm text-ink-muted">₹{order.platform_fee}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {deliveryBadge(order.delivery_orders?.status ?? "pending")}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-ink-muted whitespace-nowrap">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
