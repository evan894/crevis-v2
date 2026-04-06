export type Role =
  | 'owner'
  | 'manager'
  | 'sales_agent'
  | 'delivery_agent'
  | 'custom'

export type Permission =
  | 'view_dashboard'
  | 'manage_products'
  | 'view_orders'
  | 'pack_orders'
  | 'update_delivery'
  | 'purchase_credits'
  | 'manage_team'
  | 'view_analytics'
  | 'manage_settings'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'view_dashboard',
    'manage_products',
    'view_orders',
    'pack_orders',
    'update_delivery',
    'purchase_credits',
    'manage_team',
    'view_analytics',
    'manage_settings',
  ],
  manager: [
    'view_dashboard',
    'manage_products',
    'view_orders',
    'pack_orders',
    'update_delivery',
    'view_analytics',
    'manage_settings',
  ],
  sales_agent: [
    'view_orders',
    'pack_orders',
  ],
  delivery_agent: [
    'view_orders',
    'update_delivery',
  ],
  custom: [], // populated from custom_roles table
}

export const hasPermission = (
  role: Role,
  permission: Permission,
  customPermissions?: Permission[]
): boolean => {
  if (role === 'custom') {
    return customPermissions?.includes(permission) ?? false
  }
  return ROLE_PERMISSIONS[role].includes(permission)
}
