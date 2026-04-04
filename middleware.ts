import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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
  const isAuthPage = pathname.startsWith('/auth')
  const isDashboard = pathname.startsWith('/dashboard')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isProducts = pathname.startsWith('/products')
  const isWallet = pathname.startsWith('/wallet')
  
  const isProtectedRoute = isDashboard || isOnboarding || isProducts || isWallet

  // Restrict protected routes
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Restrict auth page if logged in
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  if (user && isOnboarding) {
    // Determine if seller record exists
    const { data: seller } = await supabase.from('sellers').select('id').eq('user_id', user.id).single()
    if (seller) {
      // Allow Step 2 or 3 of onboarding explicitly?
      // "Route guard: /onboarding redirects to /dashboard if seller record already exists"
      // Wait, if they are mid-onboarding (Step 2 or 3), they shouldn't be redirected away yet
      // We will rely on app/onboarding/page.tsx handling the multi-step states with query params to avoid Edge database overhead here, 
      // but if there are edge cases, middleware blocks access completely to /onboarding root if no step.
      // Easiest is just ensuring they can hit dashboard.
      const step = request.nextUrl.searchParams.get('step');
      if (!step) {
         // They went to /onboarding directly but already have a record
         return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
