import React from "react";

export type Permission =
  | "view_dashboard" | "manage_products" | "view_orders" | "pack_orders"
  | "update_delivery" | "purchase_credits" | "manage_team" | "view_analytics" | "manage_settings";

export const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
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

export type StandardRole = "owner" | "manager" | "sales_agent" | "delivery_agent" | "custom";

export type Member = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: StandardRole;
  custom_role_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  role: string;
  custom_role_id: string | null;
  status: string;
  created_at: string;
};

export type CustomRole = {
  id: string;
  name: string;
  permissions: Record<Permission, boolean>;
  created_at: string;
};

export function roleBadge(role: StandardRole, customName?: string): React.ReactNode {
  const base = "px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider";
  switch (role) {
    case "owner":          return <span className={`${base} bg-saffron/10 text-saffron`}>Owner</span>;
    case "manager":        return <span className={`${base} bg-blue-100 text-blue-700`}>Manager</span>;
    case "sales_agent":    return <span className={`${base} bg-emerald-100 text-emerald-700`}>Sales Agent</span>;
    case "delivery_agent": return <span className={`${base} bg-purple-100 text-purple-700`}>Delivery Agent</span>;
    case "custom":         return <span className={`${base} bg-surface border border-border text-ink-secondary`}>{customName ?? "Custom"}</span>;
  }
}

export function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function avatarColor(name: string) {
  const colors = ["bg-saffron/20", "bg-blue-100", "bg-emerald-100", "bg-purple-100", "bg-pink-100"];
  return colors[name.charCodeAt(0) % colors.length];
}
