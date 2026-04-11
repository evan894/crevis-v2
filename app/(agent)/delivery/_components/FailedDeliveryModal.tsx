"use client";

import { useState } from "react";
import { Loader2, ChevronDown, X } from "lucide-react";
import { FAILURE_REASONS } from "./types";

export function FailedDeliveryModal({
  onClose, onConfirm, loading
}: {
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState(FAILURE_REASONS[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface-raised w-full max-w-sm rounded-2xl shadow-xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-syne font-bold text-base text-ink">Report Failed Delivery</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Reason selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Reason</label>
            <div className="relative">
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full h-[48px] pl-4 pr-10 bg-surface border border-border rounded-xl text-sm text-ink appearance-none focus:border-saffron outline-none"
              >
                {FAILURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            </div>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Notes <span className="text-ink-muted font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details…"
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-ink resize-none focus:border-saffron outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={() => onConfirm(reason, notes)}
              disabled={loading}
              className="w-full h-[52px] bg-error text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Failed Delivery"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full h-[44px] bg-surface border border-border rounded-xl text-sm font-medium text-ink-secondary hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
