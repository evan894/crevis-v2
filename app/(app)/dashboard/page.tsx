"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { ShoppingBag, Wallet, PackageOpen, TrendingUp, AlertTriangle, X, MessageSquare, Link2, Copy, Store, QrCode, RefreshCw } from "lucide-react";
import Link from "next/link";
import { QrModal } from "./_components/QrModal";
import { OrdersTable, type OrderRow } from "./_components/OrdersTable";
import { TeamActivity, type TeamMember } from "./_components/TeamActivity";

function SkeletonCard() {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm animate-pulse">
      <div className="h-8 w-8 bg-surface rounded-full mb-4" />
      <div className="h-4 w-24 bg-surface rounded mb-2" />
      <div className="h-8 w-16 bg-surface rounded" />
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [isOwnerOrManager, setIsOwnerOrManager] = useState(false);
  const [shopSlug, setShopSlug] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const [stats, setStats] = useState({
    shopName: "",
    totalOrders: 0,
    creditBalance: 0,
    activeListings: 0,
    totalEarnings: 0,
    gracePeriodStartedAt: null as string | null,
  });

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [teamActivity, setTeamActivity] = useState<TeamMember[]>([]);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [pulseOrders, setPulseOrders] = useState(false);

  const fetchOrders = async (sid: string) => {
    const { data } = await supabase
      .from("orders")
      .select("*, products(name), delivery_orders(status, agent_id)")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as unknown as OrderRow[]);
    return data ?? [];
  };

  const fetchTeamActivity = async (sid: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: members } = await supabase
      .from("store_members")
      .select("user_id, role")
      .eq("seller_id", sid)
      .eq("is_active", true)
      .neq("role", "owner");

    if (!members || members.length === 0) return;

    const [{ data: packedToday }, { data: deliveredToday }] = await Promise.all([
      supabase.from("delivery_orders").select("agent_id, packed_at").not("packed_at", "is", null).gte("packed_at", todayStart.toISOString()),
      supabase.from("delivery_orders").select("agent_id, delivered_at").not("delivered_at", "is", null).gte("delivered_at", todayStart.toISOString()),
    ]);

    const activityMap: Record<string, number> = {};
    (packedToday ?? []).forEach(d => { if (d.agent_id) activityMap[d.agent_id] = (activityMap[d.agent_id] ?? 0) + 1; });
    (deliveredToday ?? []).forEach(d => { if (d.agent_id) activityMap[d.agent_id] = (activityMap[d.agent_id] ?? 0) + 1; });

    const memberActivity: TeamMember[] = await Promise.all(
      members.map(async (m) => {
        const { data: s } = await supabase.from("sellers").select("shop_name").eq("user_id", m.user_id).maybeSingle();
        return {
          user_id: m.user_id,
          display_name: s?.shop_name ?? `User (${m.role})`,
          role: m.role,
          activity_count: activityMap[m.user_id] ?? 0,
        };
      })
    );
    setTeamActivity(memberActivity);
  };

  const refreshData = async (showLoading = false) => {
    if (showLoading) setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: seller } = await supabase
      .from("sellers")
      .select("id, shop_name, shop_slug, credit_balance, slack_user_id, qr_code_url, grace_period_started_at")
      .eq("user_id", user.id)
      .single();

    if (!seller) { setLoading(false); return; }

    setShopSlug(seller.shop_slug || "");
    setQrCodeUrl(seller.qr_code_url || null);
    setSellerId(seller.id);
    setSlackConnected(!!seller.slack_user_id);

    const { data: member } = await supabase
      .from("store_members")
      .select("role")
      .eq("seller_id", seller.id)
      .eq("user_id", user.id)
      .single();

    const canSeeTeam = member?.role === "owner" || member?.role === "manager";
    setIsOwnerOrManager(canSeeTeam);

    const { count: activeListings } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", seller.id)
      .eq("active", true);

    const ordersData = await fetchOrders(seller.id);
    const tEarnings = (ordersData as { status: string; amount: number }[])
      .filter(o => o.status === "completed")
      .reduce((sum, o) => sum + o.amount, 0);

    setStats({
      shopName: seller.shop_name,
      totalOrders: ordersData.length,
      creditBalance: seller.credit_balance,
      activeListings: activeListings || 0,
      totalEarnings: tEarnings,
      gracePeriodStartedAt: seller.grace_period_started_at,
    });

    if (seller.credit_balance < 50) {
      if (!sessionStorage.getItem("crevis_credit_warning_dismissed")) setShowCreditWarning(true);
    }

    if (canSeeTeam) await fetchTeamActivity(seller.id);
    setLoading(false);
  };

  useEffect(() => {
    refreshData(true);

    const channel = supabase
      .channel("dashboard_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        refreshData(false);
        setPulseOrders(true);
        setTimeout(() => setPulseOrders(false), 2000);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sellers" }, () => refreshData(false))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!sellerId) return;

    const channel = supabase
      .channel("realtime_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${sellerId}` }, async (payload) => {
        const fresh = await fetchOrders(sellerId);
        const tEarnings = (fresh as { status: string; amount: number }[])
          .filter(o => o.status === "completed")
          .reduce((sum, o) => sum + o.amount, 0);
        setStats(prev => ({ ...prev, totalOrders: fresh.length, totalEarnings: tEarnings }));
        if (payload.eventType === "INSERT") {
          setPulseOrders(true);
          setTimeout(() => setPulseOrders(false), 1000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const dismissWarning = () => {
    sessionStorage.setItem("crevis_credit_warning_dismissed", "1");
    setShowCreditWarning(false);
  };

  const handleCopyDashboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(`copy-${id}`);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = `<span class="flex items-center gap-1"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied</span>`;
      btn.classList.add("text-success");
      setTimeout(() => { btn.innerHTML = original; btn.classList.remove("text-success"); }, 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement("a");
    a.href = qrCodeUrl;
    a.download = `${shopSlug}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRegenerateQr = async () => {
    setIsGeneratingQr(true);
    try {
      const res = await fetch("/api/store/generate-qr", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate QR");
      setQrCodeUrl(data.qrUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-full pb-24 md:pb-12 bg-surface selection:bg-saffron selection:text-surface-raised">

      {/* Low Credit Warning */}
      {showCreditWarning && stats.creditBalance >= 0 && (
        <div className="bg-warning-bg border-b border-warning/20 px-6 py-3 flex items-center justify-between text-warning-content animate-in slide-in-from-top-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-sm font-medium">⚠️ Your balance is below 50 credits. You cannot list new products or boost listings. Your current listings are still active.</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/wallet" className="text-sm font-bold text-warning underline hover:opacity-80">Top Up Now &rarr;</Link>
            <button onClick={dismissWarning} className="opacity-70 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {showCreditWarning && stats.creditBalance < 0 && (
        <div className="bg-error-bg border-b border-error/20 px-6 py-3 flex items-center justify-between text-error animate-in slide-in-from-top-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-error" />
            <p className="text-sm font-medium">
              ❌ Your balance is negative. You have {
                stats.gracePeriodStartedAt
                  ? Math.max(0, 6 - Math.floor((Date.now() - new Date(stats.gracePeriodStartedAt).getTime()) / 86400000))
                  : 6
              } days to settle dues.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/wallet" className="text-sm font-bold text-error underline hover:opacity-80">Top Up Now &rarr;</Link>
            <button onClick={dismissWarning} className="opacity-70 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-8 md:py-10 border-b border-border bg-surface-raised flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {loading ? (
              <div className="h-8 w-64 bg-surface animate-pulse rounded" />
            ) : (
              <h1 className="font-syne text-3xl font-bold text-ink">
                {greeting}, <span className="text-saffron">{stats.shopName}</span>
              </h1>
            )}
            <p className="text-ink-secondary text-sm mt-2">Here&apos;s what&apos;s happening with your store today.</p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <button
                onClick={async () => { setIsRefreshing(true); await refreshData(false); router.refresh(); setTimeout(() => setIsRefreshing(false), 500); }}
                className="inline-flex items-center gap-2 bg-surface border border-border hover:border-saffron/50 text-ink-secondary hover:text-saffron px-4 py-2 rounded font-medium text-sm transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Syncing..." : "Sync"}
              </button>
            )}
            {!loading && !slackConnected && sellerId && (
              <a href={`/api/auth/slack?sellerId=${sellerId}`} className="inline-flex items-center gap-2 bg-saffron hover:bg-saffron-dark text-white px-4 py-2 rounded font-medium text-sm transition-colors">
                <MessageSquare className="w-4 h-4" /> Connect Slack
              </a>
            )}
            {!loading && slackConnected && (
              <div className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded font-medium text-sm border border-success/20">
                <MessageSquare className="w-4 h-4" /> Slack Connected
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">

        {/* Shop Card */}
        {!loading && shopSlug && (
          <div className="bg-surface-raised border border-border rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-saffron" />
              </div>
              <div>
                <p className="font-syne font-bold text-ink text-base leading-tight">{stats.shopName}</p>
                <p className="text-xs text-ink-muted font-dm-sans">Your store</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
                <Link2 className="w-3.5 h-3.5 text-saffron shrink-0" />
                <span className="font-dm-sans text-xs text-ink truncate flex-1">
                  {(process.env.NEXT_PUBLIC_APP_URL || "https://crevis-v2.vercel.app")}/s/{shopSlug}
                </span>
                <div className="flex items-center gap-2 shrink-0 border-l border-border pl-2 ml-1">
                  <button id="copy-shoplink" onClick={() => handleCopyDashboard(`${process.env.NEXT_PUBLIC_APP_URL || "https://crevis-v2.vercel.app"}/s/${shopSlug}`, "shoplink")}
                    className="text-[11px] font-medium text-ink-secondary hover:text-saffron transition-colors flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button onClick={() => setIsQrModalOpen(true)}
                    className="text-[11px] font-medium text-ink-secondary hover:text-saffron transition-colors flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> QR
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
                <span className="text-xs shrink-0">🤖</span>
                <span className="font-dm-sans text-xs text-ink truncate flex-1">@Crevis_shop_bot</span>
                <button id="copy-bothandle" onClick={() => handleCopyDashboard("https://t.me/Crevis_shop_bot", "bothandle")}
                  className="shrink-0 text-[11px] font-medium text-ink-secondary hover:text-saffron transition-colors flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <div className={`bg-surface-raised border border-border rounded-xl p-6 shadow-sm group transition-all duration-500 ${pulseOrders ? "bg-saffron/5 shadow-saffron scale-[1.02] border-saffron" : "hover:shadow"}`}>
                <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center mb-4 group-hover:bg-saffron transition-colors">
                  <ShoppingBag className="w-5 h-5 text-saffron group-hover:text-surface-raised transition-colors" />
                </div>
                <h3 className="text-sm font-medium text-ink-secondary mb-1">Total Orders</h3>
                <p className="text-3xl font-jetbrains-mono font-bold text-ink">{stats.totalOrders}</p>
              </div>

              <Link href="/analytics" className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm hover:shadow transition-shadow group cursor-pointer block">
                <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center mb-4 group-hover:bg-success transition-colors">
                  <TrendingUp className="w-5 h-5 text-success group-hover:text-surface-raised transition-colors" />
                </div>
                <h3 className="text-sm font-medium text-ink-secondary mb-1">Total Earnings</h3>
                <p className="text-3xl font-jetbrains-mono font-bold text-ink">
                  <span className="text-xl text-ink-muted mr-1">₹</span>
                  {stats.totalEarnings.toLocaleString("en-IN")}
                </p>
              </Link>

              <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm hover:shadow transition-shadow group">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mb-4 group-hover:bg-ink transition-colors border border-border">
                  <PackageOpen className="w-5 h-5 text-ink-secondary group-hover:text-surface-raised transition-colors" />
                </div>
                <h3 className="text-sm font-medium text-ink-secondary mb-1">Active Listings</h3>
                <p className="text-3xl font-jetbrains-mono font-bold text-ink">{stats.activeListings}</p>
              </div>

              <div className="bg-credit-light border border-border-strong rounded-xl p-6 shadow-credit relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Wallet className="w-24 h-24 text-credit" />
                </div>
                <div className="relative z-10 w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center mb-4 border border-border group-hover:bg-credit transition-colors">
                  <Wallet className="w-5 h-5 text-credit group-hover:text-surface-raised transition-colors" />
                </div>
                <h3 className="relative z-10 text-sm font-medium text-ink-secondary mb-1">Credit Balance</h3>
                <div className="relative z-10 flex items-baseline gap-3">
                  <p className="text-3xl font-jetbrains-mono font-bold text-credit">{stats.creditBalance}</p>
                  <Link href="/wallet" className="text-xs font-semibold text-credit bg-credit/10 hover:bg-credit hover:text-surface-raised transition-colors px-2 py-1 rounded">
                    Top up
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        <OrdersTable orders={orders} pulse={pulseOrders} />

        {isOwnerOrManager && !loading && (
          <TeamActivity members={teamActivity} />
        )}
      </div>

      <QrModal
        open={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrCodeUrl={qrCodeUrl}
        isGenerating={isGeneratingQr}
        onDownload={handleDownloadQr}
        onRegenerate={handleRegenerateQr}
      />
    </div>
  );
}
