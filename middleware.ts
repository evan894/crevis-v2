import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { hasPermission, type Role, type Permission } from '@/lib/permissions'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Always allow API routes, static files, auth callback
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/appeal/')
  ) {
    return response
  }

  // Unauthenticated users — block all app routes
  const isPublicRoute = pathname.startsWith('/auth')
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  if (!user) {
    return response
  }

  // --- Authenticated user ---

  const isPlatformAdmin = user.email === process.env.ADMIN_EMAIL

  // Fetch role + custom permissions from store_members (uses RLS: member_read_own)
  let memberRole: string | null = null
  let customPermissions: Permission[] | undefined = undefined

  if (!isPlatformAdmin) {
    const { data: member } = await supabase
      .from('store_members')
      .select(`
        role,
        custom_roles ( permissions )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    memberRole = member?.role ?? null

    if (memberRole === 'custom') {
      const cr = member?.custom_roles as unknown as { permissions: Permission[] } | null
      customPermissions = cr?.permissions ?? []
    }
  }

  const getRoleHome = (): string => {
    if (isPlatformAdmin) return '/dashboard'
    if (memberRole === 'delivery_agent') return '/delivery'
    if (memberRole === 'sales_agent') return '/agent'
    return '/dashboard'
  }

  // Logged-in user on /auth → their role home
  if (pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL(getRoleHome(), request.url))
  }

  // No store membership yet → allow /onboarding only
  if (!isPlatformAdmin && !memberRole) {
    if (!pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    return response
  }

  // User with membership on /onboarding → role home (unless mid-step)
  if (pathname.startsWith('/onboarding')) {
    const step = request.nextUrl.searchParams.get('step')
    if (!step) {
      return NextResponse.redirect(new URL(getRoleHome(), request.url))
    }
    return response
  }

  // Platform admin bypasses all role checks
  if (isPlatformAdmin) return response

  const role = memberRole as Role

  // /admin/* — platform admin only; redirect everyone else
  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL(getRoleHome(), request.url))
  }

  // Route → required permission map
  const routeChecks: Array<[string, Permission]> = [
    ['/dashboard', 'view_dashboard'],
    ['/products', 'manage_products'],
    ['/wallet', 'purchase_credits'],
    ['/team', 'manage_team'],
    ['/settings', 'manage_settings'],
    ['/orders', 'view_orders'],
    ['/agent', 'pack_orders'],
    ['/delivery', 'update_delivery'],
  ]

  for (const [prefix, permission] of routeChecks) {
    if (pathname.startsWith(prefix)) {
      if (!hasPermission(role, permission, customPermissions)) {
        return NextResponse.redirect(new URL(getRoleHome(), request.url))
      }
      break
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
