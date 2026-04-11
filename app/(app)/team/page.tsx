"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Loader2, UserPlus, UserX, ChevronDown, Shield, ShieldAlert, Plus, Trash2, Edit3, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import { AddMemberPanel } from "./_components/AddMemberPanel";
import { CreateRoleModal } from "./_components/CreateRoleModal";
import { ConfirmModal } from "./_components/ConfirmModal";
import { roleBadge, initials, avatarColor, ALL_PERMISSIONS, type Member, type Invite, type CustomRole } from "./_components/types";

export default function TeamPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmRemoveRoleId, setConfirmRemoveRoleId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [membersRes, invitesRes, rolesRes] = await Promise.all([
      fetch("/api/team/members"),
      fetch("/api/team/invites"),
      fetch("/api/team/custom-roles"),
    ]);
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers((data.members ?? []).filter((m: Member) => m.is_active));
    }
    if (invitesRes.ok) {
      const data = await invitesRes.json();
      setInvites(data.invites ?? []);
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

  const handleWithdrawInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/invites/${inviteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Invitation withdrawn");
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw invite");
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
                      <td className="px-5 py-4">
                        {member.role === "owner" ? (
                          roleBadge(member.role)
                        ) : member.role === "custom" ? (
                          roleBadge(member.role, roleName(member))
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
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${member.is_active ? "bg-success-bg text-success" : "bg-surface text-ink-muted border border-border"}`}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-ink-secondary whitespace-nowrap">
                        {new Date(member.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
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

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="bg-surface-raised border border-border rounded-2xl overflow-hidden shadow-sm mb-12">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-raised/50">
              <h2 className="font-syne font-bold text-lg text-ink">Pending Invitations</h2>
              <span className="text-xs font-medium bg-saffron/10 px-2 py-1 rounded-full border border-saffron/20 text-saffron">
                {invites.length} Pending
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface/30">
                    {["Invitee", "Assigned Role", "Invited At", ""].map((h, i) => (
                      <th key={i} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invites.map(invite => (
                    <tr key={invite.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-ink">{invite.email}</td>
                      <td className="px-5 py-4">
                        {roleBadge(
                          invite.role as Parameters<typeof roleBadge>[0],
                          customRoles.find(r => r.id === invite.custom_role_id)?.name
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-ink-secondary">
                        {new Date(invite.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleWithdrawInvite(invite.id)}
                          className="text-xs font-semibold text-ink-muted hover:text-error p-1.5 transition-colors"
                        >
                          Withdraw
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Custom Roles */}
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
