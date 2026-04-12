"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { LogOut, ClipboardList, Package, Clock } from "lucide-react";
import Link from "next/link";

export default function SalesAgentLayout({ children }: { children: React.ReactNode }) {
  const [shopName, setShopName] = useState("");
  const router = useRouter();
  const pathname = usePathname();
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
    <div className="flex flex-col min-h-screen bg-surface-raised font-dm-sans sm:hidden pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-surface-raised border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-syne font-bold text-ink text-lg truncate max-w-[200px]">
            {shopName || "Loading..."}
          </span>
          <span className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-xs font-medium text-saffron uppercase tracking-wider">
              Sales Agent
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-surface-raised border-t border-border z-10">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/agent"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              pathname === "/agent" ? "text-saffron" : "text-ink-muted hover:text-ink"
            }`}
          >
            <ClipboardList className={`w-5 h-5 ${pathname === "/agent" ? "stroke-[2.5px]" : "stroke-2"}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Orders</span>
          </Link>
          <Link
            href="/agent/inventory"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              pathname === "/agent/inventory" ? "text-saffron" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Package className={`w-5 h-5 ${pathname === "/agent/inventory" ? "stroke-[2.5px]" : "stroke-2"}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Inventory</span>
          </Link>
          <Link
            href="/agent/history"
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              pathname === "/agent/history" ? "text-saffron" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Clock className={`w-5 h-5 ${pathname === "/agent/history" ? "stroke-[2.5px]" : "stroke-2"}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider">History</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
