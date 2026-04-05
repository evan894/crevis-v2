"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, Wallet as WalletIcon, TrendingUp, TrendingDown, Clock } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import confetti from "canvas-confetti";
import { toast } from "react-hot-toast";

type LedgerEntry = {
  id: string;
  action: string;
  credits_delta: number;
  note: string | null;
  created_at: string;
};

import { CREDIT_PACKAGES } from "@/lib/constants";

export default function WalletPage() {

  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    fetchWalletData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: seller } = await supabase.from('sellers').select('id, credit_balance').eq('user_id', user.id).single();
      if (!seller) return;

      setBalance(seller.credit_balance);

      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false });

      if (ledgerData) setLedger(ledgerData);
    } catch (err) {
      console.error("Fetch wallet failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (amount: number) => {
    setCheckoutLoading(amount);
    try {
      // 1. Create order
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 2. Open Razorpay Checkout
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "Crevis Credits",
        description: `Top up ${data.credits} credits`,
        order_id: data.id,
        theme: { color: "#F4631E" },
        handler: async function (response: { razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }) {
          try {
            // 3. Verify on server
            const verifyRes = await fetch("/api/credits/verify", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 razorpay_order_id: response.razorpay_order_id,
                 razorpay_payment_id: response.razorpay_payment_id,
                 razorpay_signature: response.razorpay_signature,
                 credits: data.credits
               })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error);
            
            // 4. Success UI
            setBalance(verifyData.newBalance);
            fetchWalletData(); // refresh ledger
            
            toast.success(`${data.credits} credits added successfully!`);
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#F4631E', '#7C5CBF', '#1A7F4B'] });
          } catch (err: unknown) {
            if (err instanceof Error) {
               toast.error(err.message || "Payment verification failed");
            }
          }
        }
      };

      // @ts-expect-error script loaded globally
      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function () {
         toast.error("Payment failed or was cancelled.");
      });
      razorpayInstance.open();

    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Failed to initialize checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) return;
    
    setCouponLoading(true);
    
    try {
      const res = await fetch("/api/credits/redeem-coupon", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setBalance(data.newBalance);
      setCouponCode("");
      fetchWalletData(); // refresh ledger
      
      toast.success("Coupon redeemed successfully!");
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#F4631E', '#7C5CBF', '#1A7F4B'] });
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Failed to redeem code");
    } finally {
      setCouponLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="w-8 h-8 text-saffron animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-surface selection:bg-saffron selection:text-surface-raised font-dm-sans pb-20">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      
      {/* Navbar Minimal */}
      <nav className="h-16 border-b border-border bg-surface-raised px-6 flex items-center sticky top-0 z-50">
        <Link href="/dashboard" className="text-ink-secondary hover:text-ink transition-colors flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        
        {/* Banner Messages (Replaced by Toaster) */}

        <div className="space-y-8">

           {/* Balance Hero Card */}
           <div className="bg-credit-light border border-border-strong rounded-xl p-8 flex flex-col items-center text-center shadow-sm">
              <WalletIcon className="w-8 h-8 text-credit mb-4" />
              <h2 className="text-sm font-medium text-ink-secondary mb-1">Available Credits</h2>
              <p className="font-jetbrains-mono font-bold text-[34px] text-credit tracking-tight mb-2">
                 {balance ?? 0}
              </p>
              <p className="text-xs text-ink-muted">1 credit = 1 listing or priority action</p>
           </div>

           {/* Top-up + Coupon side by side */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
              {/* Purchase Packages */}
              <div className="min-w-0 bg-surface-raised border border-border rounded-xl p-6">
                 <h3 className="font-syne font-bold text-lg text-ink mb-4">Top up wallet</h3>
                 <div className="flex flex-col gap-3">
                    {CREDIT_PACKAGES.map((pkg) => (
                       <button
                         key={pkg.amount}
                         onClick={() => handlePurchase(pkg.amount)}
                         disabled={checkoutLoading !== null}
                         className="h-[54px] px-4 w-full bg-surface border border-border-strong rounded-lg flex items-center justify-between hover:border-saffron hover:shadow-sm transition-all duration-base group disabled:opacity-70 disabled:cursor-not-allowed"
                       >
                         <span className="font-jetbrains-mono font-bold text-ink">₹{pkg.amount}</span>
                         {checkoutLoading === pkg.amount ? (
                           <Loader2 className="w-5 h-5 text-saffron animate-spin" />
                         ) : (
                           <span className="font-medium text-saffron text-sm bg-saffron/10 px-3 py-1 rounded-md group-hover:bg-saffron group-hover:text-surface-raised transition-colors whitespace-nowrap">
                              +{pkg.credits.toLocaleString()} C
                           </span>
                         )}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Redeem Coupon */}
              <div className="min-w-0 bg-surface-raised border border-border rounded-xl p-6">
                 <h3 className="font-syne font-bold text-lg text-ink mb-2">Have a coupon?</h3>
                 <p className="text-xs text-ink-secondary mb-4">Redeem your code for free credits.</p>

                 <form onSubmit={handleRedeemCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CREVIS100"
                      className="flex-1 min-w-0 h-[44px] px-3 bg-surface border border-border-strong rounded-md font-jetbrains-mono text-sm uppercase tracking-wider focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponCode}
                      className="h-[44px] px-4 bg-ink text-surface-raised rounded-md text-sm font-medium hover:bg-ink-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </button>
                 </form>
              </div>
           </div>

           {/* Ledger */}
           <div>
              <div className="bg-surface-raised border border-border rounded-xl overflow-hidden h-full flex flex-col">
                 <div className="p-6 border-b border-border">
                    <h3 className="font-syne font-bold text-xl text-ink">Transaction History</h3>
                 </div>
                 
                 <div className="flex-1 overflow-x-auto min-h-[400px]">
                    {ledger.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center p-12 text-center text-ink-muted">
                           <Clock className="w-10 h-10 mb-3 opacity-20" />
                           <p className="text-sm">No transactions yet.</p>
                       </div>
                    ) : (
                       <table className="w-full text-left border-collapse">
                          <thead>
                             <tr className="bg-surface text-ink-muted border-b border-border">
                                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Note</th>
                                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-right">Delta</th>
                             </tr>
                          </thead>
                          <tbody>
                             {ledger.map((entry) => {
                                const isPositive = entry.credits_delta > 0;
                                return (
                                  <tr key={entry.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-secondary">
                                        {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                     </td>
                                     <td className="px-6 py-4 text-sm text-ink">
                                        {entry.note || entry.action}
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className={`inline-flex items-center justify-end font-jetbrains-mono font-bold text-sm ${isPositive ? 'text-success' : 'text-saffron'}`}>
                                           {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                           {isPositive ? '+' : ''}{entry.credits_delta}
                                        </div>
                                     </td>
                                  </tr>
                                );
                             })}
                          </tbody>
                       </table>
                    )}
                 </div>
              </div>
           </div>

        </div>
      </main>
    </div>
  );
}
