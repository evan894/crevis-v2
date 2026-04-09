"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  Download
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from "recharts";

// ─── Data Types ────────────────────────────────────────────────────────────

type DailyStats = {
  date: string;
  revenue: number;
  orders: number;
};

type ProductStat = {
  name: string;
  revenue: number;
  quantity: number;
};

type CategoryStat = {
  name: string;
  value: number;
};

// ─── Constants ─────────────────────────────────────────────────────────────

const COLORS = ["#F4631E", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"];

// ─── Main Component ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  const [mainStats, setMainStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    revenueGrowth: 0,
    ordersGrowth: 0
  });

  const [dailyData, setDailyData] = useState<DailyStats[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!seller) return;

      // Date range calculation
      const now = new Date();
      const rangeDate = new Date();
      if (timeRange === "7d") rangeDate.setDate(now.getDate() - 7);
      else if (timeRange === "30d") rangeDate.setDate(now.getDate() - 30);
      else rangeDate.setMonth(now.getMonth() - 3);

      const rangeISO = rangeDate.toISOString();

      // Fetch orders for revenue/products
      const { data: orders } = await supabase
        .from("orders")
        .select("amount, created_at, products(name, category)")
        .eq("seller_id", seller.id)
        .eq("status", "completed")
        .gte("created_at", rangeISO);

      if (!orders) return;

      // 1. Daily Aggregations
      const dailyMap: Record<string, DailyStats> = {};
      const productMap: Record<string, ProductStat> = {};
      const catMap: Record<string, number> = {};

      let totalRev = 0;
      
      orders.forEach(o => {
        const dateKey = new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
        dailyMap[dateKey].revenue += Number(o.amount);
        dailyMap[dateKey].orders += 1;
        totalRev += Number(o.amount);

        const pName = o.products?.name || "Unknown Product";
        if (!productMap[pName]) productMap[pName] = { name: pName, revenue: 0, quantity: 0 };
        productMap[pName].revenue += Number(o.amount);
        productMap[pName].quantity += 1;

        const cat = o.products?.category || "Other";
        catMap[cat] = (catMap[cat] || 0) + 1;
      });

      // Prepare Chart Data
      setDailyData(Object.values(dailyMap));
      setTopProducts(Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })));

      // Main Stats
      setMainStats({
        totalRevenue: totalRev,
        totalOrders: orders.length,
        avgOrderValue: orders.length > 0 ? totalRev / orders.length : 0,
        revenueGrowth: 12.5, // Placeholder for actual YoY/MoM calc
        ordersGrowth: 5.2
      });

      setLoading(false);
    };

    fetchData();
  }, [supabase, timeRange]);

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-surface-raised rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-surface-raised rounded-xl"></div>
          <div className="h-32 bg-surface-raised rounded-xl"></div>
          <div className="h-32 bg-surface-raised rounded-xl"></div>
        </div>
        <div className="h-96 bg-surface-raised rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10 bg-surface space-y-10 selection:bg-saffron selection:text-surface-raised">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-syne text-3xl font-bold text-ink">Analytics</h1>
          <p className="text-ink-secondary text-sm mt-1">Deep dive into your store&apos;s performance metrics.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface-raised border border-border rounded-lg p-1">
            <button 
              onClick={() => setTimeRange("7d")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === "7d" ? "bg-saffron text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => setTimeRange("30d")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === "30d" ? "bg-saffron text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}
            >
              30 Days
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-lg text-xs font-bold hover:bg-ink-secondary active:scale-[0.98] transition-all">
            <Download className="w-3.5 h-3.5" /> Export Data
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          label="Total Revenue" 
          value={`₹${mainStats.totalRevenue.toLocaleString("en-IN")}`} 
          trend="+12.5%" 
          trendUp={true} 
          icon={TrendingUp} 
        />
        <MetricCard 
          label="Total Orders" 
          value={mainStats.totalOrders.toString()} 
          trend="+5.2%" 
          trendUp={true} 
          icon={ShoppingBag} 
        />
        <MetricCard 
          label="Average Order" 
          value={`₹${Math.round(mainStats.avgOrderValue).toLocaleString("en-IN")}`} 
          trend="-2.1%" 
          trendUp={false} 
          icon={ArrowUpRight} 
        />
        <MetricCard 
          label="Repeat Customers" 
          value="18%" 
          trend="+0.5%" 
          trendUp={true} 
          icon={Users} 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-surface-raised border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-syne font-bold text-lg text-ink">Revenue Over Time</h3>
            <div className="p-2 bg-surface border border-border rounded-lg">
              <Calendar className="w-4 h-4 text-ink-muted" />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94A3B8", fontSize: 12 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94A3B8", fontSize: 12 }} 
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip 
                  cursor={{ fill: "rgba(244, 99, 30, 0.05)" }}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#F4631E" 
                  radius={[4, 4, 0, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-surface-raised border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="font-syne font-bold text-lg text-ink mb-8">Category Breakdown</h3>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xl font-bold text-ink">{mainStats.totalOrders}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Total Orders</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {categoryData.map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="font-medium text-ink-secondary">{cat.name}</span>
                </div>
                <span className="font-jetbrains-mono text-ink font-bold">{cat.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Top Products Table */}
      <div className="bg-surface-raised border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-syne font-bold text-lg text-ink">Product Performance</h3>
          <button className="text-xs font-bold text-saffron hover:underline">View All Products</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface text-ink-muted border-b border-border">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Product Name</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Qty Sold</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Revenue Generated</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topProducts.map((p) => (
                <tr key={p.name} className="hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-5 text-sm font-bold text-ink">{p.name}</td>
                  <td className="px-6 py-5 text-right font-jetbrains-mono text-sm text-ink-secondary">{p.quantity}</td>
                  <td className="px-6 py-5 text-right font-jetbrains-mono text-sm font-bold text-ink">₹{p.revenue.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-success-bg text-success border border-success/20">
                      High Growth
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function MetricCard({ label, value, trend, trendUp, icon: Icon }: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-surface-raised border border-border rounded-2xl p-6 shadow-sm group hover:border-saffron transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center group-hover:bg-saffron group-hover:border-saffron transition-colors">
          <Icon className="w-5 h-5 text-ink-muted group-hover:text-white transition-colors" />
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${trendUp ? "bg-success-bg text-success" : "bg-error-bg text-error"}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-jetbrains-mono font-bold text-ink tracking-tight">{value}</p>
    </div>
  );
}
