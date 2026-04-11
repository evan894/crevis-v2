"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Loader2, Truck, Package, CheckCircle2, AlertTriangle, Clock
} from "lucide-react";
import { toast } from "react-hot-toast";
import { FailedDeliveryModal } from "./FailedDeliveryModal";
import { OtpInput } from "./OtpInput";
import { relativeTime, type DeliveryRecord, type DeliveryStatus } from "./types";

export function ReadyCard({
  record, onAction
}: {
  record: DeliveryRecord;
  onAction: (deliveryId: string, action: "pick_up") => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden bg-surface shrink-0">
            {record.product?.photo_url ? (
              <Image src={record.product.photo_url} alt={record.product.name} fill className="object-cover" sizes="60px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-ink-muted" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-ink truncate">{record.product?.name ?? "Unknown"}</p>
            <p className="text-xs text-ink-secondary mt-0.5">
              Buyer: <span className="font-medium text-ink">{record.order.buyer_name}</span>
            </p>
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-ink-muted">
              <Clock className="w-3 h-3" />
              <span>Packed {relativeTime(record.packed_at)}</span>
            </div>
          </div>
          <span className="font-jetbrains-mono font-bold text-sm text-saffron shrink-0">
            ₹{record.order.amount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={async () => { setLoading(true); await onAction(record.id, "pick_up"); setLoading(false); }}
          disabled={loading}
          className="w-full h-[52px] bg-saffron text-white rounded-xl font-semibold text-[15px] hover:bg-saffron-dark hover:shadow-saffron disabled:opacity-60 flex items-center justify-center gap-2 transition-all duration-200"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5" /> Pick Up Order</>}
        </button>
      </div>
    </div>
  );
}

export function OutForDeliveryCard({
  record, onAction
}: {
  record: DeliveryRecord;
  onAction: (deliveryId: string, action: "confirm_delivery" | "report_failed", extras?: Record<string, string>) => Promise<{ wrong_otp?: boolean; locked?: boolean; attempts_left?: number; error?: string } | undefined>;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedModal, setFailedModal] = useState(false);
  const [failLoading, setFailLoading] = useState(false);
  const [locked, setLocked] = useState((record.otp_attempts ?? 0) >= 3);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (otp.length < 6) { toast.error("Enter all 6 digits"); return; }
    setLoading(true);
    setOtpError(null);
    const result = await onAction(record.id, "confirm_delivery", { otp });
    if (result?.wrong_otp) {
      setOtpError(`Wrong OTP. ${result.attempts_left} attempt${result.attempts_left !== 1 ? "s" : ""} remaining.`);
      setOtp("");
      if ((result.attempts_left ?? 0) <= 0) setLocked(true);
    }
    if (result?.locked) {
      setLocked(true);
      setOtpError("Too many wrong attempts. Please contact the customer directly.");
    }
    setLoading(false);
  };

  const handleFailed = async (reason: string, notes: string) => {
    setFailLoading(true);
    await onAction(record.id, "report_failed", { reason, notes });
    setFailedModal(false);
    setFailLoading(false);
  };

  return (
    <>
      {failedModal && (
        <FailedDeliveryModal
          onClose={() => setFailedModal(false)}
          onConfirm={handleFailed}
          loading={failLoading}
        />
      )}

      <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4">
          {/* Order summary */}
          <div className="flex gap-3 mb-4">
            <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden bg-surface shrink-0">
              {record.product?.photo_url ? (
                <Image src={record.product.photo_url} alt={record.product.name} fill className="object-cover" sizes="60px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-ink-muted" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink truncate">{record.product?.name ?? "Unknown"}</p>
              <p className="text-xs text-ink-secondary mt-0.5">
                Buyer: <span className="font-medium text-ink">{record.order.buyer_name}</span>
              </p>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-ink-muted">
                <Clock className="w-3 h-3" />
                <span>Picked up {relativeTime(record.picked_up_at)}</span>
              </div>
            </div>
            <span className="font-jetbrains-mono font-bold text-sm text-saffron shrink-0">
              ₹{record.order.amount.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-4" />

          {/* OTP Section */}
          {locked ? (
            <div className="bg-error-bg border border-error/20 rounded-xl p-4 text-center mb-3">
              <AlertTriangle className="w-5 h-5 text-error mx-auto mb-2" />
              <p className="text-sm font-medium text-error">Too many wrong attempts</p>
              <p className="text-xs text-ink-secondary mt-1">Please contact the customer directly.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-ink-secondary text-center mb-3 uppercase tracking-wider">Enter Customer OTP</p>
              <OtpInput value={otp} onChange={setOtp} />
              {otpError && (
                <p className="text-xs text-error text-center mt-2.5 font-medium">{otpError}</p>
              )}
              <button
                onClick={handleConfirm}
                disabled={loading || otp.length < 6}
                className="w-full h-[52px] mt-4 bg-saffron text-white rounded-xl font-semibold text-[15px] hover:bg-saffron-dark hover:shadow-saffron disabled:opacity-60 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirm Delivery</>}
              </button>
            </>
          )}

          {/* Report failed link */}
          <button
            onClick={() => setFailedModal(true)}
            className="w-full mt-3 h-[42px] text-error text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-error-bg rounded-xl transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Failed Delivery
          </button>
        </div>
      </div>
    </>
  );
}

export function CompletedCard({ record }: { record: DeliveryRecord }) {
  return (
    <div className="bg-surface-raised border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-ink truncate">{record.product?.name ?? "Unknown"}</p>
        <p className="text-xs text-ink-secondary">{record.order.buyer_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-jetbrains-mono font-bold text-sm text-saffron">₹{record.order.amount.toLocaleString("en-IN")}</p>
        <p className="text-[11px] text-ink-muted mt-0.5">{relativeTime(record.delivered_at)}</p>
      </div>
    </div>
  );
}

// Keep DeliveryStatus re-exported for page.tsx usage in optimistic updates
export type { DeliveryStatus };
