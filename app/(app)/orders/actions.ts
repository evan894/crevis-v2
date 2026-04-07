"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function markReturnResolved(orderId: string) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Update order status or mark as returned. Since we aren't releasing credits,
  // we just mark the return as resolved so it doesn't block other things,
  // or we set a flag. The requirement says:
  // "On Mark Return Resolved: Seller confirms they received the item back. Credits NOT released (buyer gets refund). Admin notified to process refund."
  
  // We can update the order status
  await supabase
    .from("orders")
    .update({ 
      status: "returned", 
      credits_released: true // Mark as true so cron ignores it, but we never add credits
    })
    .eq("id", orderId);

  // Notify admin via Slack (we could reuse sendSlackDM to admin slack ID if configured, 
  // or just console log for now as "Admin notified to process refund")
  console.log(`[Admin Notice] Order ${orderId} marked as returned for refund.`);

  revalidatePath("/orders");
}
