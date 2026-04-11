"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { format, isToday, isThisWeek, isThisMonth } from "date-fns";

type Order = {
  id: string;
  created_at: string;
  buyer_name: string;
  amount: number;
  status: string;
  products: {
    name: string;
  } | null;
};

export default function AgentHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"today" | "week" | "month" | "all">("today");

  const supabase = createBrowserClient();

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
               fetchHistory(res.data.seller_id);
             }
          });
      }
    });
  }, [supabase]);

  const fetchHistory = async (sellerId: string) => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        buyer_name,
        amount,
        status,
        products (name)
      `)
      .eq('seller_id', sellerId)
      .in('status', ['completed', 'failed'])
      .order('created_at', { ascending: false });

    setOrders((data as unknown as Order[]) || []);
    setLoading(false);
  };

  const filteredOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    if (filter === "today") return isToday(d);
    if (filter === "week") return isThisWeek(d);
    if (filter === "month") return isThisMonth(d);
    return true;
  });

  return (
    <div className="flex flex-col w-full h-full pb-6">
      <div className="px-4 py-4 sticky top-0 bg-surface-raised z-10 border-b border-border shadow-sm">
        <h1 className="font-syne text-2xl font-bold text-ink mb-3">Order History</h1>
        <div className="flex w-full bg-surface border border-border rounded-lg p-1">
           <button onClick={() => setFilter("today")} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "today" ? "bg-surface-raised shadow text-ink" : "text-ink-secondary"}`}>Today</button>
           <button onClick={() => setFilter("week")} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "week" ? "bg-surface-raised shadow text-ink" : "text-ink-secondary"}`}>This Week</button>
           <button onClick={() => setFilter("month")} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "month" ? "bg-surface-raised shadow text-ink" : "text-ink-secondary"}`}>This Month</button>
        </div>
      </div>

      <div className="p-4 flex-1">
        {loading ? (
          <div className="flex justify-center py-12">
             <Loader2 className="w-8 h-8 animate-spin text-saffron" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-ink-secondary text-sm font-dm-sans bg-surface rounded-xl border border-border border-dashed">
            No completed or failed orders found for this period.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(o => (
              <div key={o.id} className="w-full bg-surface-raised border border-border rounded-lg p-3 shadow-sm flex flex-col justify-between">
                 <div className="flex justify-between items-start mb-2">
                   <div>
                     <div className="text-xs font-dm-sans text-ink-muted">{format(new Date(o.created_at), "MMM d, h:mm a")}</div>
                     <div className="font-syne font-bold text-sm text-ink">{o.buyer_name}</div>
                   </div>
                   <div className="text-right">
                     <div className="text-sm font-jetbrains-mono font-bold text-ink">₹{o.amount}</div>
                     <div className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${o.status === "completed" ? "text-success" : "text-error"}`}>{o.status}</div>
                   </div>
                 </div>
                 <div className="text-xs font-dm-sans text-ink flex items-center bg-surface w-fit px-2 py-1 rounded border border-border">
                   <span className="mr-1.5">🛍</span>
                   {o.products?.name || "Unknown Product"}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
