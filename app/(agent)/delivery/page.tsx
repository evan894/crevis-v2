"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import {
  Loader2, Truck, Package, CheckCircle2, LogOut, AlertTriangle, RefreshCw
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  type AgentRole, type DeliveryRecord, type DeliveryStatus,
  roleBadgeStyle, roleLabel
} from "./_components/types";
import { StatCard } from "./_components/StatCard";
import { ReadyCard, OutForDeliveryCard, CompletedCard } from "./_components/DeliveryCards";

type TabKey = "ready" | "out_for_delivery" | "completed";

export default function DeliveryPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [role, setRole] = useState<AgentRole>("delivery_agent");
  const [shopName, setShopName] = useState("Your Store");
  const [tab, setTab] = useState<TabKey>("ready");
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/delivery/orders");
      if (res.status === 403) { setAccessDenied(true); return; }
      if (!res.ok) return;
      const data = await res.json();
      setRecords(data.orders ?? []);
      setRole(data.role ?? "delivery_agent");
    } catch {
      toast.error("Failed to load delivery orders");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/auth"; return; }

      const { data: sellerData } = await supabase
        .from("sellers")
        .select("shop_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (sellerData?.shop_name) setShopName(sellerData.shop_name);

      await fetchOrders();
      setLoading(false);
    };
    init();
  }, [supabase, fetchOrders]);

  const handleAction = useCallback(async (
    deliveryId: string,
    action: "pick_up" | "confirm_delivery" | "report_failed",
    extras?: Record<string, string>
  ) => {
    try {
      const res = await fetch(`/api/delivery/orders/${deliveryId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extras }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.wrong_otp || data.locked) return data;
        toast.error(data.error ?? "Action failed");
        return data;
      }

      const messages: Record<string, string> = {
        pick_up:          "Order picked up! Buyer notified 🛵",
        confirm_delivery: "✅ Delivery confirmed! Great work.",
        report_failed:    "Failed delivery reported. Buyer notified.",
      };
      toast.success(messages[action] ?? "Done");

      // Optimistic update
      setRecords(prev => prev.map(r => {
        if (r.id !== deliveryId) return r;
        if (action === "pick_up")          return { ...r, status: "out_for_delivery" as DeliveryStatus, picked_up_at: new Date().toISOString() };
        if (action === "confirm_delivery") return { ...r, status: "delivered" as DeliveryStatus, delivered_at: new Date().toISOString() };
        if (action === "report_failed")    return { ...r, status: "failed_delivery" as DeliveryStatus };
        return r;
      }));

      if (action === "pick_up")          setTab("out_for_delivery");
      if (action === "confirm_delivery") setTab("completed");

      return undefined;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      return undefined;
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const readyRecords    = records.filter(r => r.status === "packed");
  const outRecords      = records.filter(r => r.status === "out_for_delivery");
  const completedToday  = records.filter(r =>
    r.status === "delivered" && r.delivered_at && new Date(r.delivered_at) >= todayStart
  );

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "ready",            label: "Ready",             count: readyRecords.length },
    { key: "out_for_delivery", label: "Out for Delivery",  count: outRecords.length },
    { key: "completed",        label: "Completed",         count: completedToday.length },
  ];

  const tabRecords: Record<TabKey, DeliveryRecord[]> = {
    ready:            readyRecords,
    out_for_delivery: outRecords,
    completed:        completedToday,
  };

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
          You need to be a store owner, manager, or delivery agent to access this dashboard.
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

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-lg mx-auto">

      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-surface-raised border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="shrink-0">
              <rect width="40" height="40" rx="8" fill="#F4631E" />
              <path d="M26 14L14 26" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span className="font-syne font-bold text-base text-ink truncate">{shopName}</span>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${roleBadgeStyle(role)}`}>
              {roleLabel(role)}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-ink-muted text-sm hover:text-error transition-colors shrink-0 ml-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 px-4 pt-5 pb-8 space-y-5">

        {/* Stats Row */}
        <div className="flex gap-2.5">
          <StatCard label="Ready"     value={readyRecords.length}   icon={Package}      color="bg-warning-bg border-warning/20 text-warning" />
          <StatCard label="En Route"  value={outRecords.length}     icon={Truck}        color="bg-info-bg border-info/20 text-info" />
          <StatCard label="Delivered" value={completedToday.length} icon={CheckCircle2} color="bg-success-bg border-success/20 text-success" />
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-raised border border-border rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-[40px] rounded-lg text-sm font-medium transition-all truncate ${
                tab === t.key
                  ? "bg-saffron text-white shadow-sm"
                  : "text-ink-secondary hover:text-ink hover:bg-surface"
              }`}
            >
              <span className="truncate">{t.label}</span>
              {t.count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0 ${
                  tab === t.key ? "bg-white/25 text-white" : "bg-surface text-ink-secondary"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {tabRecords[tab].length === 0 ? "Nothing here" : `${tabRecords[tab].length} order${tabRecords[tab].length > 1 ? "s" : ""}`}
          </p>
          <button onClick={fetchOrders} className="flex items-center gap-1 text-xs text-ink-muted hover:text-saffron transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Order cards */}
        {tabRecords[tab].length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {tab === "ready"            && <Package      className="w-12 h-12 text-ink-muted mb-3" strokeWidth={1.5} />}
            {tab === "out_for_delivery" && <Truck        className="w-12 h-12 text-ink-muted mb-3" strokeWidth={1.5} />}
            {tab === "completed"        && <CheckCircle2 className="w-12 h-12 text-ink-muted mb-3" strokeWidth={1.5} />}
            <p className="text-sm text-ink-secondary">
              {tab === "ready"            && "No orders packed yet. Check back soon!"}
              {tab === "out_for_delivery" && "Nothing out for delivery right now."}
              {tab === "completed"        && "No deliveries completed today yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tab === "ready" && tabRecords[tab].map(r => (
              <ReadyCard key={r.id} record={r} onAction={handleAction} />
            ))}
            {tab === "out_for_delivery" && tabRecords[tab].map(r => (
              <OutForDeliveryCard key={r.id} record={r} onAction={handleAction} />
            ))}
            {tab === "completed" && tabRecords[tab].map(r => (
              <CompletedCard key={r.id} record={r} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
