"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, Wallet as WalletIcon, TrendingUp, TrendingDown, Clock, Banknote, X, AlertCircle } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import confetti from "canvas-confetti";
import { toast } from "react-hot-toast";

type LedgerEntry = {
  id: string;
  action: string;
  credits_delta: number;
  credit_type: string;
  note: string | null;
  created_at: string;
};

type Withdrawal = {
  id: string;
  amount_credits: number;
  amount_inr: number;
  status: string;
  razorpay_payout_id: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
};

type BankAccount = {
  verified: boolean;
  account_number: string;
  bank_name: string | null;
  razorpay_fund_account_id: string | null;
};

import { CREDIT_PACKAGES, CREDIT_LOW_THRESHOLD } from "@/lib/constants";

export default function WalletPage() {

  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [earnedCredits, setEarnedCredits] = useState<number | null>(null);
  const [promoCredits, setPromoCredits] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Withdrawal state
  const [userRole, setUserRole] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    fetchWalletData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine seller and role
      const { data: member } = await supabase.from('store_members').select('role, seller_id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      
      let targetSellerId: string | null = null;
      if (member) {
        setUserRole(member.role);
        targetSellerId = member.seller_id;
      } else {
        setUserRole('owner');
      }

      let sellerQuery = supabase.from('sellers').select('id, credit_balance, earned_credits, promo_credits');
      if (targetSellerId) sellerQuery = sellerQuery.eq('id', targetSellerId);
      else sellerQuery = sellerQuery.eq('user_id', user.id);

      const { data: seller } = await sellerQuery.single();
      if (!seller) return;

      setBalance(seller.credit_balance);
      setEarnedCredits(seller.earned_credits);
      setPromoCredits(seller.promo_credits);

      // Fetch ledger
      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false });
      if (ledgerData) setLedger(ledgerData);

      // Fetch withdrawals
      const { data: wData } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (wData) setWithdrawals(wData);

      // Fetch bank account (only if owner)
      const role = member?.role ?? 'owner';
      if (role === 'owner') {
        const { data: bankData } = await supabase
          .from('seller_bank_accounts')
          .select('verified, account_number, bank_name, razorpay_fund_account_id')
          .eq('seller_id', seller.id)
          .maybeSingle();
        setBankAccount(bankData ?? null);
      }
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

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(withdrawAmount, 10);
    if (isNaN(amt) || amt < 100) return toast.error("Minimum withdrawal is ₹100");
    if (amt > (earnedCredits ?? 0)) return toast.error("Insufficient earned credits");

    setWithdrawLoading(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');

      toast.success(`₹${amt} withdrawal initiated!`);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      fetchWalletData();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const withdrawDisabledReason = (): string | null => {
    if (userRole !== 'owner') return 'Only owners can withdraw';
    if (!bankAccount) return 'Add a bank account in Settings first';
    if (!bankAccount.verified) return 'Bank account verification pending';
    if ((earnedCredits ?? 0) < 100) return 'Minimum withdrawal is ₹100 (earn more)';
    return null;
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
              <h2 className="text-sm font-medium text-ink-secondary mb-1">Total Credits</h2>
              <p className="font-jetbrains-mono font-bold text-[34px] text-credit tracking-tight mb-4">
                 {balance ?? 0} <span className="text-sm tracking-normal text-ink-muted">CC</span>
              </p>
              
              {balance !== null && (
                <div className={`mt-1 mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                   balance < 0 ? 'bg-error-bg text-error border-error/20' : 
                   balance < CREDIT_LOW_THRESHOLD ? 'bg-warning-bg text-warning-content border-warning/20' : 
                   'bg-success-bg text-success border-success/20'
                }`}>
                   {balance < 0 ? '❌ Store Paused (Negative Balance)' : 
                    balance < CREDIT_LOW_THRESHOLD ? '⚠️ Limited Mode (Top up to List/Boost)' : 
                    '✅ Store Fully Active'}
                </div>
              )}
              
              <div className="w-full flex sm:flex-row flex-col justify-center gap-8 mt-2 pt-6 border-t border-border">
                 <div className="flex flex-col items-center">
                   <span className="text-xs text-ink-secondary mb-1">Earned</span>
                   <span className="font-jetbrains-mono font-bold text-success text-xl">{earnedCredits ?? 0}</span>
                   {(() => {
                     const reason = withdrawDisabledReason();
                     return (
                       <button
                         onClick={() => !reason && setShowWithdrawModal(true)}
                         disabled={!!reason}
                         title={reason ?? undefined}
                         className="text-xs mt-2 font-medium text-success bg-success/10 px-3 py-1 rounded-md hover:bg-success hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                       >
                         <Banknote className="w-3.5 h-3.5" />
                         Withdraw →
                       </button>
                     );
                   })()}
                 </div>
                <div className="hidden sm:block w-px bg-border h-full"></div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-ink-secondary mb-1">Promotional</span>
                  <span className="font-jetbrains-mono font-bold text-purple-600 text-xl">{promoCredits ?? 0}</span>
                  <span className="text-xs text-ink-muted mt-2">Platform use only</span>
                </div>
              </div>
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
                                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Type</th>
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
                                     <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${entry.credit_type === 'earned' ? 'bg-success/10 text-success' : 'bg-purple-100 text-purple-700'}`}>
                                          {entry.credit_type}
                                        </span>
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

           {/* Withdrawal History */}
           {withdrawals.length > 0 && (
             <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
               <div className="p-6 border-b border-border">
                 <h3 className="font-syne font-bold text-xl text-ink">Withdrawal History</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-surface text-ink-muted border-b border-border">
                       <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Date</th>
                       <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Amount</th>
                       <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
                       <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider">Reference</th>
                     </tr>
                   </thead>
                   <tbody>
                     {withdrawals.map((w) => (
                       <tr key={w.id} className="border-b border-border hover:bg-surface/50">
                         <td className="px-6 py-4 text-sm text-ink-secondary whitespace-nowrap">
                           {new Date(w.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                         </td>
                         <td className="px-6 py-4">
                           <span className="font-jetbrains-mono text-sm font-bold text-ink">₹{w.amount_inr}</span>
                           <span className="text-xs text-ink-muted ml-1">({w.amount_credits} CC)</span>
                         </td>
                         <td className="px-6 py-4">
                           <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${
                             w.status === 'completed' ? 'bg-success/10 text-success' :
                             w.status === 'failed' ? 'bg-error/10 text-error' :
                             w.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                             'bg-warning/10 text-warning'
                           }`}>
                             {w.status}
                           </span>
                           {w.status === 'failed' && w.failure_reason && (
                             <p className="text-xs text-error mt-0.5">{w.failure_reason}</p>
                           )}
                         </td>
                         <td className="px-6 py-4 text-xs text-ink-muted font-jetbrains-mono">
                           {w.razorpay_payout_id ?? '—'}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

        </div>
      </main>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowWithdrawModal(false)} className="absolute top-4 right-4 text-ink-muted hover:text-ink">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Banknote className="w-5 h-5 text-success" />
              <h2 className="font-syne text-xl font-bold text-ink">Withdraw Earnings</h2>
            </div>
            <div className="mb-4 p-3 bg-success/5 border border-success/20 rounded-lg">
              <p className="text-xs text-ink-secondary">Available to withdraw</p>
              <p className="font-jetbrains-mono text-2xl font-bold text-success">{earnedCredits} CC</p>
              <p className="text-xs text-ink-muted">= ₹{earnedCredits} (1 CC = ₹1)</p>
            </div>
            {bankAccount && (
              <div className="mb-4 p-3 bg-surface border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-secondary">{bankAccount.bank_name ?? 'Bank'}</p>
                  <p className="text-sm font-jetbrains-mono text-ink">••••{bankAccount.account_number.slice(-4)}</p>
                </div>
                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Verified ✅</span>
              </div>
            )}
            <form onSubmit={handleWithdraw} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary">Amount (₹)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">₹</span>
                  <input
                    required
                    type="number"
                    min={100}
                    max={earnedCredits ?? 0}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full h-10 pl-8 pr-3 bg-surface border border-border rounded-md font-dm-sans text-sm outline-none focus:border-success focus:ring-1 focus:ring-success"
                    placeholder="100"
                  />
                </div>
                {withdrawAmount && (
                  <p className="text-xs text-ink-muted mt-1">
                    = {withdrawAmount} credits will be deducted from your earned balance
                  </p>
                )}
              </div>
              <div className="flex items-start gap-2 text-xs text-ink-muted bg-surface-raised border border-border rounded p-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Transfers via IMPS. Usually credited in 1-2 business days.</span>
              </div>
              <button
                type="submit"
                disabled={withdrawLoading || !withdrawAmount}
                className="w-full h-10 bg-success text-white rounded-md font-medium text-sm hover:opacity-90 transition-opacity flex justify-center items-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {withdrawLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Withdrawal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
