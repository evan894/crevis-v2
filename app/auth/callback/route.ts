import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if seller has completed onboarding
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Allow admin directly
        if (user.email === process.env.ADMIN_EMAIL) {
          return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
        }

        const { data: seller } = await supabase
          .from('sellers')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (seller) {
          return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
        } else {
          return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
        }
      }
    }
  }

  // Auth failed — redirect to auth with error
  return NextResponse.redirect(
    new URL('/auth?error=auth_callback_failed', requestUrl.origin)
  )
}
