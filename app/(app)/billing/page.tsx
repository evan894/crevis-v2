"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, CreditCard, TrendingUp, Clock, Building2, Shield } from "lucide-react";

type LedgerEntry = {
  id: string;
  action: string;
  credits_delta: number;
  credit_type: string;
  note: string | null;
  created_at: string;
};

type Order = {
  id: string;
  buyer_name: string;
  amount: number;
  status: string;
  created_at: string;
  credits_released: boolean;
  return_requested: boolean;
};

export default function BillingPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [earnedCredits, setEarnedCredits] = useState<number>(0);
  const [promoCredits, setPromoCredits] = useState<number>(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bankAccount, setBankAccount] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from("store_members")
        .select("role, seller_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      let sellerId: string | null = null;
      if (member) {
        setUserRole(member.role);
        sellerId = member.seller_id;
      } else {
        setUserRole("owner");
        const { data: seller } = await supabase
          .from("sellers")
          .select("id")
          .eq("user_id", user.id)
          .single();
        sellerId = seller?.id ?? null;
      }

      if (!sellerId) { setLoading(false); return; }

      // Fetch seller balances
      const { data: seller } = await supabase
        .from("sellers")
        .select("credit_balance, earned_credits, promo_credits")
        .eq("id", sellerId)
        .single();

      if (seller) {
        setBalance(seller.credit_balance);
        setEarnedCredits(seller.earned_credits);
        setPromoCredits(seller.promo_credits);
      }

      // Fetch ledger last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: ledgerData } = await supabase
        .from("credit_ledger")
        .select("*")
        .eq("seller_id", sellerId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      setLedger(ledgerData ?? []);

      // Fetch recent orders (earnings timeline)
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, buyer_name, amount, status, created_at, credits_released, return_requested")
        .eq("seller_id", sellerId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(20);

      setOrders(orderData ?? []);

      // Bank account (last 4 digits + verified status)
      const { data: bankData } = await supabase
        .from("seller_bank_accounts")
        .select("account_number, bank_name, verified")
        .eq("seller_id", sellerId)
        .maybeSingle();

      setBankAccount(bankData);

      setLoading(false);
    };
    load();
  }, [supabase]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-saffron" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <div className="mb-8 flex items-center gap-3">
        <CreditCard className="w-7 h-7 text-saffron" />
        <div>
          <h1 className="font-syne text-3xl font-bold text-ink">Billing Overview</h1>
          <p className="font-dm-sans text-ink-secondary mt-1 text-sm">
            Read-only financial summary for this store.
          </p>
        </div>
      </div>

      <div className="space-y-6">

        {/* Balance Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-raised border border-border rounded-lg p-5 shadow-sm">
            <p className="font-dm-sans text-xs text-ink-secondary mb-1">Total Balance</p>
            <p className="font-syne text-2xl font-bold text-ink">{balance} CC</p>
            <p className="text-xs text-ink-muted mt-1">= ₹{balance}</p>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-success" />
              <p className="font-dm-sans text-xs text-ink-secondary">Earned Credits</p>
            </div>
            <p className="font-syne text-2xl font-bold text-success">{earnedCredits} CC</p>
            <p className="text-xs text-ink-muted mt-1">Withdrawable</p>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-saffron" />
              <p className="font-dm-sans text-xs text-ink-secondary">Promo Credits</p>
            </div>
            <p className="font-syne text-2xl font-bold text-saffron">{promoCredits} CC</p>
            <p className="text-xs text-ink-muted mt-1">Platform use only</p>
          </div>
        </div>

        {/* Bank Account */}
        <div className="bg-surface-raised border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-ink-secondary" />
            <h2 className="font-syne text-base font-bold text-ink">Payout Account</h2>
          </div>
          {bankAccount ? (
            <div className="flex items-center justify-between bg-surface border border-border rounded-md p-3">
              <div>
                <p className="text-sm font-dm-sans font-medium text-ink">{bankAccount.bank_name || "Bank Account"}</p>
                <p className="text-sm font-jetbrains-mono text-ink-secondary">••••{bankAccount.account_number.slice(-4)}</p>
              </div>
              <span className={`text-xs font-dm-sans px-2 py-1 rounded-full ${bankAccount.verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {bankAccount.verified ? "Verified ✅" : "Pending ⏳"}
              </span>
            </div>
          ) : (
            <p className="text-sm font-dm-sans text-ink-secondary">No bank account added yet.</p>
          )}
          {userRole !== "owner" && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
              <Shield className="w-3.5 h-3.5" />
              <span>Only the store owner can edit payout account settings.</span>
            </div>
          )}
        </div>

        {/* Orders Earnings Timeline */}
        <div className="bg-surface-raised border border-border rounded-lg p-5 shadow-sm">
          <h2 className="font-syne text-base font-bold text-ink mb-4">Order Earnings</h2>
          {orders.length === 0 ? (
            <p className="text-sm font-dm-sans text-ink-secondary">No delivered orders yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {orders.map(order => (
                <div key={order.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-dm-sans font-medium text-ink">{order.buyer_name || "Buyer"}</p>
                    <p className="text-xs text-ink-muted">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-ink">₹{order.amount}</p>
                    {order.return_requested ? (
                      <span className="text-xs text-error">Return requested</span>
                    ) : order.credits_released ? (
                      <span className="text-xs text-success">Credited ✓</span>
                    ) : (
                      <span className="text-xs text-saffron">Holding (2-day window)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payout History / Ledger */}
        <div className="bg-surface-raised border border-border rounded-lg p-5 shadow-sm">
          <h2 className="font-syne text-base font-bold text-ink mb-4">Transaction History (Last 30 days)</h2>
          {ledger.length === 0 ? (
            <p className="text-sm font-dm-sans text-ink-secondary">No transactions in the last 30 days.</p>
          ) : (
            <div className="divide-y divide-border">
              {ledger.map(entry => (
                <div key={entry.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-dm-sans font-medium text-ink capitalize">
                      {entry.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-ink-muted">{formatDate(entry.created_at)}</p>
                    {entry.note && <p className="text-xs text-ink-secondary">{entry.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium font-jetbrains-mono ${entry.credits_delta >= 0 ? "text-success" : "text-error"}`}>
                      {entry.credits_delta >= 0 ? "+" : ""}{entry.credits_delta} CC
                    </p>
                    <p className="text-xs text-ink-muted capitalize">{entry.credit_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
