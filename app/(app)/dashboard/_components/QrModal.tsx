"use client";

import { QrCode, X, Download, RefreshCw } from "lucide-react";

export function QrModal({
  open, onClose, qrCodeUrl, isGenerating, onDownload, onRegenerate
}: {
  open: boolean;
  onClose: () => void;
  qrCodeUrl: string | null;
  isGenerating: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <div className="bg-surface-raised w-full max-w-sm rounded-xl shadow-lg border border-border flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-syne font-bold text-lg text-ink flex items-center gap-2">
            <QrCode className="w-5 h-5 text-saffron" />
            Store QR Code
          </h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors" title="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="bg-white p-4 rounded-xl border border-border w-full flex items-center justify-center min-h-[280px]">
            {qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${qrCodeUrl}?t=${Date.now()}`} alt="Store QR Code" className="w-64 h-64 select-none pointer-events-none" />
            ) : (
              <div className="text-center text-ink-muted flex flex-col items-center gap-2">
                <QrCode className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium">QR not generated yet</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={onDownload}
              disabled={!qrCodeUrl || isGenerating}
              className="w-full h-11 bg-ink text-surface-raised font-bold text-sm rounded flex items-center justify-center gap-2 hover:bg-ink-secondary active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <Download className="w-4 h-4" /> Download QR
            </button>
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="w-full h-11 bg-surface border border-border text-ink font-bold text-sm rounded flex items-center justify-center gap-2 hover:bg-surface-raised active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Regenerating..." : "Regenerate QR"}
            </button>
          </div>

          <p className="text-xs text-ink-muted text-center leading-relaxed">
            <strong className="text-ink-secondary">Warning:</strong> Regenerating will invalidate any previously printed QR codes for this store.
          </p>
        </div>
      </div>
    </div>
  );
}

// Suppress unused warning — shopSlug is used by parent for download filename
export type { };
