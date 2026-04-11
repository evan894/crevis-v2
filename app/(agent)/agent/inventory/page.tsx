"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, Plus, Minus, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  photo_url: string;
  category: string;
  stock: number;
  active: boolean;
};

export default function AgentInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

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
               fetchInventory(res.data.seller_id);
             }
          });
      }
    });
  }, [supabase]);

  const fetchInventory = async (sellerId: string) => {
    const { data } = await supabase
      .from('products')
      .select('id, name, photo_url, category, stock, active')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    setProducts(data || []);
    setLoading(false);
  };

  const updateStock = async (id: string, currentStock: number, delta: number) => {
    const newStock = currentStock + delta;
    if (newStock < 0) return;
    
    setUpdating(prev => ({ ...prev, [id]: true }));
    
    try {
      const res = await fetch(`/api/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to update stock");
      
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock, active: newStock > 0 } : p));
      toast.success("Stock updated");
    } catch(err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [id]: false }));
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col w-full px-4 py-6 mb-8">
      <h1 className="font-syne text-2xl font-bold text-ink mb-4">Inventory</h1>
      
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-ink-muted" />
        </div>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-lg text-sm font-dm-sans focus:border-saffron focus:ring-1 focus:ring-saffron outline-none"
        />
      </div>

      {loading ? (
         <div className="flex justify-center py-12">
           <Loader2 className="w-8 h-8 animate-spin text-saffron" />
         </div>
      ) : filtered.length === 0 ? (
         <div className="text-center py-8 text-ink-secondary text-sm font-dm-sans">
           No products found.
         </div>
      ) : (
         <div className="space-y-3">
           {filtered.map(p => (
             <div key={p.id} className={`flex items-center p-3 rounded-xl border transition-colors ${p.stock <= 0 ? 'bg-error-bg border-error/30' : 'bg-surface-raised border-border'}`}>
                <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-surface">
                   <Image src={p.photo_url || "/placeholder.png"} alt={p.name} fill className="object-cover" />
                   {p.stock <= 0 && <div className="absolute inset-0 bg-ink/50" />}
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                   <h3 className="text-sm font-bold text-ink truncate">{p.name}</h3>
                   <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-ink-muted uppercase tracking-wider font-jetbrains-mono bg-surface px-1.5 py-0.5 rounded">{p.category}</span>
                      {p.stock <= 0 && <span className="text-[10px] bg-error text-surface-raised px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Out of Stock</span>}
                   </div>
                </div>

                <div className="flex items-center gap-3 ml-2">
                   <button 
                     onClick={() => updateStock(p.id, p.stock, -1)}
                     disabled={p.stock <= 0 || updating[p.id]}
                     className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded shadow-sm disabled:opacity-50"
                   >
                     <Minus className="w-4 h-4 text-ink-secondary" />
                   </button>
                   <span className="w-6 text-center font-jetbrains-mono font-bold text-sm">
                     {updating[p.id] ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : p.stock}
                   </span>
                   <button 
                     onClick={() => updateStock(p.id, p.stock, 1)}
                     disabled={updating[p.id]}
                     className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded shadow-sm disabled:opacity-50"
                   >
                     <Plus className="w-4 h-4 text-ink-secondary" />
                   </button>
                </div>
             </div>
           ))}
         </div>
      )}
    </div>
  );
}
