"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PackageOpen, ShoppingBag, Wallet, Settings, Users, CreditCard, TrendingUp, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { createBrowserClient } from "@/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [shopName, setShopName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const pathname = usePathname();
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email || "");
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

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Analytics", href: "/analytics", icon: TrendingUp },
    { name: "Products", href: "/products", icon: PackageOpen },
    { name: "Orders", href: "/orders", icon: ShoppingBag },
    { name: "Team", href: "/team", icon: Users },
    { name: "Wallet", href: "/wallet", icon: Wallet },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-surface font-dm-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface-raised h-full">
        <div className="h-16 flex items-center px-6 border-b border-border select-none">
           <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="#F4631E" />
              <path d="M26 14L14 26" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
           </svg>
           <span className="ml-3 font-syne font-bold text-xl text-ink tracking-tight">Crevis</span>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Exact match for dashboard, startswith for others
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            
            return (
              <Link key={item.name} href={item.href} className={`flex items-center px-3 py-3 font-medium transition-all group ${isActive ? "bg-saffron/10 text-saffron border-l-4 border-saffron" : "text-ink-secondary hover:bg-surface hover:text-ink border-l-4 border-transparent"}`}>
                <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? "text-saffron" : "text-ink-muted group-hover:text-ink-secondary"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          {userEmail && (
            <div className="mb-3 px-2 flex flex-col">
              <span className="text-sm font-medium text-ink truncate">{shopName || "Loading..."}</span>
              <span className="text-xs text-ink-muted truncate">{userEmail}</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-full scroll-smooth bg-surface relative z-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-raised border-t border-border flex items-center justify-around z-50 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.02)]">
         {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            
            return (
              <Link key={item.name} href={item.href} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? "text-saffron" : "text-ink-muted hover:text-ink-secondary"}`}>
                 <Icon className={`w-5 h-5 ${isActive ? "text-saffron" : ""}`} />
                 <span className="text-[10px] font-medium select-none">{item.name}</span>
              </Link>
            );
         })}
         <button onClick={signOut} className="flex flex-col items-center justify-center w-full h-full space-y-1 text-ink-muted hover:text-destructive">
            <LogOut className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] font-medium select-none">Sign out</span>
         </button>
      </nav>
    </div>
  );
}
