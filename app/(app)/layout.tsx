"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PackageOpen, ShoppingBag, Wallet, Settings, Users, CreditCard, TrendingUp } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
      </nav>
    </div>
  );
}
