"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Image from "next/image";
import {
  Loader2, ShoppingBag, Package, Truck, LogOut,
  AlertTriangle, CheckCircle2, Clock, RefreshCw
} from "lucide-react";
import { toast } from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────────────────

type DeliveryOrder = {
  id: string;
  order_id: string;
  status: "confirmed" | "packed" | "out_for_delivery" | "delivered" | "failed_delivery" | null;
  otp: string | null;
  packed_at: string | null;
};

type Product = {
  id: string;
  name: string;
  photo_url: string;
  price: number;
  category: string;
};

type AgentOrder = {
  id: string;
  buyer_name: string;
  buyer_telegram_id: string;
  amount: number;
  status: string;
  created_at: string;
  product: Product | null;
  delivery: DeliveryOrder | null;
};

type SellerInfo = {
  shop_name: string;
  id: string;
};

type AgentRole = "owner" | "manager" | "sales_agent";

// ─── Helpers ───────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleBadgeStyle(role: AgentRole): string {
  switch (role) {
    case "owner":       return "bg-saffron/15 text-saffron";
    case "manager":     return "bg-blue-100 text-blue-700";
    case "sales_agent": return "bg-emerald-100 text-emerald-700";
  }
}

function roleLabel(role: AgentRole): string {
  switch (role) {
    case "owner":       return "Owner";
    case "manager":     return "Manager";
    case "sales_agent": return "Sales Agent";
  }
}

// ─── Out of Stock Modal ─────────────────────────────────────────────────────

function OutOfStockModal({
  order, onClose, onConfirm, loading
}: {
  order: AgentOrder;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface-raised w-full max-w-sm rounded-2xl shadow-xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <h3 className="font-syne font-bold text-lg text-ink">Out of Stock?</h3>
          </div>
          <p className="text-sm text-ink-secondary mb-6 leading-relaxed">
            Mark <span className="font-semibold text-ink">{order.product?.name ?? "this product"}</span> as out of stock?
            The buyer will be notified and a refund will be initiated.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full h-[52px] bg-error text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, mark out of stock"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full h-[48px] bg-surface border border-border rounded-xl font-medium text-sm text-ink-secondary hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ─────────────────────────────────────────────────────────────

function OrderCard({
  order, tab, onAction
}: {
  order: AgentOrder;
  tab: "new" | "packing" | "ready";
  onAction: (orderId: string, action: "start_packing" | "mark_packed" | "out_of_stock") => void;
}) {
  const [outOfStockOpen, setOutOfStockOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: "start_packing" | "mark_packed") => {
    setActionLoading(true);
    await onAction(order.id, action);
    setActionLoading(false);
  };

  const handleOutOfStock = async () => {
    setActionLoading(true);
    await onAction(order.id, "out_of_stock");
    setOutOfStockOpen(false);
    setActionLoading(false);
  };

  return (
    <>
      {outOfStockOpen && (
        <OutOfStockModal
          order={order}
          onClose={() => setOutOfStockOpen(false)}
          onConfirm={handleOutOfStock}
          loading={actionLoading}
        />
      )}

      <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Card body */}
        <div className="p-4">
          <div className="flex gap-3">
            {/* Product photo */}
            <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden bg-surface shrink-0">
              {order.product?.photo_url ? (
                <Image
                  src={order.product.photo_url}
                  alt={order.product.name ?? "Product"}
                  fill
                  className="object-cover"
                  sizes="60px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-ink-muted" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink leading-tight truncate">
                {order.product?.name ?? "Unknown Product"}
              </p>
              <p className="text-xs text-ink-secondary mt-0.5">
                Buyer: <span className="font-medium text-ink">{order.buyer_name}</span>
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-jetbrains-mono font-bold text-sm text-saffron">
                  ₹{order.amount.toLocaleString("en-IN")}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                  <Clock className="w-3 h-3" />
                  {relativeTime(order.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Ready tab: OTP status */}
          {tab === "ready" && order.delivery?.otp && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-success-bg rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span className="text-xs font-medium text-success">OTP sent to buyer ✓</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {(tab === "new" || tab === "packing") && (
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={() => handleAction(tab === "new" ? "start_packing" : "mark_packed")}
              disabled={actionLoading}
              className="w-full h-[52px] bg-saffron text-white rounded-xl font-semibold text-[15px] hover:bg-saffron-dark hover:shadow-saffron transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : tab === "new" ? (
                <><Package className="w-5 h-5" /> Start Packing</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Mark as Packed</>
              )}
            </button>

            <button
              onClick={() => setOutOfStockOpen(true)}
              disabled={actionLoading}
              className="w-full h-[42px] flex items-center justify-center gap-1.5 text-warning text-sm font-medium hover:bg-warning-bg rounded-xl transition-colors disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              Out of Stock
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Stats Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, active }: {
  label: string;
  value: number;
  icon: React.ElementType;
  active?: boolean;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-3.5 border text-center transition-all ${active ? "bg-saffron/8 border-saffron/20" : "bg-surface-raised border-border"}`}>
      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${active ? "text-saffron" : "text-ink-muted"}`} />
      <p className={`font-syne font-bold text-2xl ${active ? "text-saffron" : "text-ink"}`}>{value}</p>
      <p className="text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type TabKey = "new" | "packing" | "ready";

export default function AgentPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [role, setRole] = useState<AgentRole>("sales_agent");
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [tab, setTab] = useState<TabKey>("new");
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/orders");
      if (res.status === 403) { setAccessDenied(true); return; }
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders ?? []);
      setRole(data.role ?? "sales_agent");
    } catch {
      toast.error("Failed to load orders");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/auth"; return; }

      // Get store name for display
      const { data: sellerData } = await supabase
        .from("sellers")
        .select("id, shop_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (sellerData) setSeller(sellerData);

      await fetchOrders();
      setLoading(false);
    };
    init();
  }, [supabase, fetchOrders]);

  const handleAction = useCallback(async (
    orderId: string,
    action: "start_packing" | "mark_packed" | "out_of_stock"
  ) => {
    try {
      const res = await fetch(`/api/agent/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const messages: Record<string, string> = {
        start_packing: "Now packing — let's go!",
        mark_packed:   "Order packed! OTP sent to buyer ✓",
        out_of_stock:  "Order marked out of stock. Buyer notified.",
      };
      toast.success(messages[action] ?? "Done");

      // Optimistic UI update
      setOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o;
        if (action === "start_packing") {
          return { ...o, delivery: { ...o.delivery!, status: "confirmed" } };
        }
        if (action === "mark_packed") {
          return { ...o, delivery: { ...o.delivery!, status: "packed", otp: data.otp ?? "------", packed_at: new Date().toISOString() } };
        }
        if (action === "out_of_stock") {
          return { ...o, status: "failed", delivery: { ...o.delivery!, status: "failed_delivery" } };
        }
        return o;
      }));

      // After packing, switch to correct tab
      if (action === "start_packing") setTab("packing");
      if (action === "mark_packed") setTab("ready");

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  // ── Derived lists ──────────────────────────────────────────────────────────

  // "New" = completed payments with no delivery record OR delivery status = null
  const newOrders = orders.filter(o =>
    o.status === "completed" && (!o.delivery || o.delivery.status === null)
  );

  // "Packing" = delivery status = 'confirmed'
  const packingOrders = orders.filter(o =>
    o.delivery?.status === "confirmed"
  );

  // "Ready" = delivery status = 'packed'
  const readyOrders = orders.filter(o =>
    o.delivery?.status === "packed"
  );

  const tabOrders: Record<TabKey, AgentOrder[]> = {
    new: newOrders,
    packing: packingOrders,
    ready: readyOrders,
  };

  // ── Loading / Access denied ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-saffron animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-error-bg flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-error" />
        </div>
        <h1 className="font-syne font-bold text-2xl text-ink">Access Denied</h1>
        <p className="text-sm text-ink-secondary max-w-xs">
          You need to be a store owner, manager, or sales agent to access this dashboard.
        </p>
        <button
          onClick={handleSignOut}
          className="mt-2 h-[44px] px-6 bg-surface-raised border border-border rounded-xl text-sm font-medium text-ink-secondary hover:text-error hover:border-error transition-colors flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "new",     label: "New",      count: newOrders.length },
    { key: "packing", label: "Packing",  count: packingOrders.length },
    { key: "ready",   label: "Ready",    count: readyOrders.length },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-lg mx-auto">

      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-surface-raised border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark */}
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="shrink-0">
              <rect width="40" height="40" rx="8" fill="#F4631E" />
              <path d="M26 14L14 26" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span className="font-syne font-bold text-base text-ink truncate">
              {seller?.shop_name ?? "Your Store"}
            </span>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${roleBadgeStyle(role)}`}>
              {roleLabel(role)}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-ink-muted text-sm hover:text-error transition-colors shrink-0 ml-2"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 px-4 pt-5 pb-8 space-y-5">

        {/* Stats Row */}
        <div className="flex gap-2.5">
          <StatCard label="New Orders"  value={newOrders.length}     icon={ShoppingBag} active={newOrders.length > 0} />
          <StatCard label="Packing"     value={packingOrders.length} icon={Package}     active={packingOrders.length > 0} />
          <StatCard label="Ready"        value={readyOrders.length}   icon={Truck}       active={readyOrders.length > 0} />
        </div>

        {/* Tab Bar */}
        <div className="flex bg-surface-raised border border-border rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-[40px] rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-saffron text-white shadow-sm"
                  : "text-ink-secondary hover:text-ink hover:bg-surface"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  tab === t.key ? "bg-white/25 text-white" : "bg-surface text-ink-secondary"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Refresh hint */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {tabOrders[tab].length === 0
              ? "No orders in this queue"
              : `${tabOrders[tab].length} order${tabOrders[tab].length > 1 ? "s" : ""}`}
          </p>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-saffron transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Order Cards */}
        {tabOrders[tab].length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {tab === "new" && <ShoppingBag className="w-12 h-12 text-ink-muted mb-3" strokeWidth={1.5} />}
            {tab === "packing" && <Package className="w-12 h-12 text-ink-muted mb-3" strokeWidth={1.5} />}
            {tab === "ready" && <Truck className="w-12 h-12 text-ink-muted mb-3" strokeWidth={1.5} />}
            <p className="text-sm text-ink-secondary">
              {tab === "new" && "No new orders. Check back soon!"}
              {tab === "packing" && "Nothing being packed right now."}
              {tab === "ready" && "No orders waiting for pickup yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tabOrders[tab].map(order => (
              <OrderCard
                key={order.id}
                order={order}
                tab={tab}
                onAction={handleAction}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
