"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";

type DeliveryOrder = {
  id: string;
  status: string;
  otp: string | null;
  orders: {
    id: string;
    buyer_name: string;
    amount: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selected_variant: any;
    created_at: string;
    products: {
      name: string;
    } | null;
  } | null;
};

export default function SalesAgentDashboard() {
  const [activeTab, setActiveTab] = useState<"pending" | "packing" | "packed">("pending");
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const fetchOrders = useCallback(async (sId: string) => {
    const { data, error } = await supabase
      .from('delivery_orders')
      .select(`
        id,
        status,
        otp,
        orders!inner (
          id,
          buyer_name,
          amount,
          selected_variant,
          created_at,
          products (
            name
          )
        )
      `)
      .eq('orders.seller_id', sId)
      .in('status', ['pending', 'packing', 'packed'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Failed to load orders");
    } else {
      setOrders((data as unknown as DeliveryOrder[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from("store_members")
          .select("seller_id")
          .eq("user_id", data.user.id)
          .eq("is_active", true)
          .single()
          .then((res) => {
             if (res.data?.seller_id) {
               setSellerId(res.data.seller_id);
               fetchOrders(res.data.seller_id);
             }
          });
      }
    });

    // Sub to delivery_orders changes
    const channel = supabase.channel('agent-delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, () => {
         if (sellerId) fetchOrders(sellerId);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, sellerId, fetchOrders]);

  const filteredOrders = orders.filter(o => o.status === activeTab);
  
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const packingCount = orders.filter(o => o.status === "packing").length;
  const packedCount = orders.filter(o => o.status === "packed").length;

  const startPacking = async (deliveryOrderId: string) => {
    setActionLoading(deliveryOrderId);
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === deliveryOrderId ? { ...o, status: "packing" } : o));
    
    const { error } = await supabase
      .from('delivery_orders')
      .update({ status: 'packing' })
      .eq('id', deliveryOrderId);
      
    if (error) {
      toast.error("Error updating status");
      if (sellerId) fetchOrders(sellerId);
    } else {
      setActiveTab("packing");
    }
    setActionLoading(null);
  };

  const markAsPacked = async (order: DeliveryOrder) => {
    if (!order.orders) return;
    setActionLoading(order.id);
    
    try {
      const res = await fetch("/api/agent/pack-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryOrderId: order.id })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to pack order");
      
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "packed", otp: data.otp } : o));
      setActiveTab("packed");
      toast.success("Order packed! Notifications sent.");
    } catch(err: unknown) {
      toast.error((err as Error).message);
      if (sellerId) fetchOrders(sellerId);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col w-full h-full pb-6">
      {/* Tabs */}
      <div className="flex w-full bg-surface-raised sticky top-0 z-10 border-b border-border shadow-sm">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-3 text-sm font-dm-sans font-medium transition-colors ${
            activeTab === "pending" ? "text-saffron border-b-2 border-saffron" : "text-ink-secondary"
          }`}
        >
          📋 Pending ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab("packing")}
          className={`flex-1 py-3 text-sm font-dm-sans font-medium transition-colors ${
            activeTab === "packing" ? "text-saffron border-b-2 border-saffron" : "text-ink-secondary"
          }`}
        >
          📦 Packing ({packingCount})
        </button>
        <button
          onClick={() => setActiveTab("packed")}
          className={`flex-1 py-3 text-sm font-dm-sans font-medium transition-colors ${
            activeTab === "packed" ? "text-saffron border-b-2 border-saffron" : "text-ink-secondary"
          }`}
        >
          ✅ Packed ({packedCount})
        </button>
      </div>

      <div className="p-4 flex-1">
        {loading ? (
          <div className="flex justify-center py-12">
             <Loader2 className="w-8 h-8 animate-spin text-saffron" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 bg-surface rounded-xl border border-border border-dashed">
             <CheckCircle2 className="w-12 h-12 text-success mb-3 opacity-80" />
             <h3 className="font-syne font-bold text-ink text-lg">No orders here</h3>
             <p className="font-dm-sans text-sm text-ink-secondary mt-1 max-w-[200px]">
               {activeTab === "pending" && "You're all caught up. Great job!"}
               {activeTab === "packing" && "Nothing is being packed right now."}
               {activeTab === "packed" && "No orders are currently waiting for pickup."}
             </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(dOrder => {
              const o = dOrder.orders;
              if (!o) return null;
              
              const shortId = o.id.slice(-6).toUpperCase();
              const timeAgo = formatDistanceToNow(new Date(o.created_at), { addSuffix: true });
              const phone = o.selected_variant?.phone || o.selected_variant?.buyerPhone || "Unavailable";
              const size = o.selected_variant?.size ? ` • Size: ${o.selected_variant.size}` : "";

              return (
                <div key={dOrder.id} className={`w-full bg-surface-raised border border-border rounded-xl overflow-hidden shadow-sm transition-all ${dOrder.status === 'packed' ? 'opacity-80' : ''}`}>
                   
                   {/* Card Header */}
                   <div className="px-4 py-3 bg-surface border-b border-border flex justify-between items-center">
                     <span className="font-jetbrains-mono text-xs font-bold text-ink tracking-wider">
                       ORDER #{shortId}
                     </span>
                     <span className="font-dm-sans text-xs text-ink-muted">
                       {timeAgo}
                     </span>
                   </div>

                   {/* Customer Details */}
                   <div className="px-4 py-3 border-b border-border border-dashed space-y-1">
                     <div className="flex items-center text-sm font-dm-sans text-ink">
                       <span className="mr-2">👤</span>
                       <span className="font-medium">{o.buyer_name}</span>
                     </div>
                     <div className="flex items-center text-sm font-dm-sans text-ink">
                       <span className="mr-2">📱</span>
                       <span className="font-medium text-ink-secondary">{phone}</span>
                     </div>
                   </div>

                   {/* Product Details */}
                   <div className="px-4 py-3 space-y-1">
                     <div className="flex items-start text-sm font-dm-sans text-ink">
                       <span className="mr-2">🛍</span>
                       <span className="font-medium">{o.products?.name || "Unknown Product"} × 1</span>
                     </div>
                     <div className="flex justify-between items-center mt-1 pl-6">
                       <span className="text-xs text-ink-secondary font-dm-sans">
                         {size}
                       </span>
                       <span className="text-sm font-jetbrains-mono font-bold text-ink">
                         ₹{o.amount}
                       </span>
                     </div>
                   </div>

                   {/* Actions */}
                   <div className="px-4 py-3 bg-surface border-t border-border">
                     {dOrder.status === "pending" && (
                       <button
                         onClick={() => startPacking(dOrder.id)}
                         disabled={actionLoading === dOrder.id}
                         className="w-full h-11 bg-saffron text-surface-raised font-dm-sans font-bold text-sm tracking-wide rounded-lg flex items-center justify-center disabled:opacity-70 active:scale-[0.98] transition-transform"
                       >
                         {actionLoading === dOrder.id ? <Loader2 className="w-5 h-5 animate-spin"/> : "START PACKING"}
                       </button>
                     )}
                     
                     {dOrder.status === "packing" && (
                       <button
                         onClick={() => markAsPacked(dOrder)}
                         disabled={actionLoading === dOrder.id}
                         className="w-full h-11 bg-success text-surface-raised font-dm-sans font-bold text-sm tracking-wide rounded-lg flex items-center justify-center disabled:opacity-70 active:scale-[0.98] transition-transform"
                       >
                         {actionLoading === dOrder.id ? <Loader2 className="w-5 h-5 animate-spin"/> : "MARK AS PACKED"}
                       </button>
                     )}

                     {dOrder.status === "packed" && (
                       <div className="w-full h-11 bg-success-bg border border-success/20 text-success font-dm-sans font-bold text-sm tracking-wide rounded-lg flex items-center justify-center">
                         <span className="mr-2">✓</span> OTP Sent to Customer
                       </div>
                     )}
                   </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
