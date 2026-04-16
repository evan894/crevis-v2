'use client'

import { createBrowserClient } from '@supabase/ssr'

export async function signOut() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('[signOut error]', error)
  }
  
  // Hard redirect — clears all client state
  // Do not use router.push — it keeps stale state
  window.location.href = '/auth'
}
