"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { toast } from "react-hot-toast";

export function BankModal({
  sellerId, onClose, onSuccess
}: {
  sellerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createBrowserClient();
  const [accHolderName, setAccHolderName] = useState("");
  const [accNumber, setAccNumber] = useState("");
  const [accConfirm, setAccConfirm] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accType, setAccType] = useState("savings");
  const [bankName, setBankName] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);

  useEffect(() => {
    if (ifsc.length >= 6) {
      setIfscLoading(true);
      fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.BANK) setBankName(data.BANK);
        })
        .finally(() => setIfscLoading(false));
    }
  }, [ifsc]);

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accNumber !== accConfirm) return toast.error("Account numbers do not match");

    setBankSubmitting(true);
    try {
      const res = await fetch('/api/bank/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          accountHolderName: accHolderName,
          accountNumber: accNumber,
          ifsc: ifsc.toUpperCase(),
          accountType: accType,
          bankName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify account");

      toast.success("Bank account added and verified");
      onClose();

      const { data: bankData } = await supabase
        .from('seller_bank_accounts')
        .select('*')
        .eq('seller_id', sellerId)
        .single();
      if (bankData) onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setBankSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-syne text-xl font-bold text-ink mb-4">Bank Account Details</h2>
        <form onSubmit={handleBankSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-dm-sans font-medium text-ink-secondary">Account Holder Name</label>
            <input required type="text" value={accHolderName} onChange={e => setAccHolderName(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-md font-dm-sans text-sm outline-none focus:border-saffron focus:ring-1 focus:ring-saffron" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-dm-sans font-medium text-ink-secondary">Account Number</label>
            <input required type="password" value={accNumber} onChange={e => setAccNumber(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-md font-dm-sans text-sm outline-none focus:border-saffron" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-dm-sans font-medium text-ink-secondary">Re-enter Account Number</label>
            <input required type="password" value={accConfirm} onChange={e => setAccConfirm(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-md font-dm-sans text-sm outline-none focus:border-saffron" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-dm-sans font-medium text-ink-secondary">IFSC Code</label>
            <input required type="text" value={ifsc} maxLength={11} onChange={e => setIfsc(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-md font-dm-sans text-sm uppercase outline-none focus:border-saffron" />
            {ifscLoading && <span className="text-xs text-ink-muted">Verifying...</span>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-dm-sans font-medium text-ink-secondary">Bank Name</label>
            <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-md font-dm-sans text-sm outline-none focus:border-saffron" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-dm-sans font-medium text-ink-secondary">Account Type</label>
            <select value={accType} onChange={e => setAccType(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-md font-dm-sans text-sm outline-none focus:border-saffron">
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </div>
          <button disabled={bankSubmitting} type="submit" className="w-full h-10 mt-2 bg-saffron text-white rounded-md font-medium text-sm hover:bg-saffron-dark transition-colors flex justify-center items-center">
            {bankSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
