"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, Wallet as WalletIcon, CheckCircle2, TrendingUp, TrendingDown, Clock } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import confetti from "canvas-confetti";

type LedgerEntry = {
  id: string;
  action: string;
  credits_delta: number;
  note: string | null;
  created_at: string;
};

const PACKAGES = [
  { price: 100, credits: 100 },
  { price: 500, credits: 550 },
  { price: 1000, credits: 1200 },
];

export default function WalletPage() {

  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const doFetch = async () => {
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
    doFetch();
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
    setMessage(null);
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
            
            setMessage({ text: `${data.credits} credits added successfully!`, type: "success" });
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#F4631E', '#7C5CBF', '#1A7F4B'] });
          } catch (err: unknown) {
            if (err instanceof Error) {
               setMessage({ text: err.message || "Payment verification failed", type: "error" });
            }
          }
        }
      };

      // @ts-expect-error script loaded globally
      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function () {
         setMessage({ text: "Payment failed or was cancelled.", type: "error" });
      });
      razorpayInstance.open();

    } catch (err: unknown) {
      if (err instanceof Error) setMessage({ text: err.message, type: "error" });
      else setMessage({ text: "Failed to initialize checkout", type: "error" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) return;
    
    setCouponLoading(true);
    setMessage(null);
    
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
      
      setMessage({ text: "Coupon redeemed successfully!", type: "success" });
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#F4631E', '#7C5CBF', '#1A7F4B'] });
    } catch (err: unknown) {
      if (err instanceof Error) setMessage({ text: err.message, type: "error" });
      else setMessage({ text: "Failed to redeem code", type: "error" });
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
        
        {/* Banner Messages */}
        {message && (
          <div className={`mb-8 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-success-bg border border-success/20 text-success' : 'bg-error-bg border border-error/20 text-error'}`}>
             <div className="flex items-center gap-2">
                 {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 rotate-0" />}
                 <span className="font-medium text-sm">{message.text}</span>
             </div>
             <button onClick={() => setMessage(null)} className="text-sm opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           
           {/* Left Column: Hero & Top-up */}
           <div className="lg:col-span-1 space-y-8">
              
              {/* Balance Hero Card */}
              <div className="bg-credit-light border border-border-strong rounded-xl p-8 flex flex-col items-center text-center shadow-sm">
                 <WalletIcon className="w-8 h-8 text-credit mb-4" />
                 <h2 className="text-sm font-medium text-ink-secondary mb-1">Available Credits</h2>
                 <p className="font-jetbrains-mono font-bold text-5xl text-credit tracking-tight mb-2">
                    {balance ?? 0}
                 </p>
                 <p className="text-xs text-ink-muted">1 credit = 1 listing or priority action</p>
              </div>

              {/* Purchase Packages */}
              <div className="bg-surface-raised border border-border rounded-xl p-6">
                 <h3 className="font-syne font-bold text-lg text-ink mb-4">Top up wallet</h3>
                 <div className="flex flex-col gap-3">
                    {PACKAGES.map((pkg) => (
                       <button
                         key={pkg.price}
                         onClick={() => handlePurchase(pkg.price)}
                         disabled={checkoutLoading !== null}
                         className="h-[54px] px-4 w-full bg-surface border border-border-strong rounded-lg flex items-center justify-between hover:border-saffron hover:shadow-sm transition-all duration-base group disabled:opacity-70 disabled:cursor-not-allowed"
                       >
                         <span className="font-jetbrains-mono font-bold text-ink">₹{pkg.price}</span>
                         {checkoutLoading === pkg.price ? (
                           <Loader2 className="w-5 h-5 text-saffron animate-spin" />
                         ) : (
                           <span className="font-medium text-saffron text-sm bg-saffron/10 px-3 py-1 rounded-md group-hover:bg-saffron group-hover:text-surface-raised transition-colors">
                              +{pkg.credits} C
                           </span>
                         )}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Redeem Coupon */}
              <div className="bg-surface-raised border border-border rounded-xl p-6">
                 <h3 className="font-syne font-bold text-lg text-ink mb-2">Have a coupon?</h3>
                 <p className="text-xs text-ink-secondary mb-4">Redeem your code for free credits.</p>
                 
                 <form onSubmit={handleRedeemCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CREVIS100"
                      className="flex-1 h-[44px] px-3 bg-surface border border-border-strong rounded-md font-jetbrains-mono text-sm uppercase tracking-wider focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all"
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

           {/* Right Column: Ledger */}
           <div className="lg:col-span-2">
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
