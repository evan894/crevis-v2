"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-actions";

export default function DeliveryAgentLayout({ children }: { children: React.ReactNode }) {
  const [shopName, setShopName] = useState("");
  const [firstName, setFirstName] = useState("");
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setFirstName(data.user.user_metadata?.full_name?.split(" ")[0] || "");
        supabase
          .from("store_members")
          .select("sellers(shop_name)")
          .eq("user_id", data.user.id)
          .single()
          .then((res) => {
             const sellers = res.data?.sellers as unknown as { shop_name: string };
             if (sellers?.shop_name) {
               setShopName(sellers.shop_name);
             }
          });
      }
    });
  }, [supabase]);

  return (
    <div className="flex flex-col min-h-screen bg-surface-raised font-dm-sans sm:hidden">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-surface-raised border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-syne font-bold text-ink text-lg truncate max-w-[200px]">
            {shopName || "Loading..."}
          </span>
          <span className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">
              Delivery Agent
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {firstName && <span className="text-sm font-medium text-ink-secondary">{firstName}</span>}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-muted hover:text-error hover:bg-error-bg rounded-md transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
}
