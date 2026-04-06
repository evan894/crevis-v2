"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import {
  Loader2, UserPlus, UserX, ChevronDown, Shield, ShieldAlert,
  Plus, Trash2, Edit3, X, Check, Users
} from "lucide-react";
import { toast } from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission =
  | "view_dashboard" | "manage_products" | "view_orders" | "pack_orders"
  | "update_delivery" | "purchase_credits" | "manage_team" | "view_analytics" | "manage_settings";

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: "view_dashboard",   label: "View Dashboard" },
  { key: "manage_products",  label: "Manage Products" },
  { key: "view_orders",      label: "View Orders" },
  { key: "pack_orders",      label: "Pack Orders" },
  { key: "update_delivery",  label: "Update Delivery Status" },
  { key: "purchase_credits", label: "Purchase Credits" },
  { key: "manage_team",      label: "Manage Team" },
  { key: "view_analytics",   label: "View Analytics" },
  { key: "manage_settings",  label: "Manage Settings" },
];

type StandardRole = "owner" | "manager" | "sales_agent" | "delivery_agent" | "custom";

type Member = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: StandardRole;
  custom_role_id: string | null;
  is_active: boolean;
  created_at: string;
};

type CustomRole = {
  id: string;
  name: string;
  permissions: Record<Permission, boolean>;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleBadge(role: StandardRole, customName?: string): React.ReactNode {
  const base = "px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider";
  switch (role) {
    case "owner":       return <span className={`${base} bg-saffron/10 text-saffron`}>Owner</span>;
    case "manager":     return <span className={`${base} bg-blue-100 text-blue-700`}>Manager</span>;
    case "sales_agent": return <span className={`${base} bg-emerald-100 text-emerald-700`}>Sales Agent</span>;
    case "delivery_agent": return <span className={`${base} bg-purple-100 text-purple-700`}>Delivery Agent</span>;
    case "custom":      return <span className={`${base} bg-surface border border-border text-ink-secondary`}>{customName ?? "Custom"}</span>;
  }
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function avatarColor(name: string) {
  const colors = ["bg-saffron/20", "bg-blue-100", "bg-emerald-100", "bg-purple-100", "bg-pink-100"];
  return colors[name.charCodeAt(0) % colors.length];
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddMemberPanel({
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
      const res = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, custom_role_id: role === "custom" ? customRoleId : null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setEmail(""); setRole("manager"); setCustomRoleId("");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/20 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
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
            <p className="text-xs text-ink-muted">They must already have a Crevis account.</p>
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

function CreateRoleModal({
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

function ConfirmModal({
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmRemoveRoleId, setConfirmRemoveRoleId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [membersRes, rolesRes] = await Promise.all([
      fetch("/api/team/members"),
      fetch("/api/team/custom-roles"),
    ]);
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers((data.members ?? []).filter((m: Member) => m.is_active));
    }
    if (rolesRes.ok) {
      const data = await rolesRes.json();
      setCustomRoles(data.roles ?? []);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Check ownership
      const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).single();
      if (seller) {
        const { data: memberData } = await supabase.from("store_members")
          .select("role").eq("seller_id", seller.id).eq("user_id", user.id).single();
        setIsOwner(memberData?.role === "owner");
      }

      await fetchData();
      setLoading(false);
    };
    init();
  }, [supabase, fetchData]);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Role updated");
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/team/members/${confirmRemove.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`${confirmRemove.display_name} removed from team`);
      setConfirmRemove(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!confirmRemoveRoleId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/team/custom-roles/${confirmRemoveRoleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Custom role deleted");
      setConfirmRemoveRoleId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-saffron animate-spin" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="w-16 h-16 text-ink-muted mb-4" strokeWidth={1.5} />
        <h1 className="font-syne font-bold text-2xl text-ink mb-2">Access Restricted</h1>
        <p className="text-ink-secondary max-w-sm">Only store owners can manage the team. Contact your store owner to change your permissions.</p>
      </div>
    );
  }

  const roleName = (m: Member) => {
    if (m.role !== "custom") return undefined;
    return customRoles.find(r => r.id === m.custom_role_id)?.name;
  };

  return (
    <div className="min-h-screen bg-surface font-dm-sans pb-20">
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-syne text-3xl font-bold text-ink mb-1">Your Team</h1>
            <p className="text-ink-secondary text-sm">{members.length} member{members.length !== 1 ? "s" : ""} · Manage roles and access</p>
          </div>
          <button
            onClick={() => setAddPanelOpen(true)}
            className="h-[44px] px-5 inline-flex items-center gap-2 bg-saffron text-white rounded-lg font-medium hover:bg-saffron-dark hover:shadow-saffron transition-all duration-200 text-sm shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        </div>

        {/* Members Table */}
        <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm mb-8">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users className="w-12 h-12 text-ink-muted mb-4" strokeWidth={1.5} />
              <h3 className="font-syne font-bold text-lg text-ink mb-2">No team members yet</h3>
              <p className="text-ink-secondary text-sm mb-6 max-w-xs">Add team members to help manage your store, pack orders, and handle deliveries.</p>
              <button
                onClick={() => setAddPanelOpen(true)}
                className="h-[40px] px-5 bg-saffron text-white rounded-lg text-sm font-medium hover:bg-saffron-dark transition-colors"
              >
                Add your first member
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    {["Member", "Role", "Status", "Added", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                      {/* Avatar + Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${avatarColor(member.display_name)} flex items-center justify-center font-semibold text-sm text-ink-secondary flex-shrink-0`}>
                            {initials(member.display_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{member.display_name}</p>
                            <p className="text-xs text-ink-muted truncate">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-5 py-4">
                        {member.role === "owner" ? (
                          roleBadge(member.role)
                        ) : (
                          <div className="relative inline-block">
                            <select
                              value={member.role}
                              onChange={e => handleRoleChange(member.id, e.target.value)}
                              className="appearance-none pl-2.5 pr-7 py-1 bg-surface border border-border rounded-full text-xs font-medium text-ink focus:border-saffron outline-none cursor-pointer hover:border-saffron/50 transition-colors"
                            >
                              <option value="manager">Store Manager</option>
                              <option value="sales_agent">Sales Agent</option>
                              <option value="delivery_agent">Delivery Agent</option>
                              {customRoles.length > 0 && (
                                <optgroup label="Custom">
                                  {customRoles.map(cr => (
                                    <option key={cr.id} value="custom">{cr.name}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-muted pointer-events-none" />
                          </div>
                        )}
                        {member.role === "custom" && (
                          <span className="ml-2 text-xs text-ink-muted">({roleName(member)})</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${member.is_active ? "bg-success-bg text-success" : "bg-surface text-ink-muted border border-border"}`}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {/* Added date */}
                      <td className="px-5 py-4 text-sm text-ink-secondary whitespace-nowrap">
                        {new Date(member.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        {member.role !== "owner" && (
                          <button
                            onClick={() => setConfirmRemove(member)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-error hover:bg-error-bg transition-colors"
                            title="Remove member"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Custom Roles Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-syne font-bold text-xl text-ink">Custom Roles</h2>
              <p className="text-sm text-ink-secondary mt-0.5">Define granular permissions for your team</p>
            </div>
            <button
              onClick={() => { setEditingRole(null); setCreateRoleOpen(true); }}
              className="h-[36px] px-4 inline-flex items-center gap-2 bg-surface-raised border border-border rounded-lg text-sm font-medium text-ink hover:border-saffron hover:text-saffron transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Role
            </button>
          </div>

          {customRoles.length === 0 ? (
            <div className="bg-surface-raised border border-border border-dashed rounded-2xl py-10 text-center">
              <Shield className="w-10 h-10 text-ink-muted mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-secondary">No custom roles yet. Create one to define specific permission sets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customRoles.map(role => {
                const activePerms = Object.entries(role.permissions).filter(([, v]) => v);
                const assignedCount = members.filter(m => m.custom_role_id === role.id && m.is_active).length;
                return (
                  <div key={role.id} className="bg-surface-raised border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-syne font-bold text-base text-ink">{role.name}</h3>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {assignedCount > 0 ? `Assigned to ${assignedCount} member${assignedCount > 1 ? "s" : ""}` : "Unassigned"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingRole(role); setCreateRoleOpen(true); }}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-saffron hover:bg-saffron/5 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmRemoveRoleId(role.id)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-error hover:bg-error-bg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activePerms.length === 0 ? (
                        <span className="text-xs text-ink-muted">No permissions set</span>
                      ) : (
                        activePerms.map(([key]) => {
                          const label = ALL_PERMISSIONS.find(p => p.key === key)?.label ?? key;
                          return (
                            <span key={key} className="px-2 py-0.5 bg-saffron/8 text-saffron text-[11px] font-medium rounded-full border border-saffron/20">
                              {label}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Panels & Modals */}
      <AddMemberPanel
        open={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        customRoles={customRoles}
        onSuccess={fetchData}
      />
      <CreateRoleModal
        open={createRoleOpen}
        onClose={() => { setCreateRoleOpen(false); setEditingRole(null); }}
        editRole={editingRole}
        onSuccess={fetchData}
      />
      <ConfirmModal
        open={!!confirmRemove}
        title={`Remove ${confirmRemove?.display_name ?? "member"}?`}
        message={`This will remove ${confirmRemove?.display_name ?? "this member"} from your team. They will lose access immediately.`}
        onConfirm={handleRemoveMember}
        onCancel={() => setConfirmRemove(null)}
        loading={actionLoading}
      />
      <ConfirmModal
        open={!!confirmRemoveRoleId}
        title="Delete custom role?"
        message="This role will be permanently deleted. Members using it will need a new role assigned."
        onConfirm={handleDeleteRole}
        onCancel={() => setConfirmRemoveRoleId(null)}
        loading={actionLoading}
      />
    </div>
  );
}
