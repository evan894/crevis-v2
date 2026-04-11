"use client";

import { useState } from "react";
import { Loader2, UserPlus, ChevronDown, X } from "lucide-react";
import { toast } from "react-hot-toast";
import type { CustomRole } from "./types";

export function AddMemberPanel({
  open, onClose, customRoles, onSuccess
}: {
  open: boolean;
  onClose: () => void;
  customRoles: CustomRole[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("manager");
  const [customRoleId, setCustomRoleId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role, custom_role_id: role === "custom" ? customRoleId : null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setEmail(""); setRole("manager"); setCustomRoleId("");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-ink/20 backdrop-blur-[2px] z-40 transition-opacity" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-surface-raised border-l border-border z-50 flex flex-col shadow-xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-syne font-bold text-xl text-ink">Add Team Member</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors text-ink-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Email address <span className="text-error">*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
              className="w-full h-[44px] px-3 bg-surface border border-border rounded-lg text-ink text-sm focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all"
            />
            <p className="text-xs text-ink-muted">They will receive an email invitation to join your store.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Role <span className="text-error">*</span></label>
            <div className="relative">
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full h-[44px] px-3 pr-8 bg-surface border border-border rounded-lg text-ink text-sm focus:border-saffron focus:ring-1 focus:ring-saffron outline-none appearance-none transition-all"
              >
                <option value="manager">Store Manager</option>
                <option value="sales_agent">Sales Agent</option>
                <option value="delivery_agent">Delivery Agent</option>
                {customRoles.length > 0 && (
                  <optgroup label="Custom Roles">
                    {customRoles.map(cr => (
                      <option key={cr.id} value="custom" onClick={() => setCustomRoleId(cr.id)}>
                        {cr.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            </div>
          </div>

          {role === "custom" && customRoles.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary">Custom Role</label>
              <div className="relative">
                <select
                  value={customRoleId}
                  onChange={e => setCustomRoleId(e.target.value)}
                  required
                  className="w-full h-[44px] px-3 pr-8 bg-surface border border-border rounded-lg text-ink text-sm focus:border-saffron focus:ring-1 focus:ring-saffron outline-none appearance-none transition-all"
                >
                  <option value="">Select role…</option>
                  {customRoles.map(cr => (
                    <option key={cr.id} value={cr.id}>{cr.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-saffron text-white rounded-lg font-medium hover:bg-saffron-dark hover:shadow-saffron transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Add Member</>}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
