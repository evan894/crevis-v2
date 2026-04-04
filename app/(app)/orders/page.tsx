/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function OrdersPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; }
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth");
  }

  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!seller) {
    redirect("/auth");
  }

  // Fetch all orders for current seller (using Supabase JS)
  // order record already has buyer_name based on our SCHEMA.md
  // Using products(name) gets the product name.
  const { data: orders } = await supabase
    .from("orders")
    .select("*, products(name)")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="font-syne text-3xl font-bold text-ink">Orders</h1>
        <p className="font-dm-sans text-ink-secondary mt-1">
          Manage and review your recent sales.
        </p>
      </div>

      <div className="bg-surface-raised border border-border shadow-sm rounded-lg overflow-hidden">
        {(!orders || orders.length === 0) ? (
          <div className="p-8 text-center text-ink-muted font-dm-sans">
            No orders yet. Share your Telegram bot link to start selling.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-dm-sans text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium text-ink">Product</th>
                  <th className="px-6 py-4 font-medium text-ink">Buyer</th>
                  <th className="px-6 py-4 font-medium text-ink">Amount</th>
                  <th className="px-6 py-4 font-medium text-ink">Fee</th>
                  <th className="px-6 py-4 font-medium text-ink">Status</th>
                  <th className="px-6 py-4 font-medium text-ink">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order: any) => {
                  const productName = Array.isArray(order.products)
                    ? order.products[0]?.name
                    : order.products?.name || "Unknown Product";
                    
                  // Determine status badge CSS variable colors
                  let badgeBg = "bg-surface-raised";
                  let badgeText = "text-ink";
                  
                  if (order.status === "pending") {
                    badgeBg = "bg-[var(--color-warning-bg)]";
                    badgeText = "text-[var(--color-warning)]";
                  } else if (order.status === "completed") {
                    badgeBg = "bg-[var(--color-success-bg)]";
                    badgeText = "text-[var(--color-success)]";
                  } else if (order.status === "failed") {
                    badgeBg = "bg-[var(--color-error-bg)]";
                    badgeText = "text-[var(--color-error)]";
                  }

                  return (
                    <tr key={order.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-ink">
                        {productName}
                      </td>
                      <td className="px-6 py-4 text-ink-secondary">
                        {order.buyer_name}
                      </td>
                      <td className="px-6 py-4 font-jetbrains-mono font-medium text-saffron">
                        ₹{order.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-jetbrains-mono text-ink-secondary">
                        ₹{order.platform_fee.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeBg} ${badgeText}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-jetbrains-mono text-ink-muted text-xs">
                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(order.created_at))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
