"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Image from "next/image";
import {
  Loader2, Truck, Package, CheckCircle2, LogOut,
  AlertTriangle, Clock, RefreshCw, ChevronDown, X
} from "lucide-react";
import { toast } from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────────────────

type DeliveryStatus =
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery";

type Product = {
  id: string;
  name: string;
  photo_url: string;
};

type Order = {
  id: string;
  buyer_name: string;
  buyer_telegram_id: string;
  amount: number;
};

type DeliveryRecord = {
  id: string;
  order_id: string;
  status: DeliveryStatus;
  otp: string | null;
  otp_attempts: number;
  packed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  agent_id: string | null;
  order: Order;
  product: Product | null;
};

type AgentRole = "owner" | "manager" | "delivery_agent";

// ─── Constants ──────────────────────────────────────────────────────────────

const FAILURE_REASONS = [
  "Customer not available",
  "Wrong address",
  "Customer refused delivery",
  "Other",
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function relativeTime(isoString: string | null): string {
  if (!isoString) return "—";
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
    case "owner":          return "bg-saffron/15 text-saffron";
    case "manager":        return "bg-blue-100 text-blue-700";
    case "delivery_agent": return "bg-purple-100 text-purple-700";
  }
}

function roleLabel(role: AgentRole): string {
  switch (role) {
    case "owner":          return "Owner";
    case "manager":        return "Manager";
    case "delivery_agent": return "Delivery Agent";
  }
}

// ─── Failed Delivery Modal ──────────────────────────────────────────────────

function FailedDeliveryModal({
  onClose, onConfirm, loading
}: {
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState(FAILURE_REASONS[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface-raised w-full max-w-sm rounded-2xl shadow-xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-syne font-bold text-base text-ink">Report Failed Delivery</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Reason selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Reason</label>
            <div className="relative">
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full h-[48px] pl-4 pr-10 bg-surface border border-border rounded-xl text-sm text-ink appearance-none focus:border-saffron outline-none"
              >
                {FAILURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            </div>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Notes <span className="text-ink-muted font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details…"
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-ink resize-none focus:border-saffron outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={() => onConfirm(reason, notes)}
              disabled={loading}
              className="w-full h-[52px] bg-error text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Failed Delivery"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full h-[44px] bg-surface border border-border rounded-xl text-sm font-medium text-ink-secondary hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OTP Input ──────────────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null)); // eslint-disable-line react-hooks/rules-of-hooks

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i] === "" && i > 0) refs[i - 1].current?.focus();
      const next = [...digits];
      next[i] = "";
      onChange(next.join(""));
    }
  };

  const handleChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = ch;
    onChange(next.join(""));
    if (ch && i < 5) refs[i + 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text.padEnd(6, "").slice(0, 6));
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className={`w-11 h-14 text-center text-2xl font-jetbrains-mono font-bold rounded-xl border-2 bg-surface outline-none transition-all ${
            d ? "border-saffron text-saffron" : "border-border text-ink"
          } focus:border-saffron focus:shadow-[0_0_0_3px_rgba(244,99,30,0.12)]`}
        />
      ))}
    </div>
  );
}

// ─── Order Cards ─────────────────────────────────────────────────────────────

function ReadyCard({
  record, onAction
}: {
  record: DeliveryRecord;
  onAction: (deliveryId: string, action: "pick_up") => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden bg-surface shrink-0">
            {record.product?.photo_url ? (
              <Image src={record.product.photo_url} alt={record.product.name} fill className="object-cover" sizes="60px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-ink-muted" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-ink truncate">{record.product?.name ?? "Unknown"}</p>
            <p className="text-xs text-ink-secondary mt-0.5">
              Buyer: <span className="font-medium text-ink">{record.order.buyer_name}</span>
            </p>
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-ink-muted">
              <Clock className="w-3 h-3" />
              <span>Packed {relativeTime(record.packed_at)}</span>
            </div>
          </div>
          <span className="font-jetbrains-mono font-bold text-sm text-saffron shrink-0">
            ₹{record.order.amount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={async () => { setLoading(true); await onAction(record.id, "pick_up"); setLoading(false); }}
          disabled={loading}
          className="w-full h-[52px] bg-saffron text-white rounded-xl font-semibold text-[15px] hover:bg-saffron-dark hover:shadow-saffron disabled:opacity-60 flex items-center justify-center gap-2 transition-all duration-200"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5" /> Pick Up Order</>}
        </button>
      </div>
    </div>
  );
}

function OutForDeliveryCard({
  record, onAction
}: {
  record: DeliveryRecord;
  onAction: (deliveryId: string, action: "confirm_delivery" | "report_failed", extras?: Record<string, string>) => Promise<{ wrong_otp?: boolean; locked?: boolean; attempts_left?: number; error?: string } | undefined>;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedModal, setFailedModal] = useState(false);
  const [failLoading, setFailLoading] = useState(false);
  const [locked, setLocked] = useState((record.otp_attempts ?? 0) >= 3);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (otp.length < 6) { toast.error("Enter all 6 digits"); return; }
    setLoading(true);
    setOtpError(null);
    const result = await onAction(record.id, "confirm_delivery", { otp });
    if (result?.wrong_otp) {
      setOtpError(`Wrong OTP. ${result.attempts_left} attempt${result.attempts_left !== 1 ? "s" : ""} remaining.`);
      setOtp("");
      if ((result.attempts_left ?? 0) <= 0) setLocked(true);
    }
    if (result?.locked) {
      setLocked(true);
      setOtpError("Too many wrong attempts. Please contact the customer directly.");
    }
    setLoading(false);
  };

  const handleFailed = async (reason: string, notes: string) => {
    setFailLoading(true);
    await onAction(record.id, "report_failed", { reason, notes });
    setFailedModal(false);
    setFailLoading(false);
  };

  return (
    <>
      {failedModal && (
        <FailedDeliveryModal
          onClose={() => setFailedModal(false)}
          onConfirm={handleFailed}
          loading={failLoading}
        />
      )}

      <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4">
          {/* Order summary */}
          <div className="flex gap-3 mb-4">
            <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden bg-surface shrink-0">
              {record.product?.photo_url ? (
                <Image src={record.product.photo_url} alt={record.product.name} fill className="object-cover" sizes="60px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-ink-muted" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink truncate">{record.product?.name ?? "Unknown"}</p>
              <p className="text-xs text-ink-secondary mt-0.5">
                Buyer: <span className="font-medium text-ink">{record.order.buyer_name}</span>
              </p>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-ink-muted">
                <Clock className="w-3 h-3" />
                <span>Picked up {relativeTime(record.picked_up_at)}</span>
              </div>
            </div>
            <span className="font-jetbrains-mono font-bold text-sm text-saffron shrink-0">
              ₹{record.order.amount.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-4" />

          {/* OTP Section */}
          {locked ? (
            <div className="bg-error-bg border border-error/20 rounded-xl p-4 text-center mb-3">
              <AlertTriangle className="w-5 h-5 text-error mx-auto mb-2" />
              <p className="text-sm font-medium text-error">Too many wrong attempts</p>
              <p className="text-xs text-ink-secondary mt-1">Please contact the customer directly.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-ink-secondary text-center mb-3 uppercase tracking-wider">Enter Customer OTP</p>
              <OtpInput value={otp} onChange={setOtp} />
              {otpError && (
                <p className="text-xs text-error text-center mt-2.5 font-medium">{otpError}</p>
              )}
              <button
                onClick={handleConfirm}
                disabled={loading || otp.length < 6}
                className="w-full h-[52px] mt-4 bg-saffron text-white rounded-xl font-semibold text-[15px] hover:bg-saffron-dark hover:shadow-saffron disabled:opacity-60 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirm Delivery</>}
              </button>
            </>
          )}

          {/* Report failed link */}
          <button
            onClick={() => setFailedModal(true)}
            className="w-full mt-3 h-[42px] text-error text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-error-bg rounded-xl transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Failed Delivery
          </button>
        </div>
      </div>
    </>
  );
}

function CompletedCard({ record }: { record: DeliveryRecord }) {
  return (
    <div className="bg-surface-raised border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-ink truncate">{record.product?.name ?? "Unknown"}</p>
        <p className="text-xs text-ink-secondary">{record.order.buyer_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-jetbrains-mono font-bold text-sm text-saffron">₹{record.order.amount.toLocaleString("en-IN")}</p>
        <p className="text-[11px] text-ink-muted mt-0.5">{relativeTime(record.delivered_at)}</p>
      </div>
    </div>
  );
}

// ─── Stats Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-3.5 border text-center ${value > 0 ? `${color} shadow-sm` : "bg-surface-raised border-border"}`}>
      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${value > 0 ? "text-current opacity-70" : "text-ink-muted"}`} />
      <p className="font-syne font-bold text-2xl">{value}</p>
      <p className="text-[10px] uppercase tracking-wider mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

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
        // Return structured error for OTP handling instead of throwing
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

  // ── Today filter for completed ─────────────────────────────────────────────
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

  // ── Access denied ────────────────────────────────────────────────────────
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
          <StatCard label="Ready"       value={readyRecords.length}   icon={Package}         color="bg-warning-bg border-warning/20 text-warning" />
          <StatCard label="En Route"    value={outRecords.length}     icon={Truck}           color="bg-info-bg border-info/20 text-info" />
          <StatCard label="Delivered"   value={completedToday.length} icon={CheckCircle2}    color="bg-success-bg border-success/20 text-success" />
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
