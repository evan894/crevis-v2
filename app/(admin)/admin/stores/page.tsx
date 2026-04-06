"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Search, Store, Package, ShoppingBag, Users,
  Wallet2, BarChart3, Trash2, X, AlertTriangle, ChevronRight,
  RefreshCw
} from "lucide-react";
import { toast } from "react-hot-toast";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type StoreInfo = {
  id: string;
  shop_name: string;
  email: string;
  category: string;
  credit_balance: number;
  active_products: number;
  completed_orders: number;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  photo_url: string;
  price: number;
  category: string;
  boosted: boolean;
  active: boolean;
};

type Order = {
  id: string;
  buyer_name: string;
  amount: number;
  status: string;
  created_at: string;
};

type Member = {
  id: string;
  email?: string;
  display_name?: string;
  role: string;
  is_active: boolean;
};

type CreditEntry = {
  id: string;
  action: string;
  credits_delta: number;
  note: string | null;
  created_at: string;
};

type StoreDetail = {
  products: Product[];
  orders: Order[];
  members: Member[];
  ledger: CreditEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_SECRET_TOKEN ?? "";

async function adminFetch(url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), "x-admin-token": ADMIN_TOKEN }
  });
}

const TABS = ["Products", "Orders", "Team", "Credits", "Stats"] as const;
type Tab = typeof TABS[number];

// ─── Remove Product Modal ─────────────────────────────────────────────────────

function RemoveProductModal({
  product, onClose, onSuccess
}: {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!product || !reason.trim()) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${product.name}" removed`);
      setReason("");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm border border-border p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-error mt-0.5 shrink-0" />
          <div>
            <h3 className="font-syne font-bold text-base text-ink">Remove Product</h3>
            <p className="text-sm text-ink-secondary mt-0.5">Remove &ldquo;{product.name}&rdquo; from the platform?</p>
          </div>
        </div>
        <div className="space-y-2 mb-5">
          <label className="text-sm font-medium text-ink-secondary">Reason (required)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Prohibited item, misleading description…"
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-ink resize-none focus:border-error outline-none transition-all"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 h-[40px] bg-surface border border-border rounded-lg text-sm font-medium text-ink-secondary hover:bg-surface-raised transition-colors">
            Cancel
          </button>
          <button onClick={handleRemove} disabled={loading || !reason.trim()}
            className="flex-1 h-[40px] bg-error text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Remove</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Store Detail Panel ───────────────────────────────────────────────────────

function StoreDetailPanel({
  store, onClose
}: {
  store: StoreInfo;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Products");
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removeProduct, setRemoveProduct] = useState<Product | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch via admin supabase directly through API endpoints that accept store id
      const [productsRes, ordersRes, membersRes, ledgerRes] = await Promise.all([
        adminFetch(`/api/admin/stores/${store.id}/products`),
        adminFetch(`/api/admin/stores/${store.id}/orders`),
        adminFetch(`/api/admin/stores/${store.id}/members`),
        adminFetch(`/api/admin/stores/${store.id}/ledger`),
      ]);

      const [p, o, m, l] = await Promise.all([
        productsRes.json(), ordersRes.json(), membersRes.json(), ledgerRes.json()
      ]);
      setDetail({ products: p.products ?? [], orders: o.orders ?? [], members: m.members ?? [], ledger: l.ledger ?? [] });
    } catch {
      toast.error("Failed to load store details");
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  return (
    <>
      <RemoveProductModal
        product={removeProduct}
        onClose={() => setRemoveProduct(null)}
        onSuccess={fetchDetail}
      />
      <div className="flex flex-col h-full">
        {/* Store Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-raised shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-saffron/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-saffron" />
              </div>
              <div>
                <h2 className="font-syne font-bold text-lg text-ink">{store.shop_name}</h2>
                <p className="text-sm text-ink-secondary">{store.email} · {store.category}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink-muted hover:text-ink transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Active Products", value: store.active_products, icon: Package },
              { label: "Orders", value: store.completed_orders, icon: ShoppingBag },
              { label: "Credits", value: store.credit_balance, icon: Wallet2 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-surface rounded-xl p-3 border border-border text-center">
                <Icon className="w-4 h-4 text-ink-muted mx-auto mb-1" />
                <p className="font-syne font-bold text-lg text-ink">{value}</p>
                <p className="text-[10px] text-ink-muted uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto hide-scrollbar">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? "bg-saffron/10 text-saffron" : "text-ink-secondary hover:text-ink hover:bg-surface"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-saffron animate-spin" />
            </div>
          ) : !detail ? null : (
            <>
              {tab === "Products" && (
                <div className="space-y-3">
                  {detail.products.length === 0 ? (
                    <p className="text-sm text-ink-muted text-center py-10">No products listed</p>
                  ) : detail.products.map(p => (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${p.active ? "border-border bg-surface-raised" : "border-border bg-surface opacity-60"}`}>
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface shrink-0">
                        <Image src={p.photo_url} alt={p.name} fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                        <p className="text-xs text-ink-muted">₹{p.price.toLocaleString("en-IN")} · {p.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.boosted && <span className="text-[10px] bg-saffron/10 text-saffron px-2 py-0.5 rounded-full font-semibold">Boosted</span>}
                        {p.active ? (
                          <button
                            onClick={() => setRemoveProduct(p)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-error hover:bg-error-bg transition-colors"
                            title="Remove product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-ink-muted bg-surface border border-border px-2 py-0.5 rounded-full">Inactive</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Orders" && (
                <div className="space-y-2">
                  {detail.orders.length === 0 ? (
                    <p className="text-sm text-ink-muted text-center py-10">No orders yet</p>
                  ) : detail.orders.map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 bg-surface-raised border border-border rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-ink">{o.buyer_name}</p>
                        <p className="text-xs text-ink-muted">{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-syne font-bold text-sm text-ink">₹{o.amount.toLocaleString("en-IN")}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${o.status === "completed" ? "bg-success-bg text-success" : "bg-surface border border-border text-ink-muted"}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Team" && (
                <div className="space-y-2">
                  {detail.members.length === 0 ? (
                    <p className="text-sm text-ink-muted text-center py-10">No team members</p>
                  ) : detail.members.filter(m => m.is_active).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-surface-raised border border-border rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-ink">{m.display_name ?? m.email ?? "Unknown"}</p>
                        <p className="text-xs text-ink-muted">{m.email}</p>
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-surface border border-border text-ink-secondary capitalize">
                        {m.role.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Credits" && (
                <div className="space-y-2">
                  <div className="bg-credit-light border border-border rounded-xl p-4 mb-4 text-center">
                    <p className="text-xs text-ink-muted mb-1 uppercase tracking-wider font-medium">Current Balance</p>
                    <p className="font-jetbrains-mono font-bold text-3xl text-credit">{store.credit_balance}</p>
                    <p className="text-xs text-ink-muted mt-1">credits</p>
                  </div>
                  {detail.ledger.length === 0 ? (
                    <p className="text-sm text-ink-muted text-center py-6">No transactions</p>
                  ) : detail.ledger.map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-surface-raised border border-border rounded-xl">
                      <div>
                        <p className="text-sm text-ink">{e.note ?? e.action}</p>
                        <p className="text-xs text-ink-muted">{new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                      <span className={`font-jetbrains-mono font-bold text-sm ${e.credits_delta > 0 ? "text-success" : "text-saffron"}`}>
                        {e.credits_delta > 0 ? "+" : ""}{e.credits_delta}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Stats" && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Total Products", value: detail.products.length, icon: Package, color: "text-saffron" },
                    { label: "Active Products", value: detail.products.filter(p => p.active).length, icon: Package, color: "text-success" },
                    { label: "Total Orders", value: detail.orders.length, icon: ShoppingBag, color: "text-ink" },
                    { label: "Team Members", value: detail.members.filter(m => m.is_active).length, icon: Users, color: "text-credit" },
                    { label: "Credit Balance", value: store.credit_balance, icon: Wallet2, color: "text-credit" },
                    {
                      label: "Total Revenue", icon: BarChart3, color: "text-success",
                      value: `₹${detail.orders.filter(o => o.status === "completed").reduce((s, o) => s + o.amount, 0).toLocaleString("en-IN")}`
                    },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-surface-raised border border-border rounded-xl p-4">
                      <Icon className={`w-5 h-5 ${color} mb-2`} />
                      <p className="font-syne font-bold text-xl text-ink">{value}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StoreInfo | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/stores");
      if (res.status === 403) { setAuthorized(false); setLoading(false); return; }
      const data = await res.json();
      setStores(data.stores ?? []);
      setAuthorized(true);
    } catch {
      toast.error("Failed to load stores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ADMIN_TOKEN) fetchStores();
    else setLoading(false);
  }, [fetchStores]);

  const filteredStores = stores.filter(s =>
    s.shop_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  // Admin gate — simple token prompt if env var not set client-side
  if (!authorized && !loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="bg-surface-raised border border-border rounded-2xl p-8 w-full max-w-sm text-center shadow-sm">
          <Shield className="w-12 h-12 text-ink-muted mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="font-syne font-bold text-2xl text-ink mb-2">Admin Access</h1>
          <p className="text-sm text-ink-secondary mb-6">Enter the admin token to access the workspace.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="Admin token"
            className="w-full h-[44px] px-3 bg-surface border border-border rounded-lg text-sm text-ink mb-3 focus:border-saffron outline-none"
          />
          <button
            onClick={async () => {
              const res = await fetch("/api/admin/stores", { headers: { "x-admin-token": tokenInput } });
              if (res.ok) {
                const data = await res.json();
                setStores(data.stores ?? []);
                setAuthorized(true);
              } else {
                toast.error("Invalid admin token");
              }
            }}
            className="w-full h-[44px] bg-saffron text-white rounded-lg font-medium hover:bg-saffron-dark transition-colors"
          >
            Access Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface flex overflow-hidden font-dm-sans">

      {/* LEFT SIDEBAR — Store List */}
      <div className={`${selected ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 xl:w-96 border-r border-border bg-surface-raised shrink-0`}>
        {/* Header */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-syne font-bold text-xl text-ink">Admin Workspace</h1>
              <p className="text-xs text-ink-muted mt-0.5">{stores.length} stores on platform</p>
            </div>
            <button
              onClick={fetchStores}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-surface text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search stores…"
              className="w-full h-[40px] pl-9 pr-3 bg-surface border border-border rounded-lg text-sm text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all"
            />
          </div>
        </div>

        {/* Store List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-saffron animate-spin" />
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Store className="w-8 h-8 text-ink-muted mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-secondary">{search ? "No stores match your search" : "No stores yet"}</p>
            </div>
          ) : (
            filteredStores.map(store => (
              <button
                key={store.id}
                onClick={() => setSelected(store)}
                className={`w-full text-left px-5 py-4 border-b border-border hover:bg-surface transition-colors ${selected?.id === store.id ? "bg-saffron/5 border-l-4 border-l-saffron" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-ink truncate">{store.shop_name}</p>
                    <p className="text-xs text-ink-muted truncate">{store.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <p className="text-xs font-medium text-ink">{store.active_products}</p>
                      <p className="text-[10px] text-ink-muted">products</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-muted" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Store Detail */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <StoreDetailPanel
            store={selected}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-surface-raised border border-border rounded-2xl flex items-center justify-center mb-5 shadow-sm">
              <Store className="w-9 h-9 text-ink-muted" strokeWidth={1.5} />
            </div>
            <h2 className="font-syne font-bold text-2xl text-ink mb-2">Select a Store</h2>
            <p className="text-sm text-ink-secondary max-w-xs">Choose a store from the sidebar to view its products, orders, team, and credit history.</p>
          </div>
        )}
      </div>

    </div>
  );
}

// Suppress unused import
function Shield({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} strokeWidth={strokeWidth} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
