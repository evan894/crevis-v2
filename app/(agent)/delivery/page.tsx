"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { formatDistanceToNow, isToday } from "date-fns";
import { Loader2, CheckCircle2, ChevronDown, Mails } from "lucide-react";
import { toast } from "react-hot-toast";

type DeliveryOrder = {
  id: string;
  status: string;
  otp_attempts: number;
  packed_at: string | null;
  delivered_at: string | null;
  agent_id: string | null;
  orders: {
    id: string;
    buyer_name: string;
    amount: number;
    selected_variant: any;
    created_at: string;
    products: {
      name: string;
    } | null;
  } | null;
};

export default function DeliveryAgentDashboard() {
  const [activeTab, setActiveTab] = useState<"packed" | "out_for_delivery" | "delivered">("packed");
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [showFailedModal, setShowFailedModal] = useState<string | null>(null);
  const [failedReason, setFailedReason] = useState("");

  const supabase = createBrowserClient();

  const fetchOrders = async (sId: string, uId: string) => {
    const { data, error } = await supabase
      .from('delivery_orders')
      .select(`
        id,
        status,
        otp_attempts,
        packed_at,
        delivered_at,
        agent_id,
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
      .in('status', ['packed', 'out_for_delivery', 'delivered'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load delivery orders");
    } else {
      setOrders((data as unknown as DeliveryOrder[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        supabase
          .from("store_members")
          .select("seller_id")
          .eq("user_id", data.user.id)
          .eq("is_active", true)
          .single()
          .then((res) => {
             if (res.data?.seller_id) {
               setSellerId(res.data.seller_id);
               fetchOrders(res.data.seller_id, data.user.id);
             }
          });
      }
    });

    const channel = supabase.channel('delivery-agent-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, payload => {
         if (sellerId && userId) fetchOrders(sellerId, userId);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, sellerId, userId]);

  const packedOrders = orders.filter(o => o.status === "packed");
  const outOrders = orders.filter(o => o.status === "out_for_delivery" && o.agent_id === userId);
  const deliveredOrders = orders.filter(o => o.status === "delivered" && o.agent_id === userId && o.delivered_at && isToday(new Date(o.delivered_at)));

  const handleAction = async (action: string, deliveryOrderId: string, extra?: { otp?: string, reason?: string }) => {
    setActionLoading(deliveryOrderId);
    try {
      const res = await fetch("/api/agent/delivery-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deliveryOrderId, ...extra })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.attemptsLeft !== undefined) {
           toast.error(`Wrong OTP. ${data.attemptsLeft} tries left.`);
           // Refresh to update attempts
           if (sellerId && userId) fetchOrders(sellerId, userId);
        } else if (data.locked) {
           toast.error("Too many wrong attempts. Contact customer directly.");
        } else {
           throw new Error(data.error || "Action failed");
        }
      } else {
         if (action === 'pick_up') toast.success("Order picked up!");
         if (action === 'verify_otp') toast.success("Delivery confirmed!");
         if (action === 'report_failed') {
            toast.success("Delivery failure reported");
            setShowFailedModal(null);
            setFailedReason("");
         }
         // Optimistically fetch or rely on channel
         if (sellerId && userId) fetchOrders(sellerId, userId);
      }
    } catch(err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getFiltered = () => {
    if (activeTab === "packed") return packedOrders;
    if (activeTab === "out_for_delivery") return outOrders;
    return deliveredOrders;
  };

  const currentList = getFiltered();
  const totalDeliveredValue = deliveredOrders.reduce((acc, curr) => acc + (curr.orders?.amount || 0), 0);

  return (
    <div className="flex flex-col w-full h-full pb-6">
      <div className="flex w-full bg-surface-raised sticky top-0 z-10 border-b border-border shadow-sm">
        <button
          onClick={() => setActiveTab("packed")}
          className={`flex-1 py-3 text-[11px] font-dm-sans font-medium transition-colors uppercase tracking-wide ${
            activeTab === "packed" ? "text-saffron border-b-2 border-saffron" : "text-ink-secondary"
          }`}
        >
          📦 Ready ({packedOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("out_for_delivery")}
          className={`flex-1 py-3 text-[11px] font-dm-sans font-medium transition-colors uppercase tracking-wide ${
            activeTab === "out_for_delivery" ? "text-saffron border-b-2 border-saffron" : "text-ink-secondary"
          }`}
        >
          🛵 Out ({outOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("delivered")}
          className={`flex-1 py-3 text-[11px] font-dm-sans font-medium transition-colors uppercase tracking-wide ${
            activeTab === "delivered" ? "text-saffron border-b-2 border-saffron" : "text-ink-secondary"
          }`}
        >
          ✅ Done ({deliveredOrders.length})
        </button>
      </div>

      <div className="p-4 flex-1">
        {activeTab === "delivered" && deliveredOrders.length > 0 && (
           <div className="mb-4 w-full bg-surface-raised border border-border rounded-xl p-4 flex justify-between items-center shadow-sm">
             <div className="text-sm font-dm-sans text-ink">Delivered Today: <strong>{deliveredOrders.length} orders</strong></div>
             <div className="text-sm font-jetbrains-mono text-success font-bold">₹{totalDeliveredValue}</div>
           </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
             <Loader2 className="w-8 h-8 animate-spin text-saffron" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 bg-surface rounded-xl border border-border border-dashed mt-4">
             <CheckCircle2 className="w-12 h-12 text-success mb-3 opacity-80" />
             <h3 className="font-syne font-bold text-ink text-lg">No orders here</h3>
             <p className="font-dm-sans text-sm text-ink-secondary mt-1">
               {activeTab === "packed" && "No packages waiting for pickup right now."}
               {activeTab === "out_for_delivery" && "You have no active deliveries."}
               {activeTab === "delivered" && "No orders delivered today."}
             </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentList.map(dOrder => {
              const o = dOrder.orders;
              if (!o) return null;
              
              const shortId = o.id.slice(-6).toUpperCase();
              let timeStr = "";
              if (activeTab === "packed" && dOrder.packed_at) {
                 timeStr = `Packed ${formatDistanceToNow(new Date(dOrder.packed_at))} ago`;
              } else if (activeTab === "delivered" && dOrder.delivered_at) {
                 timeStr = `Delivered ${formatDistanceToNow(new Date(dOrder.delivered_at))} ago`;
              }
              
              const phone = o.selected_variant?.phone || o.selected_variant?.buyerPhone;
              const address = o.selected_variant?.address || "Address not provided in checkout";

              return (
                <div key={dOrder.id} className="w-full bg-surface-raised border border-border rounded-xl overflow-hidden shadow-sm">
                   <div className="px-4 py-3 bg-surface border-b border-border flex justify-between items-center">
                     <span className="font-jetbrains-mono text-xs font-bold text-ink tracking-wider">
                       ORDER #{shortId}
                     </span>
                     {timeStr && <span className="font-dm-sans text-[10px] text-ink-muted">{timeStr}</span>}
                   </div>

                   <div className="px-4 py-3 border-b border-border border-dashed space-y-1.5">
                     <div className="flex items-center text-sm font-dm-sans text-ink">
                       <span className="mr-2">👤</span>
                       <span className="font-medium">{o.buyer_name}</span>
                     </div>
                     {phone && (
                        <div className="flex items-center text-sm font-dm-sans text-ink">
                          <span className="mr-2">📱</span>
                          <span className="font-medium text-ink-secondary">{phone}</span>
                        </div>
                     )}
                     <div className="flex items-start text-sm font-dm-sans text-ink">
                        <span className="mr-2 mt-0.5">📍</span>
                        <span className="text-ink-secondary leading-tight">{address}</span>
                     </div>
                   </div>

                   <div className="px-4 py-3 space-y-1">
                     <div className="flex items-start text-sm font-dm-sans text-ink">
                       <span className="mr-2">🛍</span>
                       <span className="font-medium">{o.products?.name || "Unknown Product"} × 1</span>
                     </div>
                     <div className="flex justify-end items-center mt-1">
                       <span className="text-sm font-jetbrains-mono font-bold text-ink">
                         ₹{o.amount}
                       </span>
                     </div>
                   </div>

                   {/* Ready for Pickup Action */}
                   {activeTab === "packed" && (
                     <div className="px-4 py-3 bg-surface border-t border-border">
                       <button
                         onClick={() => handleAction("pick_up", dOrder.id)}
                         disabled={actionLoading === dOrder.id}
                         className="w-full h-11 bg-saffron text-surface-raised font-dm-sans font-bold text-sm tracking-wide rounded-lg flex items-center justify-center disabled:opacity-70 active:scale-[0.98]"
                       >
                         {actionLoading === dOrder.id ? <Loader2 className="w-5 h-5 animate-spin"/> : "PICK UP ORDER"}
                       </button>
                     </div>
                   )}

                   {/* Out for Delivery Action (OTP Verif) */}
                   {activeTab === "out_for_delivery" && (
                     <div className="px-4 py-4 bg-surface border-t border-border flex flex-col items-center">
                        <span className="text-xs font-dm-sans font-bold text-ink-secondary tracking-widest uppercase mb-3">
                          Enter Customer OTP
                        </span>
                        
                        <input 
                           type="number"
                           value={otpInputs[dOrder.id] || ""}
                           onChange={e => {
                             let v = e.target.value.substring(0, 6);
                             setOtpInputs(prev => ({...prev, [dOrder.id]: v}));
                           }}
                           placeholder="------"
                           className="w-full max-w-[200px] text-center text-2xl font-jetbrains-mono font-bold tracking-[0.5em] bg-transparent border-b-2 border-border focus:border-saffron outline-none mb-4 pb-1"
                        />

                        {dOrder.otp_attempts >= 3 ? (
                           <div className="text-error text-xs text-center mb-4">
                             Too many wrong attempts.<br/>Contact the customer directly.
                           </div>
                        ) : null}

                        <button
                          onClick={() => handleAction("verify_otp", dOrder.id, { otp: otpInputs[dOrder.id] })}
                          disabled={actionLoading === dOrder.id || (otpInputs[dOrder.id] || "").length !== 6 || dOrder.otp_attempts >= 3}
                          className="w-full h-11 bg-success text-surface-raised font-dm-sans font-bold text-sm tracking-wide rounded-lg flex items-center justify-center disabled:opacity-70 active:scale-[0.98] mb-3"
                        >
                          {actionLoading === dOrder.id ? <Loader2 className="w-5 h-5 animate-spin"/> : "CONFIRM DELIVERY"}
                        </button>

                        <button 
                          onClick={() => setShowFailedModal(dOrder.id)}
                          className="text-xs font-dm-sans font-medium text-error hover:underline py-1"
                        >
                           Report Failed Delivery
                        </button>
                     </div>
                   )}
                   
                   {/* Delivered Badge */}
                   {activeTab === "delivered" && (
                     <div className="px-4 py-3 bg-success-bg border-t border-success/20 flex justify-center text-success font-dm-sans font-bold text-xs tracking-wider uppercase">
                       <span className="mr-2">✓</span> Delivered Successfully
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Failed Delivery Modal */}
      {showFailedModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm">
           <div className="bg-surface-raised w-full max-w-sm rounded-xl p-5 border border-border shadow-2xl">
             <h3 className="font-syne font-bold text-lg mb-3">Report Failed Delivery</h3>
             <p className="text-sm font-dm-sans text-ink-secondary mb-4">
               Why could this order not be delivered?
             </p>
             <div className="space-y-2 mb-6">
                {["Customer not available", "Wrong address", "Customer refused", "Other"].map(r => (
                  <label key={r} className="flex items-center gap-3 p-2 border border-border rounded-lg cursor-pointer hover:bg-surface">
                     <input type="radio" name="failReason" value={r} checked={failedReason === r} onChange={() => setFailedReason(r)} className="text-saffron focus:ring-saffron"/>
                     <span className="text-sm font-dm-sans text-ink">{r}</span>
                  </label>
                ))}
             </div>
             <div className="flex gap-3">
                <button onClick={() => {setShowFailedModal(null); setFailedReason("");}} className="flex-1 py-2 text-sm font-medium text-ink-secondary border border-border bg-surface hover:bg-border rounded-lg">Cancel</button>
                <button 
                  onClick={() => handleAction("report_failed", showFailedModal, { reason: failedReason })} 
                  disabled={!failedReason || actionLoading === showFailedModal}
                  className="flex-1 py-2 text-sm font-bold text-surface-raised bg-error hover:bg-red-600 rounded-lg disabled:opacity-50"
                >
                  {actionLoading === showFailedModal ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Confirm Report"}
                </button>
             </div>
           </div>
         </div>
      )}
    </div>
  );
}
