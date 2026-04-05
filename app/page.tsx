import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'

export default async function RootPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/dashboard')
  redirect('/auth')
}
