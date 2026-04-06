import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Role, Permission } from '@/lib/permissions'
import { hasPermission } from '@/lib/permissions'

export type MemberContext = {
  sellerId: string
  userId: string
  role: Role
  customPermissions?: Permission[]
  isOwner: boolean
  isPlatformAdmin: boolean
}

export const getMemberContext = async (
  userId: string
): Promise<MemberContext | null> => {
  const isPlatformAdmin =
    (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email ===
    process.env.ADMIN_EMAIL

  const { data: member } = await supabaseAdmin
    .from('store_members')
    .select(`
      seller_id,
      role,
      custom_role_id,
      custom_roles ( permissions )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!member) return null

  const customRoles = member.custom_roles as { permissions: Permission[] } | null
  const customPermissions =
    member.role === 'custom' ? (customRoles?.permissions ?? []) : undefined

  return {
    sellerId: member.seller_id,
    userId,
    role: member.role as Role,
    customPermissions,
    isOwner: member.role === 'owner',
    isPlatformAdmin,
  }
}

export const requirePermission = async (
  userId: string,
  permission: Permission
): Promise<MemberContext> => {
  const ctx = await getMemberContext(userId)
  if (!ctx) throw new Error('Not a store member')
  if (
    !ctx.isPlatformAdmin &&
    !hasPermission(ctx.role, permission, ctx.customPermissions)
  ) {
    throw new Error(`Permission denied: ${permission}`)
  }
  return ctx
}
