"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, CheckCircle2, Ticket } from "lucide-react";
import confetti from "canvas-confetti";
import { CATEGORIES } from "@/lib/constants";
import { toast } from "react-hot-toast";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initStep = parseInt(searchParams.get("step") || "1", 10);
  
  const [step, setStep] = useState(initStep);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("Clothing");

  const [couponCode, setCouponCode] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        supabase.from("sellers").select("id, slack_access_token").eq("user_id", data.user.id).single()
          .then((res) => {
             if (res.data) {
                setSellerId(res.data.id);
             }
             if (res.data && !redeemSuccess) {
                // If they are fully onboarded and somehow landed here without trying to redeem, maybe push to dashboard
                // but let's just respect the steps for now unless we add an explicit dashboard jump.
                if (res.data.slack_access_token && step < 3) {
                   setStep(3);
                } else if (step === 1) {
                   setStep(2);
                }
             }
          });
      } else {
        router.push("/auth");
      }
    });
  }, [supabase, router, step, redeemSuccess]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return toast.error("Shop name is required");
    if (!userId) return toast.error("User session not found");
    
    setLoading(true);
    try {
      const { data: newSeller, error: dbError } = await supabase.from("sellers").insert({
        user_id: userId,
        shop_name: shopName,
        category: category,
      }).select("id").single();
      if (dbError) throw dbError;
      setSellerId(newSeller.id);
      setStep(2);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Failed to create shop");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/credits/redeem-coupon", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to redeem code");
      
      setNewBalance(data.newBalance);
      setRedeemSuccess(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F4631E', '#7C5CBF', '#1A7F4B']
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const isSlackSuccess = searchParams.get("connected") === "true";

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center py-12 px-6 selection:bg-saffron selection:text-surface-raised">
      
      {/* Progress Bar */}
      <div className="w-full max-w-md mb-12">
        <div className="flex justify-between mb-2">
          <span className="font-jetbrains-mono text-xs text-ink-muted uppercase tracking-wider">Step {step} of 3</span>
          <span className="font-jetbrains-mono text-xs text-ink-muted uppercase tracking-wider">
            {step === 1 ? "Shop Details" : step === 2 ? "Connect Slack" : "Redeem Credits"}
          </span>
        </div>
        <div className="h-2 w-full bg-border rounded-full overflow-hidden flex">
          <div className="h-full bg-saffron transition-all duration-slow ease-out-custom" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      <div className="w-full max-w-md bg-surface-raised border border-border shadow-sm rounded-lg p-8">
        
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-base">
            <h1 className="font-syne text-2xl font-bold text-ink mb-2">Name your shop</h1>
            <p className="font-dm-sans text-sm text-ink-secondary mb-6">
              This will be publicly visible to your customers across all checkout links.
            </p>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1">Shop Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  disabled={loading}
                  className="w-full h-[44px] px-3 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast"
                  placeholder="e.g. Bombay Curations"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-dm-sans font-medium text-ink-secondary ml-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={loading}
                  className="w-full h-[44px] px-3 bg-surface-raised border border-border rounded-md font-dm-sans text-base text-ink focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast appearance-none"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[44px] mt-6 flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue"}
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-base text-center">
            <h1 className="font-syne text-2xl font-bold text-ink mb-2">Connect your team</h1>
            <p className="font-dm-sans text-sm text-ink-secondary mb-8">
              Crevis will instantly notify you via Slack whenever a new order is received or a customer requests assistance.
            </p>

            {isSlackSuccess ? (
              <div className="mb-8 p-4 bg-success-bg border border-success/20 rounded-lg flex flex-col items-center">
                <CheckCircle2 className="text-success w-8 h-8 mb-2" />
                <p className="font-dm-sans font-medium text-success text-sm">Slack successfully connected!</p>
              </div>
            ) : (
              <div className="mb-8 space-y-3">
                <a 
                  href={`/api/auth/slack?sellerId=${sellerId || ""}`}
                  className="w-full h-[48px] flex items-center justify-center bg-surface-raised border border-border-strong text-ink rounded-md font-dm-sans font-medium hover:border-ink transition-all duration-base shadow-sm"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 10.12a2.528 2.528 0 0 1 2.52 2.522v2.522H5.042zm3.36 0a2.528 2.528 0 0 1 2.52-2.523 2.528 2.528 0 0 1 2.52 2.522v5.882a2.528 2.528 0 1 1-5.04 0v-5.88zM8.402 8.4A2.528 2.528 0 0 1 8.402 3.36a2.528 2.528 0 0 1 2.52 2.522v2.522H8.401zm0 3.361a2.528 2.528 0 0 1 2.52 2.523 2.528 2.528 0 0 1-2.52 2.522H2.52A2.528 2.528 0 1 1 2.522 11.76h5.88zM18.96 8.4a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.522h-2.52V10.92A2.528 2.528 0 0 1 18.96 8.4zm-3.36 0a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.52-2.522V2.518A2.528 2.528 0 1 1 15.6 2.518v5.88zM15.6 15.6a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.52-2.523v-2.521h2.52a2.528 2.528 0 0 1 2.52 2.521zm0-3.36A2.528 2.528 0 0 1-13.08 9.717a2.528 2.528 0 0 1 2.52-2.522h5.88a2.528 2.528 0 1 1 0 5.044h-5.88z"/>
                  </svg>
                  Connect Slack Workspace
                </a>
                {searchParams.get("error") && <p className="text-error text-xs font-dm-sans text-left mt-2">Failed to connect Slack. Try again.</p>}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep(3)}
                className="flex-1 h-[44px] bg-transparent border border-transparent text-ink-secondary hover:bg-surface rounded-md font-dm-sans font-medium transition-colors duration-fast"
              >
                Skip for now
              </button>
              {isSlackSuccess && (
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 h-[44px] bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark transition-colors duration-fast"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-base">
            <h1 className="font-syne text-2xl font-bold text-ink mb-2">Claim your credits</h1>
            <p className="font-dm-sans text-sm text-ink-secondary mb-6">
              Enter your early-access coupon code to fund your wallet and publish your first listings.
            </p>

            {redeemSuccess ? (
              <div className="flex flex-col items-center animate-in zoom-in-95 duration-base">
                <div className="w-16 h-16 bg-success-bg text-success rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-syne text-xl font-bold text-success mb-2">100 credits added!</h3>
                <p className="font-jetbrains-mono text-sm text-credit bg-credit-light px-3 py-1 rounded-md mb-8">
                  BALANCE: {newBalance}.00
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full h-[44px] bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <form onSubmit={handleRedeem} className="space-y-4">
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Ticket className="w-5 h-5 text-ink-muted" />
                   </div>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="w-full h-[54px] pl-10 pr-3 bg-surface-raised border border-border-strong rounded-md font-jetbrains-mono text-lg text-ink font-bold placeholder:text-ink-muted focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all duration-fast uppercase tracking-widest text-center"
                    placeholder="CREVIS100"
                  />
                </div>

                <div className="flex gap-4 mt-6">
                   <button
                     type="button"
                     onClick={() => router.push("/dashboard")}
                     className="flex-1 h-[44px] bg-transparent border border-transparent text-ink-secondary hover:bg-surface rounded-md font-dm-sans font-medium transition-colors duration-fast"
                   >
                     Skip for now
                   </button>
                   <button
                     type="submit"
                     disabled={loading || !couponCode}
                     className="flex-1 h-[44px] flex items-center justify-center bg-saffron text-surface-raised rounded-md font-dm-sans font-medium hover:bg-saffron-dark hover:shadow-saffron active:scale-[0.98] transition-all duration-base disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Redeem"}
                   </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex justify-center items-center"><Loader2 className="animate-spin text-saffron" /></div>}>
      <OnboardingContent />
    </Suspense>
  )
}
