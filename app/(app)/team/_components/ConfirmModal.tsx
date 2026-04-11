"use client";

import { Loader2 } from "lucide-react";

export function ConfirmModal({
  open, title, message, onConfirm, onCancel, loading
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm border border-border animate-in zoom-in-95 duration-200 p-6">
        <h3 className="font-syne font-bold text-lg text-ink mb-2">{title}</h3>
        <p className="text-sm text-ink-secondary mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 h-[40px] bg-surface border border-border rounded-lg text-sm font-medium text-ink-secondary hover:bg-surface-raised transition-colors disabled:opacity-70">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 h-[40px] bg-error text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
