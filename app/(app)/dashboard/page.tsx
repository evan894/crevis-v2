"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { ShoppingBag, Wallet, PackageOpen, TrendingUp, AlertTriangle, X, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Database } from "@/types/database.types";

function SkeletonCard() {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm animate-pulse">
       <div className="h-8 w-8 bg-surface rounded-full mb-4"></div>
       <div className="h-4 w-24 bg-surface rounded mb-2"></div>
       <div className="h-8 w-16 bg-surface rounded"></div>
    </div>
  );
}

type OrderWithProduct = Database["public"]["Tables"]["orders"]["Row"] & {
   products: { name: string } | null;
};

export default function DashboardPage() {
  const supabase = createBrowserClient();
  
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  
  const [stats, setStats] = useState({
     shopName: "",
     totalOrders: 0,
     creditBalance: 0,
     activeListings: 0,
     totalEarnings: 0
  });

  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [pulseOrders, setPulseOrders] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return;
       
       const { data: seller } = await supabase.from('sellers').select('id, shop_name, credit_balance, slack_user_id').eq('user_id', user.id).single();
       if (!seller) return;
       
       setSellerId(seller.id);
       setSlackConnected(!!seller.slack_user_id);

       const { count: activeListings } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', seller.id).eq('active', true);
       
       // Note: the joined column from foreign key must match Supabase syntax
       const { data: ordersData } = await supabase
         .from('orders')
         .select('*, products(name)')
         .eq('seller_id', seller.id)
         .order('created_at', { ascending: false });
       
       let tEarnings = 0;
       let tOrders = 0;
       if (ordersData) {
          setOrders(ordersData as OrderWithProduct[]);
          tOrders = ordersData.length;
          tEarnings = ordersData.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0);
       }

       setStats({
          shopName: seller.shop_name,
          totalOrders: tOrders,
          creditBalance: seller.credit_balance,
          activeListings: activeListings || 0,
          totalEarnings: tEarnings
       });

       if (seller.credit_balance < 20) {
          const dismissed = sessionStorage.getItem('crevis_credit_warning_dismissed');
          if (!dismissed) setShowCreditWarning(true);
       }

       setLoading(false);
    };
    fetchStats();
  }, [supabase]);

  // Realtime Orders subscription
  useEffect(() => {
    if (!sellerId) return;

    const channel = supabase
      .channel('realtime_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        async (payload) => {
           // We refetch the whole list to easily get the 'products(name)' join data correctly inline
           const { data: freshOrders } = await supabase
             .from('orders')
             .select('*, products(name)')
             .eq('seller_id', sellerId)
             .order('created_at', { ascending: false });

           if (freshOrders) {
              setOrders(freshOrders as OrderWithProduct[]);
              const tOrders = freshOrders.length;
              const tEarnings = freshOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0);

              setStats(prev => ({ ...prev, totalOrders: tOrders, totalEarnings: tEarnings }));
              
              if (payload.eventType === 'INSERT') {
                 // Trigger pulse animation
                 setPulseOrders(true);
                 setTimeout(() => setPulseOrders(false), 1000);
              }
           }
        }
      )
      .subscribe();

    return () => {
       supabase.removeChannel(channel);
    };
  }, [sellerId, supabase]);

  const dismissWarning = () => {
     sessionStorage.setItem('crevis_credit_warning_dismissed', '1');
     setShowCreditWarning(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

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
               <p className="text-ink-secondary text-sm mt-2">Here’s what’s happening with your store today.</p>
            </div>
            {!loading && !slackConnected && sellerId && (
               <a 
                 href={`/api/auth/slack?sellerId=${sellerId}`}
                 className="inline-flex items-center gap-2 bg-[#4A154B] hover:bg-[#3E113E] text-white px-4 py-2 rounded font-medium text-sm transition-colors border border-transparent"
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
                  {/* Total Orders */}
                  <div className={`bg-surface-raised border border-border rounded-xl p-6 shadow-sm group transition-all duration-500 ${pulseOrders ? 'bg-saffron/5 shadow-saffron scale-[1.02] border-saffron' : 'hover:shadow'}`}>
                     <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center mb-4 group-hover:bg-saffron transition-colors">
                        <ShoppingBag className="w-5 h-5 text-saffron group-hover:text-surface-raised transition-colors" />
                     </div>
                     <h3 className="text-sm font-medium text-ink-secondary mb-1">Total Orders</h3>
                     <p className="text-3xl font-jetbrains-mono font-bold text-ink">{stats.totalOrders}</p>
                  </div>

                  {/* Earnings */}
                  <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm hover:shadow transition-shadow group">
                     <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center mb-4 group-hover:bg-success transition-colors">
                        <TrendingUp className="w-5 h-5 text-success group-hover:text-surface-raised transition-colors" />
                     </div>
                     <h3 className="text-sm font-medium text-ink-secondary mb-1">Total Earnings</h3>
                     <p className="text-3xl font-jetbrains-mono font-bold text-ink">
                       <span className="text-xl text-ink-muted mr-1">₹</span>
                       {stats.totalEarnings.toLocaleString('en-IN')}
                     </p>
                  </div>

                  {/* Active Listings */}
                  <div className="bg-surface-raised border border-border rounded-xl p-6 shadow-sm hover:shadow transition-shadow group">
                     <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mb-4 group-hover:bg-ink transition-colors border border-border">
                        <PackageOpen className="w-5 h-5 text-ink-secondary group-hover:text-surface-raised transition-colors" />
                     </div>
                     <h3 className="text-sm font-medium text-ink-secondary mb-1">Active Listings</h3>
                     <p className="text-3xl font-jetbrains-mono font-bold text-ink">{stats.activeListings}</p>
                  </div>

                  {/* Credit Balance (Special Highlight) */}
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
                        <p className="text-sm text-ink-secondary max-w-sm mb-6">Share your Telegram bot link with customers to start processing sales. They will appear here instantly.</p>
                     </div>
                  ) : (
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-surface text-ink-muted border-b border-border">
                              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Item</th>
                              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Buyer</th>
                              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Amount</th>
                              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Fee</th>
                              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-center">Status</th>
                              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Time</th>
                           </tr>
                        </thead>
                        <tbody>
                           {orders.map((order) => {
                              let statusBadge = "bg-surface-raised text-ink-muted";
                              if (order.status === 'completed') statusBadge = "bg-success-bg text-success border-success/30";
                              if (order.status === 'pending') statusBadge = "bg-warning-bg text-warning-content border-warning/30";
                              if (order.status === 'failed') statusBadge = "bg-error-bg text-error border-error/30";
                              
                              return (
                                <tr key={order.id} className="border-b border-border hover:bg-surface/50 transition-colors last:border-0 group">
                                   <td className="px-6 py-4 text-sm font-medium text-ink">
                                      {order.products?.name || "Unknown Item"}
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
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge} capitalize`}>
                                         {order.status}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 text-right text-xs text-ink-muted whitespace-nowrap">
                                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </td>
                                </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  )}
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}
