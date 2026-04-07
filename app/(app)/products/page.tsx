"use client";

import { useEffect, useState } from "react";

import { createBrowserClient } from "@/lib/supabase";
import { Loader2, Zap, MoreVertical, Plus, PackageOpen, Power, PowerOff, Trash2, Link2 } from "lucide-react";
import { CREDIT_COST_BOOST } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import { toast } from "react-hot-toast";

type Product = {
  id: string;
  name: string;
  price: number;
  photo_url: string;
  active: boolean;
  boosted: boolean;
  category: string;
  stock: number;
};

type FilterMode = "All" | "Active" | "Inactive" | "Boosted";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("All");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  
  const supabase = createBrowserClient();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: seller } = await supabase.from('sellers').select('id').eq('user_id', user.id).single();
        if (!seller) return;

        const { data: productsData, error } = await supabase
          .from('products')
          .select('*')
          .eq('seller_id', seller.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(productsData || []);
      } catch (err) {
        console.error("Fetch products failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [supabase]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/products/${id}/toggle-active`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle");
      setProducts(products.map(p => p.id === id ? { ...p, active: !currentActive } : p));
      toast.success(currentActive ? "Product deactivated" : "Product activated");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(null);
      setMenuOpen(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/products/${id}/delete`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setProducts(products.filter(p => p.id !== id));
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setActionLoading(null);
      setMenuOpen(null);
    }
  };

  const handleBoost = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/products/${id}/boost`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to boost");
      
      setProducts(products.map(p => p.id === id ? { ...p, boosted: true } : p));
      toast.success("Product boosted successfully");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Failed to boost product");
      }
    } finally {
      setActionLoading(null);
      setMenuOpen(null);
    }
  };

  const handleCopyLink = (id: string) => {
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/p/${id}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success("Product link copied!"))
      .catch(() => toast.error("Failed to copy link"));
    setMenuOpen(null);
  };

  const filteredProducts = products.filter(p => {
    if (filter === "All") return true;
    if (filter === "Active") return p.active;
    if (filter === "Inactive") return !p.active;
    if (filter === "Boosted") return p.boosted;
    return true;
  });

  return (
    <div className="min-h-screen bg-surface selection:bg-saffron selection:text-surface-raised font-dm-sans">
      


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="font-syne text-3xl font-bold text-ink mb-2">Inventory</h1>
            <p className="text-ink-secondary text-sm">Manage your product listings and store visibility.</p>
          </div>
          
          <Link 
            href="/products/new" 
            className="h-[44px] px-6 inline-flex items-center justify-center bg-saffron text-surface-raised rounded-md font-medium hover:bg-saffron-dark transition-all duration-base shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 border-b border-border pb-1">
          {(["All", "Active", "Inactive", "Boosted"] as FilterMode[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors whitespace-nowrap ${
                filter === tab 
                  ? "text-saffron border-b-2 border-saffron bg-saffron/5" 
                  : "text-ink-secondary hover:text-ink hover:bg-surface-raised"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-saffron animate-spin" />
          </div>
        ) : products.length === 0 && filter === "All" ? (
          
          /* Empty State */
          <div className="bg-surface-raised border border-border border-dashed rounded-xl p-12 flex flex-col items-center text-center max-w-2xl mx-auto mt-12 animate-in zoom-in-95 duration-base">
            <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6">
              <PackageOpen className="w-10 h-10 text-ink-muted" strokeWidth={1.5} />
            </div>
            <h3 className="font-syne text-xl font-bold text-ink mb-2">Shelf is empty</h3>
            <p className="text-ink-secondary text-sm mb-8 max-w-sm">
              You haven&apos;t listed any products yet. Add your first item to start building your catalog to sell instantly.
            </p>
            <Link 
              href="/products/new" 
              className="h-[44px] px-8 inline-flex items-center justify-center bg-saffron text-surface-raised rounded-md font-medium hover:bg-saffron-dark transition-all duration-base shadow-sm"
            >
              Add your first product
            </Link>
          </div>

        ) : filteredProducts.length === 0 ? (
          
          <div className="py-20 text-center text-ink-muted text-sm border border-dashed border-border rounded-lg">
            No products match the selected filter.
          </div>

        ) : (
          
          /* Product Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-surface-raised border border-border rounded-xl overflow-hidden hover:shadow-md transition-all duration-base hover:-translate-y-1 group relative flex flex-col">
                
                {/* Image Section */}
                <div className="aspect-[4/3] bg-surface relative overflow-hidden">
                  <Image 
                    src={product.photo_url} 
                    alt={product.name}
                    fill
                    className={`object-cover transition-transform duration-slow ${!product.active && 'grayscale opacity-70'} group-hover:scale-105`}
                  />
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {product.active ? (
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-success-bg/90 backdrop-blur-sm text-success rounded-md shadow-sm">
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-surface/90 backdrop-blur-sm text-ink-secondary rounded-md shadow-sm">
                        Inactive
                      </span>
                    )}
                  </div>

                  {product.boosted && (
                    <div className="absolute top-3 right-3">
                       <span className="px-2 py-1 text-[10px] font-bold uppercase flex items-center bg-saffron/90 backdrop-blur-sm text-surface-raised rounded-md shadow-sm">
                          <Zap className="w-3 h-3 mr-1 fill-current" /> Boosted
                       </span>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-5 flex flex-col flex-1 relative">
                  
                  {/* Action Menu (3 Dots) */}
                  <div className="absolute top-4 right-4">
                     <button 
                       onClick={() => setMenuOpen(menuOpen === product.id ? null : product.id)}
                       className="p-1 text-ink-muted hover:text-ink rounded-md hover:bg-surface transition-colors"
                     >
                       <MoreVertical className="w-5 h-5" />
                     </button>
                     
                     {menuOpen === product.id && (
                       <div className="absolute right-0 top-full mt-1 w-48 bg-surface-raised border border-border rounded-lg shadow-lg overflow-hidden z-20 py-1 animate-in zoom-in-95 duration-fast">
                         
                          {/* Copy Link */}
                          <button
                            onClick={() => handleCopyLink(product.id)}
                            className="w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-surface text-ink transition-colors"
                          >
                            <Link2 className="w-4 h-4 text-ink-secondary" />
                            Copy Link
                          </button>

                          {!product.boosted && (
                           <button 
                             onClick={() => handleBoost(product.id)}
                             disabled={actionLoading === product.id}
                             className="w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-surface text-ink transition-colors disabled:opacity-50"
                           >
                             {actionLoading === product.id ? <Loader2 className="w-4 h-4 animate-spin text-saffron" /> : <Zap className="w-4 h-4 text-saffron" />}
                             Boost Listing ({CREDIT_COST_BOOST} C)
                           </button>
                         )}

                         <button 
                           onClick={() => handleToggleActive(product.id, product.active)}
                           disabled={actionLoading === product.id}
                           className="w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-surface text-ink transition-colors disabled:opacity-50"
                         >
                           {product.active ? <PowerOff className="w-4 h-4 text-ink-secondary" /> : <Power className="w-4 h-4 text-success" />}
                           {product.active ? "Deactivate" : "Activate"}
                         </button>

                         <hr className="border-border my-1" />

                         <button 
                           onClick={() => handleDelete(product.id)}
                           disabled={actionLoading === product.id}
                           className="w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-error-bg text-error transition-colors disabled:opacity-50"
                         >
                           <Trash2 className="w-4 h-4" />
                           Delete
                         </button>
                       </div>
                     )}
                  </div>

                  <h3 className="font-syne font-bold text-lg text-ink pr-8 truncate">
                    {product.name}
                  </h3>
                  <p className="font-dm-sans text-xs text-ink-secondary mb-4 line-clamp-1">
                    {product.category}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                     <span className="font-syne font-bold text-[var(--color-saffron)] text-[17px]">
                        ₹{product.price.toLocaleString('en-IN')}
                     </span>
                     <span className="text-xs text-ink-muted bg-surface px-2 py-1 rounded-md">
                        Stock: {product.stock ?? 1}
                     </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        )}
      </main>

    </div>
  );
}
