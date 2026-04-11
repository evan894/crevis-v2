"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Check } from "lucide-react";
import { toast } from "react-hot-toast";
import { ALL_PERMISSIONS, type CustomRole, type Permission } from "./types";

export function CreateRoleModal({
  open, onClose, editRole, onSuccess
}: {
  open: boolean;
  onClose: () => void;
  editRole: CustomRole | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(editRole?.name ?? "");
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(
    editRole?.permissions ?? {} as Record<Permission, boolean>
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(editRole?.name ?? "");
    setPermissions(editRole?.permissions ?? {} as Record<Permission, boolean>);
  }, [editRole]);

  const togglePermission = (key: Permission) => {
    setPermissions(p => ({ ...p, [key]: !p[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = editRole ? `/api/team/custom-roles/${editRole.id}` : "/api/team/custom-roles";
      const method = editRole ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), permissions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editRole ? "Role updated" : "Custom role created");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-xl w-full max-w-md border border-border animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h3 className="font-syne font-bold text-lg text-ink">
            {editRole ? "Edit Role" : "Create Custom Role"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink-muted hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-secondary">Role name <span className="text-error">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Warehouse Staff"
              required
              className="w-full h-[44px] px-3 bg-surface border border-border rounded-lg text-ink text-sm focus:border-saffron focus:ring-1 focus:ring-saffron outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-ink-secondary">Permissions</p>
            <div className="space-y-2.5">
              {ALL_PERMISSIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => togglePermission(key)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${permissions[key] ? "bg-saffron border-saffron" : "border-border group-hover:border-saffron/50"}`}
                  >
                    {permissions[key] && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-ink" onClick={() => togglePermission(key)}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[44px] bg-saffron text-white rounded-lg font-medium hover:bg-saffron-dark transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editRole ? "Save Changes" : "Create Role")}
          </button>
        </form>
      </div>
    </div>
  );
}
