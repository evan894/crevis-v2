"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { ShoppingBag, Wallet, PackageOpen, TrendingUp, AlertTriangle, X, MessageSquare, Users, Link2, Copy, Store, QrCode, Download, RefreshCw } from "lucide-react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────

type DeliveryStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery"
  | null;

type OrderRow = {
  id: string;
  buyer_name: string;
  amount: number;
  platform_fee: number;
  status: string;
  created_at: string;
  products: { name: string } | null;
  delivery_orders: { status: DeliveryStatus; agent_id: string | null } | null;
};

type TeamMember = {
  user_id: string;
  display_name: string;
  role: string;
  activity_count: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const DELIVERY_LABELS: Record<string, string> = {
  pending:          "Awaiting packing",
  confirmed:        "Confirmed",
  packed:           "Packed, awaiting pickup",
  out_for_delivery: "Out for delivery",
  delivered:        "Delivered ✅",
  failed_delivery:  "Failed ❌",
};

const DELIVERY_BADGE: Record<string, string> = {
  pending:          "bg-surface text-ink-muted border-border",
  confirmed:        "bg-warning-bg text-warning-content border-warning/30",
  packed:           "bg-blue-50 text-blue-700 border-blue-200",
  out_for_delivery: "bg-info-bg text-info border-info/30",
  delivered:        "bg-success-bg text-success border-success/30",
  failed_delivery:  "bg-error-bg text-error border-error/30",
};

function deliveryBadge(status: DeliveryStatus) {
  const s = status ?? "pending";
  const cls = DELIVERY_BADGE[s] ?? "bg-surface text-ink-muted border-border";
  const label = DELIVERY_LABELS[s] ?? s;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm animate-pulse">
       <div className="h-8 w-8 bg-surface rounded-full mb-4"></div>
       <div className="h-4 w-24 bg-surface rounded mb-2"></div>
       <div className="h-8 w-16 bg-surface rounded"></div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [isOwnerOrManager, setIsOwnerOrManager] = useState(false);
  const [shopSlug, setShopSlug] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const [stats, setStats] = useState({
     shopName: "",
     totalOrders: 0,
     creditBalance: 0,
     activeListings: 0,
     totalEarnings: 0
  });

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [teamActivity, setTeamActivity] = useState<TeamMember[]>([]);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [pulseOrders, setPulseOrders] = useState(false);

  const fetchOrders = async (sid: string) => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, products(name), delivery_orders(status, agent_id)")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });

    if (ordersData) {
      setOrders(ordersData as unknown as OrderRow[]);
      return ordersData;
    }
    return [];
  };

  const fetchTeamActivity = async (sid: string) => {
    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch members of this store
    const { data: members } = await supabase
      .from("store_members")
      .select("user_id, role")
      .eq("seller_id", sid)
      .eq("is_active", true)
      .neq("role", "owner"); // owners don't need activity tracking

    if (!members || members.length === 0) return;

    // Fetch today's packed delivery_orders (for sales agents)
    const { data: packedToday } = await supabase
      .from("delivery_orders")
      .select("agent_id, packed_at")
      .not("packed_at", "is", null)
      .gte("packed_at", todayStart.toISOString());

    // Fetch today's delivered delivery_orders (for delivery agents)
    const { data: deliveredToday } = await supabase
      .from("delivery_orders")
      .select("agent_id, delivered_at")
      .not("delivered_at", "is", null)
      .gte("delivered_at", todayStart.toISOString());

    // Tally per user
    const activityMap: Record<string, number> = {};
    (packedToday ?? []).forEach(d => {
      if (d.agent_id) activityMap[d.agent_id] = (activityMap[d.agent_id] ?? 0) + 1;
    });
    (deliveredToday ?? []).forEach(d => {
      if (d.agent_id) activityMap[d.agent_id] = (activityMap[d.agent_id] ?? 0) + 1;
    });

    // Fetch display names from auth
    const memberActivity: TeamMember[] = await Promise.all(
      members.map(async (m) => {
        const { data: u } = await supabase
          .from("store_members")
          .select("user_id, role")
          .eq("user_id", m.user_id)
          .single();
        // Get email/name from sellers table if they are also a seller, else fallback
        const { data: s } = await supabase
          .from("sellers")
          .select("shop_name")
          .eq("user_id", m.user_id)
          .maybeSingle();
        return {
          user_id: m.user_id,
          display_name: s?.shop_name ?? `User (${m.role})`,
          role: u?.role ?? m.role,
          activity_count: activityMap[m.user_id] ?? 0,
        };
      })
    );

    setTeamActivity(memberActivity);
  };

  useEffect(() => {
    const fetchStats = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return;

       const { data: seller } = await supabase
         .from("sellers")
         .select("id, shop_name, shop_slug, credit_balance, slack_user_id, qr_code_url")
         .eq("user_id", user.id)
         .single();
       if (!seller) return;

       setShopSlug(seller.shop_slug || "");
       setQrCodeUrl(seller.qr_code_url || null);

       setSellerId(seller.id);
       setSlackConnected(!!seller.slack_user_id);

       // Check role for team activity section
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

       let tEarnings = 0;
       let tOrders = 0;
       tOrders = ordersData.length;
       tEarnings = (ordersData as {status: string; amount: number}[])
         .filter(o => o.status === "completed")
         .reduce((sum, o) => sum + o.amount, 0);

       setStats({
          shopName: seller.shop_name,
          totalOrders: tOrders,
          creditBalance: seller.credit_balance,
          activeListings: activeListings || 0,
          totalEarnings: tEarnings
       });

       if (seller.credit_balance < 20) {
          const dismissed = sessionStorage.getItem("crevis_credit_warning_dismissed");
          if (!dismissed) setShowCreditWarning(true);
       }

       if (canSeeTeam) {
         await fetchTeamActivity(seller.id);
       }

       setLoading(false);
    };
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Realtime orders subscription
  useEffect(() => {
    if (!sellerId) return;

    const channel = supabase
      .channel("realtime_orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${sellerId}` },
        async (payload) => {
           const freshOrders = await fetchOrders(sellerId);
           const tOrders = freshOrders.length;
           const tEarnings = (freshOrders as {status: string; amount: number}[])
             .filter(o => o.status === "completed")
             .reduce((sum, o) => sum + o.amount, 0);

           setStats(prev => ({ ...prev, totalOrders: tOrders, totalEarnings: tEarnings }));

           if (payload.eventType === "INSERT") {
              setPulseOrders(true);
              setTimeout(() => setPulseOrders(false), 1000);
           }
        }
      )
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
      setTimeout(() => {
         btn.innerHTML = original;
         btn.classList.remove("text-success");
      }, 2000);
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
    } catch (err: unknown) {
       console.error(err);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const roleLabel = (role: string) => {
    switch (role) {
      case "manager":       return "Manager";
      case "sales_agent":   return "Sales Agent";
      case "delivery_agent": return "Delivery Agent";
      default: return role;
    }
  };

  return (
    <div className="min-h-full pb-24 md:pb-12 bg-surface selection:bg-saffron selection:text-surface-raised">

      {/* Low Credit Warning Banner */}
      {showCreditWarning && (
         <div className="bg-warning-bg border-b border-warning/20 px-6 py-3 flex items-center justify-between text-warning-content animate-in slide-in-from-top-5">
            <div className="flex items-center gap-3">
               <AlertTriangle className="w-5 h-5 text-warning" />
               <p className="text-sm font-medium">Low balance: You have <strong>{stats.creditBalance}</strong> credits remaining. Operations may halt soon.</p>
            </div>
            <div className="flex items-center gap-4">
               <Link href="/wallet" className="text-sm font-bold text-warning underline hover:opacity-80">Recharge now</Link>
               <button onClick={dismissWarning} className="opacity-70 hover:opacity-100 transition-opacity">
                  <X className="w-4 h-4" />
               </button>
            </div>
         </div>
      )}

      {/* Top Header */}
      <header className="px-6 py-8 md:py-10 border-b border-border bg-surface-raised flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               {loading ? (
                   <div className="h-8 w-64 bg-surface animate-pulse rounded"></div>
               ) : (
                   <h1 className="font-syne text-3xl font-bold text-ink">
                      {greeting}, <span className="text-saffron">{stats.shopName}</span>
                   </h1>
               )}
               <p className="text-ink-secondary text-sm mt-2">Here&apos;s what&apos;s happening with your store today.</p>
            </div>
            {!loading && !slackConnected && sellerId && (
               <a
                 href={`/api/auth/slack?sellerId=${sellerId}`}
                 className="inline-flex items-center gap-2 bg-[var(--color-saffron)] hover:bg-[var(--color-saffron-dark)] text-white px-4 py-2 rounded font-medium text-sm transition-colors border border-transparent"
               >
                 <MessageSquare className="w-4 h-4" />
                 Connect Slack
               </a>
            )}
            {!loading && slackConnected && (
               <div className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded font-medium text-sm border border-success/20">
                 <MessageSquare className="w-4 h-4" />
                 Slack Connected
               </div>
            )}
         </div>
      </header>

      {/* Main Content Area */}
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
               {/* Shop link row */}
               <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
                 <Link2 className="w-3.5 h-3.5 text-saffron shrink-0" />
                 <span className="font-dm-sans text-xs text-ink truncate flex-1">
                   {(process.env.NEXT_PUBLIC_APP_URL || "https://crevis-v2.vercel.app")}/s/{shopSlug}
                 </span>
                 <div className="flex items-center gap-2 shrink-0 border-l border-border pl-2 ml-1">
                    <button
                      id="copy-shoplink"
                      onClick={() => handleCopyDashboard(`${process.env.NEXT_PUBLIC_APP_URL || "https://crevis-v2.vercel.app"}/s/${shopSlug}`, "shoplink")}
                      className="text-[11px] font-medium text-ink-secondary hover:text-saffron transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="text-[11px] font-medium text-ink-secondary hover:text-saffron transition-colors flex items-center gap-1"
                    >
                      <QrCode className="w-3 h-3" /> QR
                    </button>
                 </div>
               </div>
               {/* Bot handle row */}
               <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
                 <span className="text-xs shrink-0">🤖</span>
                 <span className="font-dm-sans text-xs text-ink truncate flex-1">@Crevis_shop_bot</span>
                 <button
                   id="copy-bothandle"
                   onClick={() => handleCopyDashboard("@Crevis_shop_bot", "bothandle")}
                   className="shrink-0 text-[11px] font-medium text-ink-secondary hover:text-saffron transition-colors flex items-center gap-1"
                 >
                   <Copy className="w-3 h-3" /> Copy
                 </button>
               </div>
             </div>
           </div>
         )}

         {/* Stats Grid */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
               <>
                 <SkeletonCard />
                 <SkeletonCard />
                 <SkeletonCard />
                 <SkeletonCard />
               </>
            ) : (
               <>
                  <div className={`bg-surface-raised border border-border rounded-xl p-6 shadow-sm group transition-all duration-500 ${pulseOrders ? "bg-saffron/5 shadow-saffron scale-[1.02] border-saffron" : "hover:shadow"}`}>
                     <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center mb-4 group-hover:bg-saffron transition-colors">
                        <ShoppingBag className="w-5 h-5 text-saffron group-hover:text-surface-raised transition-colors" />
                     </div>
                     <h3 className="text-sm font-medium text-ink-secondary mb-1">Total Orders</h3>
                     <p className="text-3xl font-jetbrains-mono font-bold text-ink">{stats.totalOrders}</p>
                  </div>

                  <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm hover:shadow transition-shadow group">
                     <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center mb-4 group-hover:bg-success transition-colors">
                        <TrendingUp className="w-5 h-5 text-success group-hover:text-surface-raised transition-colors" />
                     </div>
                     <h3 className="text-sm font-medium text-ink-secondary mb-1">Total Earnings</h3>
                     <p className="text-3xl font-jetbrains-mono font-bold text-ink">
                       <span className="text-xl text-ink-muted mr-1">₹</span>
                       {stats.totalEarnings.toLocaleString("en-IN")}
                     </p>
                  </div>

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

         {/* Orders Table */}
         <div className="space-y-4">
            <h2 className="font-syne font-bold text-2xl text-ink">Recent Orders</h2>

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
                                <td className="px-6 py-4 text-sm font-medium text-ink">
                                   {order.products?.name ?? "Unknown Item"}
                                </td>
                                <td className="px-6 py-4 text-sm text-ink-secondary">
                                   {order.buyer_name}
                                </td>
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

         {/* Team Activity — owners and managers only */}
         {isOwnerOrManager && !loading && (
           <div className="space-y-4">
             <div className="flex items-center gap-3">
               <Users className="w-5 h-5 text-ink-muted" />
               <h2 className="font-syne font-bold text-2xl text-ink">Team Activity Today</h2>
             </div>

             <div className="bg-surface-raised border border-border rounded-xl overflow-hidden shadow-sm">
               {teamActivity.length === 0 ? (
                 <div className="py-12 text-center text-sm text-ink-secondary">
                   No team members yet — <Link href="/team" className="text-saffron hover:underline">add members</Link> to see their activity here.
                 </div>
               ) : (
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-surface text-ink-muted border-b border-border">
                       <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Member</th>
                       <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Role</th>
                       <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-center">Orders Today</th>
                     </tr>
                   </thead>
                   <tbody>
                     {teamActivity.map((m) => (
                       <tr key={m.user_id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-saffron/10 flex items-center justify-center text-saffron text-xs font-bold">
                               {m.display_name.slice(0, 2).toUpperCase()}
                             </div>
                             <span className="text-sm font-medium text-ink">{m.display_name}</span>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-surface border border-border text-ink-secondary">
                             {roleLabel(m.role)}
                           </span>
                         </td>
                         <td className="px-6 py-4 text-center">
                           <span className={`font-jetbrains-mono font-bold text-lg ${m.activity_count > 0 ? "text-saffron" : "text-ink-muted"}`}>
                             {m.activity_count}
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
           </div>
         )}

      </div>

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-surface-raised w-full max-w-sm rounded-xl shadow-lg border border-border flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-syne font-bold text-lg text-ink flex items-center gap-2">
                <QrCode className="w-5 h-5 text-saffron" />
                Store QR Code
              </h3>
              <button 
                onClick={() => setIsQrModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="bg-white p-4 rounded-xl border border-border w-full flex items-center justify-center min-h-[280px]">
                {qrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${qrCodeUrl}?t=${Date.now()}`} alt="Store QR Code" className="w-64 h-64 select-none pointer-events-none" />
                ) : (
                  <div className="text-center text-ink-muted flex flex-col items-center gap-2">
                    <QrCode className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium">QR not generated yet</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleDownloadQr}
                  disabled={!qrCodeUrl || isGeneratingQr}
                  className="w-full h-11 bg-ink text-surface-raised font-bold text-sm rounded flex items-center justify-center gap-2 hover:bg-ink-secondary active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  <Download className="w-4 h-4" /> Download QR 
                </button>
                <button
                  onClick={handleRegenerateQr}
                  disabled={isGeneratingQr}
                  className="w-full h-11 bg-surface border border-border text-ink font-bold text-sm rounded flex items-center justify-center gap-2 hover:bg-surface-raised active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  <RefreshCw className={`w-4 h-4 ${isGeneratingQr ? "animate-spin" : ""}`} /> 
                  {isGeneratingQr ? "Regenerating..." : "Regenerate QR"}
                </button>
              </div>

              <p className="text-xs text-ink-muted text-center leading-relaxed">
                <strong className="text-ink-secondary">Warning:</strong> Regenerating will invalidate any previously printed QR codes for this store.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
