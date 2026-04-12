"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { LogOut } from "lucide-react";

export default function DeliveryAgentLayout({ children }: { children: React.ReactNode }) {
  const [shopName, setShopName] = useState("");
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

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
        <button
          onClick={handleSignOut}
          className="flex items-center text-ink-muted hover:text-error transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
}
