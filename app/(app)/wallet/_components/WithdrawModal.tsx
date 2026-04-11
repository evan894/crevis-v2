"use client";

import { useState } from "react";
import { Loader2, Banknote, AlertCircle, X } from "lucide-react";
import { toast } from "react-hot-toast";

export type BankAccount = {
  verified: boolean;
  account_number: string;
  bank_name: string | null;
  razorpay_fund_account_id: string | null;
};

export function WithdrawModal({
  earnedCredits, bankAccount, onClose, onSuccess
}: {
  earnedCredits: number | null;
  bankAccount: BankAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

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
      onClose();
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink">
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
  );
}
